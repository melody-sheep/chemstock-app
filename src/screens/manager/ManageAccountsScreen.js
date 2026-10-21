// src/screens/manager/ManageAccountsScreen.js
import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking, StyleSheet } from 'react-native';
import Alert from '../../utils/appAlert';
import { StatusBar } from 'expo-status-bar';
import { BlurTargetView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import LiveStatusPill from '../../components/common/LiveStatusPill';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import UserAvatar from '../../components/common/UserAvatar';
import BranchSelector from '../../components/common/BranchSelector';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import CustomModal from '../../components/common/Modal';
import BottomActionBar, { useBottomActionBarHeight } from '../../components/common/BottomActionBar';
import SectionHeader from '../../components/common/SectionHeader';
import Input from '../../components/common/Input';
import PasswordStrengthHint, { MIN_AGENT_PASSWORD_LENGTH } from '../../components/common/PasswordStrengthHint';
import { formatPhDisplay } from '../../components/common/PhilippinePhoneInput';
import agentService from '../../services/agentService';
import profileService from '../../services/profileService';
import authService from '../../services/authService';
import { supabase } from '../../services/supabaseClient';
import useCachedFocusLoader from '../../hooks/useCachedFocusLoader';
import requireOnline from '../../utils/requireOnline';
import { getInitials } from '../../utils/initials';
import { ROLES, ROLE_LABELS } from '../../constants/roles';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import friendlyError from '../../utils/friendlyError';

const BRANCH_HEADER_HEIGHT = 76;

const ROLE_FILTER_OPTIONS = [
  { key: 'all', label: 'All Agents' },
  { key: ROLES.SALES_REP, label: 'Sales Reps' },
  { key: ROLES.COLLECTOR, label: 'Collectors' },
];

const ROLE_DOT_COLOR = {
  [ROLES.SALES_REP]: '#0085F9',
  [ROLES.COLLECTOR]: '#D98200',
};

function AgentCard({ account, onCardPress, onMorePress }) {
  const roleColor = ROLE_DOT_COLOR[account.role] || COLORS.textTertiary;
  const roleLabel = ROLE_LABELS[account.role] || account.role;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onCardPress(account)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`View ${account.full_name}'s details`}
    >
      <UserAvatar
        photoUrl={account.profilePhotoUrl}
        fallbackText={getInitials(account.full_name)}
        size={44}
        backgroundColor={COLORS.primaryLight}
        fallbackTextColor={COLORS.primary}
      />

      <View style={styles.cardTextCol}>
        <Text style={styles.cardName} numberOfLines={1}>{account.full_name}</Text>
        <View style={styles.cardMetaRow}>
          <View style={[styles.rolePill, { backgroundColor: roleColor + '18' }]}>
            <Text style={[styles.rolePillText, { color: roleColor }]} numberOfLines={1}>
              {roleLabel}
            </Text>
          </View>
        </View>
        <View style={styles.branchRow}>
          <Icon name="building" size={14} color={COLORS.textSecondary} />
          <Text style={styles.branchText} numberOfLines={1}>
            {account.branchName || 'No branch assigned'}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.moreButton}
        onPress={() => onMorePress(account)}
        accessibilityLabel={`More actions for ${account.full_name}`}
        accessibilityRole="button"
      >
        <Icon name="moreVertical" size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const loadAccountsData = async (previous) => {
  const manager = await authService.getCurrentUser();
  const prev = previous?.manager?.id === manager?.id ? previous : null;
  const branchIds = manager?.branchIds || [];
  const [result, branchesResult] = await Promise.all([
    agentService.getMyAgentAccounts(),
    branchIds.length > 0
      ? supabase.from('branches').select('id, name').in('id', branchIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  return {
    manager,
    accounts: result.success ? result.data : prev?.accounts ?? [],
    branches: !branchesResult.error ? branchesResult.data || [] : prev?.branches ?? [],
  };
};

export default function ManageAccountsScreen() {
  const navigation = useNavigation();
  const bottomBarHeight = useBottomActionBarHeight();
  const blurTarget = useRef(null);
  const [branchFilter, setBranchFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  // The account whose actions menu (reset password / remove) is open.
  const [actionsAccount, setActionsAccount] = useState(null);
  const [viewedAccount, setViewedAccount] = useState(null);
  const [viewedPhoneNumber, setViewedPhoneNumber] = useState(null);
  const [isLoadingPhone, setIsLoadingPhone] = useState(false);
  const [accountToRemove, setAccountToRemove] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [accountToResetPassword, setAccountToResetPassword] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Refetched every time this screen regains focus (freshMs 0), so an account
  // created via "Add Account" shows up on the way back. Saved per account, so
  // offline the last list stays on screen instead of "All Agents (0)".
  const { data: snapshot, isLoading, refresh, isUnavailable, refreshControl } = useCachedFocusLoader('manager-accounts', loadAccountsData, {
    freshMs: 0,
  });
  const manager = snapshot?.manager ?? null;
  const accounts = snapshot?.accounts ?? [];
  const branches = snapshot?.branches ?? [];

  // Phone number isn't in the account list RPC — fetched on demand via the
  // same get_agent_profile RPC Track Deliveries already uses for this, so
  // viewing it here needs no extra database change. Cached per agent for
  // as long as this screen stays mounted (a ref so it doesn't trigger
  // re-renders itself), so reopening the same card never re-fetches or
  // re-shows the spinner.
  const phoneNumberCache = useRef(new Map());
  // The number couldn't be loaded (offline or a server error) — not the same
  // as the agent having no number, so it isn't shown as "Not set".
  const [phoneUnavailable, setPhoneUnavailable] = useState(false);

  const handleCardPress = async (account) => {
    setViewedAccount(account);
    setPhoneUnavailable(false);

    if (phoneNumberCache.current.has(account.id)) {
      setViewedPhoneNumber(phoneNumberCache.current.get(account.id));
      setIsLoadingPhone(false);
      return;
    }

    setViewedPhoneNumber(null);
    setIsLoadingPhone(true);
    const result = await profileService.getAgentProfileById(account.id);
    setIsLoadingPhone(false);
    if (result.success) {
      phoneNumberCache.current.set(account.id, result.data.phoneNumber);
      setViewedPhoneNumber(result.data.phoneNumber);
    } else {
      setPhoneUnavailable(true);
    }
  };

  const closeDetailsModal = () => {
    setViewedAccount(null);
    setViewedPhoneNumber(null);
  };

  const handleCallViewedAccount = () => {
    if (!viewedPhoneNumber) return;
    Linking.openURL(`tel:${viewedPhoneNumber}`);
  };

  const handleRemovePress = (account) => {
    setAccountToRemove(account);
  };

  const handleMorePress = (account) => {
    setActionsAccount(account);
  };

  const closeResetPasswordModal = () => {
    setAccountToResetPassword(null);
    setNewPassword('');
    setConfirmNewPassword('');
  };

  const handleConfirmResetPassword = async () => {
    if (!accountToResetPassword || isResettingPassword) return;

    if (newPassword.length < MIN_AGENT_PASSWORD_LENGTH) {
      Alert.alert('Weak Password', `Password must be at least ${MIN_AGENT_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }

    if (!requireOnline('Resetting a password')) return;
    setIsResettingPassword(true);
    const result = await agentService.resetAgentPassword(accountToResetPassword.id, newPassword);
    setIsResettingPassword(false);

    if (!result.success) {
      Alert.alert('Failed to Reset Password', friendlyError(result.message));
      return;
    }

    const name = accountToResetPassword.full_name;
    closeResetPasswordModal();
    Alert.alert('Password Reset', `${name}'s password has been reset. Let them know their new password.`);
  };

  const handleConfirmRemove = async () => {
    if (!accountToRemove || isRemoving) return;
    if (!requireOnline('Removing an account')) return;
    setIsRemoving(true);

    const result = await agentService.deleteAgentAccount(accountToRemove.id);

    setIsRemoving(false);
    setAccountToRemove(null);

    if (!result.success) {
      Alert.alert('Failed to Remove', friendlyError(result.message));
      return;
    }

    refresh({ force: true });
  };

  const filteredAccounts = accounts
    .filter((a) => roleFilter === 'all' || a.role === roleFilter)
    .filter((a) => branchFilter === 'all' || (a.branch_ids || []).includes(branchFilter));
  // Role pill counts follow the chosen branch.
  const branchScopedAccounts = accounts.filter(
    (a) => branchFilter === 'all' || (a.branch_ids || []).includes(branchFilter)
  );
  const roleCount = (key) =>
    key === 'all' ? branchScopedAccounts.length : branchScopedAccounts.filter((a) => a.role === key).length;
  const branchChipOptions = [{ id: 'all', name: 'All branches' }, ...branches];
  const workspaceLabel =
    branchFilter === 'all' ? manager?.branchName || 'No branch assigned' : branches.find((b) => b.id === branchFilter)?.name;

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton
          backButtonText="Manager Dashboard"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
        />

        <SecondaryHeader height={BRANCH_HEADER_HEIGHT}>
          <View style={styles.titleRow}>
            <View style={styles.titleTextCol}>
              <Text style={styles.pageTitle} numberOfLines={1}>Account Management</Text>
              <Text style={styles.pageSubtitle}>Manage branch staff</Text>
            </View>
            <LiveStatusPill pillStyle={styles.onlinePill} dotStyle={styles.onlineDot} textStyle={styles.onlineText} />
          </View>
        </SecondaryHeader>

        <BlurTargetView ref={blurTarget} style={styles.contentTarget}>
          <ScrollView
          refreshControl={refreshControl}
            contentContainerStyle={[styles.content, { paddingBottom: bottomBarHeight + SPACING.md }]}
            showsVerticalScrollIndicator={false}
          >
            <SectionHeader icon="building" size="md" label="Branch" style={styles.sectionHeaderFirst} />
            {branches.length > 1 ? (
              <BranchSelector
                branches={branchChipOptions}
                selectedId={branchFilter}
                onSelect={setBranchFilter}
                scrollable
                scrollBleed={SPACING.lg}
              />
            ) : (
              <View style={styles.workspaceChip}>
                <Text style={styles.workspaceChipText} numberOfLines={1}>
                  {workspaceLabel}
                </Text>
              </View>
            )}

            <SectionHeader icon="idCard" size="md" label="Role" style={styles.sectionHeaderSpaced} />
            <View style={styles.roleRow}>
              {ROLE_FILTER_OPTIONS.map((option) => {
                const isActive = option.key === roleFilter;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.rolePillButton, isActive && styles.rolePillButtonActive]}
                    onPress={() => setRoleFilter(option.key)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text
                      style={[styles.rolePillButtonText, isActive && styles.rolePillButtonTextActive]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                    >
                      {option.key === 'all' ? 'All' : option.label} ({roleCount(option.key)})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <SectionHeader icon="users" size="md" label={`Agents (${filteredAccounts.length})`} style={styles.sectionHeaderSpaced} />

            {isLoading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            ) : filteredAccounts.length === 0 ? (
              <Text style={styles.emptyText}>
                {accounts.length === 0
                  ? isUnavailable
                    ? 'Not saved on this phone yet — connect to the internet to load your agents.'
                    : 'No agent accounts yet.'
                  : 'No accounts match this filter.'}
              </Text>
            ) : (
              <View style={styles.list}>
                {filteredAccounts.map((account) => (
                  <AgentCard
                    key={account.id}
                    account={account}
                    onCardPress={handleCardPress}
                    onMorePress={handleMorePress}
                  />
                ))}
              </View>
            )}
          </ScrollView>
        </BlurTargetView>

        <BottomActionBar variant="glass" blurTarget={blurTarget}>
          <Button
            title="New Employee"
            icon="plus"
            iconWeight="bold"
            onPress={() => navigation.navigate('AgentAccounts')}
            variant="black"
            height={48}
            fontSize={16}
            borderRadius={24}
          />
        </BottomActionBar>
      </View>

      <CustomModal visible={!!actionsAccount} onClose={() => setActionsAccount(null)} height="auto">
        {actionsAccount && (
          <>
            <View style={styles.detailsHeaderRow}>
              <UserAvatar
                photoUrl={actionsAccount.profilePhotoUrl}
                fallbackText={getInitials(actionsAccount.full_name)}
                size={52}
                backgroundColor={COLORS.primaryLight}
                fallbackTextColor={COLORS.primary}
              />
              <View style={styles.detailsHeaderTextCol}>
                <Text style={styles.detailsName} numberOfLines={1}>{actionsAccount.full_name}</Text>
                <View style={styles.actionsMetaRow}>
                  <View
                    style={[
                      styles.rolePill,
                      { backgroundColor: (ROLE_DOT_COLOR[actionsAccount.role] || COLORS.textTertiary) + '18' },
                    ]}
                  >
                    <Text
                      style={[styles.rolePillText, { color: ROLE_DOT_COLOR[actionsAccount.role] || COLORS.textTertiary }]}
                    >
                      {ROLE_LABELS[actionsAccount.role] || actionsAccount.role}
                    </Text>
                  </View>
                  <Text style={styles.actionsUsername} numberOfLines={1}>@{actionsAccount.username}</Text>
                </View>
              </View>
            </View>

            <Button
              title="Reset password"
              icon="lock"
              variant="black"
              height={48}
              fontSize={16}
              borderRadius={24}
              onPress={() => {
                const account = actionsAccount;
                setActionsAccount(null);
                setAccountToResetPassword(account);
              }}
              style={styles.actionsButton}
            />
            <Button
              title="Remove account"
              icon="trash"
              variant="outline"
              accentColor={COLORS.error}
              height={48}
              fontSize={16}
              borderRadius={24}
              hasShadow={false}
              onPress={() => {
                const account = actionsAccount;
                setActionsAccount(null);
                handleRemovePress(account);
              }}
              style={styles.actionsButton}
            />
            <TouchableOpacity
              style={styles.actionsCancel}
              onPress={() => setActionsAccount(null)}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={styles.actionsCancelText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
      </CustomModal>

      <ConfirmationDialog
        visible={!!accountToRemove}
        onCancel={() => setAccountToRemove(null)}
        onConfirm={handleConfirmRemove}
        icon="trash"
        title="Remove Account?"
        description={
          accountToRemove
            ? `This will permanently delete ${accountToRemove.full_name}'s account. They will no longer be able to log in, and this cannot be undone.`
            : ''
        }
        confirmLabel={isRemoving ? 'Removing…' : 'Remove Account'}
        height={340}
      />

      <CustomModal visible={!!viewedAccount} onClose={closeDetailsModal} height="auto">
        {viewedAccount && (
          <>
            <View style={styles.detailsHeaderRow}>
              <UserAvatar
                photoUrl={viewedAccount.profilePhotoUrl}
                fallbackText={getInitials(viewedAccount.full_name)}
                size={56}
                backgroundColor={COLORS.primaryLight}
                fallbackTextColor={COLORS.primary}
              />
              <View style={styles.detailsHeaderTextCol}>
                <Text style={styles.detailsName} numberOfLines={1}>{viewedAccount.full_name}</Text>
                <View
                  style={[
                    styles.rolePill,
                    { backgroundColor: (ROLE_DOT_COLOR[viewedAccount.role] || COLORS.textTertiary) + '18' },
                  ]}
                >
                  <Text
                    style={[styles.rolePillText, { color: ROLE_DOT_COLOR[viewedAccount.role] || COLORS.textTertiary }]}
                  >
                    {ROLE_LABELS[viewedAccount.role] || viewedAccount.role}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.detailsCard}>
              <View style={styles.detailsRow}>
                <View style={styles.detailsRowLeft}>
                  <Icon name="profile" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.detailsLabel}>Username</Text>
                </View>
                <Text style={styles.detailsValue} numberOfLines={1}>{viewedAccount.username}</Text>
              </View>

              <View style={styles.detailsDivider} />

              {isLoadingPhone ? (
                <View style={styles.detailsRow}>
                  <View style={styles.detailsRowLeft}>
                    <Icon name="phone" size={16} color={COLORS.textSecondary} />
                    <Text style={styles.detailsLabel}>Phone Number</Text>
                  </View>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                </View>
              ) : viewedPhoneNumber ? (
                <TouchableOpacity
                  style={styles.detailsRow}
                  onPress={handleCallViewedAccount}
                  accessibilityRole="button"
                  accessibilityLabel={`Call ${viewedAccount.full_name}`}
                >
                  <View style={styles.detailsRowLeft}>
                    <Icon name="phone" size={16} color={COLORS.textSecondary} />
                    <Text style={styles.detailsLabel}>Phone</Text>
                  </View>
                  <View style={styles.phoneRight}>
                    <Text style={styles.phoneValue}>{formatPhDisplay(viewedPhoneNumber)}</Text>
                    <View style={styles.callButton}>
                      <Icon name="phone" size={14} color="#FFFFFF" weight="fill" />
                    </View>
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={styles.detailsRow}>
                  <View style={styles.detailsRowLeft}>
                    <Icon name="phone" size={16} color={COLORS.textSecondary} />
                    <Text style={styles.detailsLabel}>Phone Number</Text>
                  </View>
                  <Text style={styles.detailsValue}>{phoneUnavailable ? 'Connect to load' : 'Not set'}</Text>
                </View>
              )}

              <View style={styles.detailsDivider} />

              <View style={styles.detailsRow}>
                <View style={styles.detailsRowLeft}>
                  <Icon name="location" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.detailsLabel}>Branch</Text>
                </View>
                <Text style={styles.detailsValue} numberOfLines={1}>
                  {viewedAccount.branchName || 'No branch assigned'}
                </Text>
              </View>
            </View>

            <Button
              title="Close"
              variant="outline"
              onPress={closeDetailsModal}
              height={48}
              fontSize={16}
              borderRadius={24}
              hasShadow={false}
              style={styles.resetModalButton}
            />
          </>
        )}
      </CustomModal>

      <CustomModal visible={!!accountToResetPassword} onClose={closeResetPasswordModal} height={420}>
        <Text style={styles.resetModalTitle}>
          Reset Password{accountToResetPassword ? ` — ${accountToResetPassword.full_name}` : ''}
        </Text>
        <Text style={styles.resetModalSubtitle}>
          This sets a brand-new password immediately. Let {accountToResetPassword?.full_name || 'the agent'} know
          what it is — there's no way to view their old one.
        </Text>

        <Input
          label="New Password"
          required
          placeholder="Enter new password"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
          autoCapitalize="none"
        />
        <PasswordStrengthHint password={newPassword} />
        <Input
          label="Confirm New Password"
          required
          placeholder="Confirm new password"
          secureTextEntry
          value={confirmNewPassword}
          onChangeText={setConfirmNewPassword}
          autoCapitalize="none"
        />

        <Button
          title={isResettingPassword ? 'Resetting…' : 'Reset Password'}
          onPress={handleConfirmResetPassword}
          disabled={isResettingPassword}
          style={styles.resetModalButton}
        />
      </CustomModal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
  },
  titleTextCol: { flexShrink: 1, flex: 1 },
  pageTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  pageSubtitle: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  onlineText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.success,
  },
  contentTarget: { flex: 1 },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  sectionHeaderFirst: { marginTop: SPACING.sm, marginBottom: 0 },
  sectionHeaderSpaced: { marginTop: SPACING.lg, marginBottom: 0 },
  roleRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  rolePillButton: {
    flex: 1,
    height: 40,
    paddingHorizontal: 4,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#D5DAE3',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rolePillButtonActive: { borderColor: '#0085F9', backgroundColor: '#EAF4FF' },
  rolePillButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
  },
  rolePillButtonTextActive: {
    color: '#0085F9',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  actionsMetaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  actionsUsername: {
    flexShrink: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  actionsButton: { marginTop: SPACING.sm },
  actionsCancel: { alignItems: 'center', paddingVertical: SPACING.md },
  actionsCancelText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
  },
  phoneRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  workspaceChip: {
    height: 48,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderNeutral,
    backgroundColor: COLORS.textWhite,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  workspaceChipText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textPrimary,
  },
  filterChip: {
    height: 48,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
    backgroundColor: COLORS.primary + '0D',
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  filterChipText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.primary,
  },
  loadingWrap: { paddingVertical: SPACING.xl, alignItems: 'center' },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  list: { gap: SPACING.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.textWhite,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    padding: SPACING.sm,
  },
  cardTextCol: { flex: 1 },
  cardName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  rolePill: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  rolePillText: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  branchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  branchText: {
    flexShrink: 1,
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textTertiary,
  },
  moreButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  detailsHeaderTextCol: { flex: 1, gap: 4 },
  detailsName: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  detailsCard: {
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: 12,
    backgroundColor: COLORS.textWhite,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    paddingVertical: 12,
  },
  detailsRowLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  detailsLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
  },
  detailsValue: {
    flexShrink: 1,
    textAlign: 'right',
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    color: '#272632',
  },
  detailsDivider: {
    height: 1,
    backgroundColor: '#EEF2F7',
  },
  phoneValue: {
    textAlign: 'right',
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    color: COLORS.primary,
  },
  callButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetModalTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
    marginBottom: SPACING.xs,
  },
  resetModalSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
    lineHeight: 18,
  },
  resetModalButton: {
    marginTop: SPACING.sm,
  },
});
