// src/screens/manager/ManageAccountsScreen.js
import React, { useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BlurTargetView } from 'expo-blur';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import LiveStatusPill from '../../components/common/LiveStatusPill';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import UserAvatar from '../../components/common/UserAvatar';
import FilterSheet from '../../components/common/FilterSheet';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import CustomModal from '../../components/common/Modal';
import BottomActionBar, { useBottomActionBarHeight } from '../../components/common/BottomActionBar';
import SectionHeader from '../../components/common/SectionHeader';
import Input from '../../components/common/Input';
import agentService from '../../services/agentService';
import authService from '../../services/authService';
import { supabase } from '../../services/supabaseClient';
import { getInitials } from '../../utils/initials';
import { ROLES, ROLE_LABELS } from '../../constants/roles';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const BRANCH_HEADER_HEIGHT = 76;

const ROLE_FILTER_OPTIONS = [
  { key: 'all', label: 'All Agents' },
  { key: ROLES.SALES_REP, label: 'Sales Reps' },
  { key: ROLES.COLLECTOR, label: 'Collectors' },
];

const ROLE_DOT_COLOR = {
  [ROLES.SALES_REP]: COLORS.accentOrange,
  [ROLES.COLLECTOR]: COLORS.accentPink,
};

function AgentCard({ account, onMorePress }) {
  const roleColor = ROLE_DOT_COLOR[account.role] || COLORS.textTertiary;
  const roleLabel = ROLE_LABELS[account.role] || account.role;

  return (
    <View style={styles.card}>
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
          <Icon name="location" size={12} color={COLORS.textTertiary} />
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
    </View>
  );
}

export default function ManageAccountsScreen() {
  const navigation = useNavigation();
  const bottomBarHeight = useBottomActionBarHeight();
  const blurTarget = useRef(null);
  const [manager, setManager] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchFilter, setBranchFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('all');
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);
  const [isBranchSheetVisible, setIsBranchSheetVisible] = useState(false);
  const [accountToRemove, setAccountToRemove] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [accountToResetPassword, setAccountToResetPassword] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    const [currentManager, result] = await Promise.all([
      authService.getCurrentUser(),
      agentService.getMyAgentAccounts(),
    ]);
    setManager(currentManager);
    setAccounts(result.success ? result.data : []);

    const branchIds = currentManager?.branchIds || [];
    if (branchIds.length > 0) {
      const { data } = await supabase.from('branches').select('id, name').in('id', branchIds);
      setBranches(data || []);
    }

    setIsLoading(false);
  }, []);

  // Refetch every time this screen regains focus, so an account created via
  // "Add Account" shows up immediately on the way back without a manual refresh.
  useFocusEffect(
    useCallback(() => {
      loadAccounts();
    }, [loadAccounts])
  );

  const handleWorkspacePress = () => {
    if (branches.length <= 1) return;
    setIsBranchSheetVisible(true);
  };

  const handleRemovePress = (account) => {
    setAccountToRemove(account);
  };

  const handleMorePress = (account) => {
    Alert.alert(account.full_name, `Username: ${account.username}`, [
      { text: 'Reset Password', onPress: () => setAccountToResetPassword(account) },
      { text: 'Remove Account', style: 'destructive', onPress: () => handleRemovePress(account) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const closeResetPasswordModal = () => {
    setAccountToResetPassword(null);
    setNewPassword('');
    setConfirmNewPassword('');
  };

  const handleConfirmResetPassword = async () => {
    if (!accountToResetPassword || isResettingPassword) return;

    if (newPassword.length < 4) {
      Alert.alert('Weak Password', 'Password must be at least 4 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }

    setIsResettingPassword(true);
    const result = await agentService.resetAgentPassword(accountToResetPassword.id, newPassword);
    setIsResettingPassword(false);

    if (!result.success) {
      Alert.alert('Failed to Reset Password', result.message);
      return;
    }

    const name = accountToResetPassword.full_name;
    closeResetPasswordModal();
    Alert.alert('Password Reset', `${name}'s password has been reset. Let them know their new password.`);
  };

  const handleConfirmRemove = async () => {
    if (!accountToRemove || isRemoving) return;
    setIsRemoving(true);

    const result = await agentService.deleteAgentAccount(accountToRemove.id);

    setIsRemoving(false);
    setAccountToRemove(null);

    if (!result.success) {
      Alert.alert('Failed to Remove', result.message);
      return;
    }

    setAccounts((prev) => prev.filter((a) => a.id !== accountToRemove.id));
  };

  const filteredAccounts = accounts
    .filter((a) => roleFilter === 'all' || a.role === roleFilter)
    .filter((a) => branchFilter === 'all' || (a.branch_ids || []).includes(branchFilter));
  const activeFilterOption = ROLE_FILTER_OPTIONS.find((option) => option.key === roleFilter);
  const branchFilterOptions = [
    { key: 'all', label: 'All Branches' },
    ...branches.map((b) => ({ key: b.id, label: b.name })),
  ];
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
            contentContainerStyle={[styles.content, { paddingBottom: bottomBarHeight + SPACING.md }]}
            showsVerticalScrollIndicator={false}
          >
            <SectionHeader icon="building" label="Workspace" style={styles.sectionHeaderFirst} />
            <TouchableOpacity
              style={styles.workspaceChip}
              onPress={handleWorkspacePress}
              activeOpacity={branches.length > 1 ? 0.7 : 1}
              accessibilityRole={branches.length > 1 ? 'button' : undefined}
              accessibilityLabel="Current branch workspace"
            >
              <Text style={styles.workspaceChipText} numberOfLines={1}>
                {workspaceLabel}
              </Text>
              {branches.length > 1 && <Icon name="caretDown" size={16} color={COLORS.textPrimary} />}
            </TouchableOpacity>

            <SectionHeader icon="filter" label="Filter Agents" />
            <TouchableOpacity
              style={styles.filterChip}
              onPress={() => setIsFilterSheetVisible(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Filter agents by role"
            >
              <Icon name="idCard" size={16} color={COLORS.primary} />
              <Text style={styles.filterChipText} numberOfLines={1}>
                {activeFilterOption.label} ({filteredAccounts.length})
              </Text>
              <Icon name="filter" size={16} color={COLORS.primary} />
            </TouchableOpacity>

            <SectionHeader icon="users" label="Agents" />

            {isLoading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            ) : filteredAccounts.length === 0 ? (
              <Text style={styles.emptyText}>
                {accounts.length === 0 ? 'No agent accounts yet.' : 'No accounts match this filter.'}
              </Text>
            ) : (
              <View style={styles.list}>
                {filteredAccounts.map((account) => (
                  <AgentCard key={account.id} account={account} onMorePress={handleMorePress} />
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
            height={44}
            fontSize={14}
            borderRadius={22}
          />
        </BottomActionBar>
      </View>

      <FilterSheet
        visible={isFilterSheetVisible}
        onClose={() => setIsFilterSheetVisible(false)}
        title="Filter Agents"
        options={ROLE_FILTER_OPTIONS}
        selectedKey={roleFilter}
        onSelect={setRoleFilter}
      />

      <FilterSheet
        visible={isBranchSheetVisible}
        onClose={() => setIsBranchSheetVisible(false)}
        title="Filter by Branch"
        options={branchFilterOptions}
        selectedKey={branchFilter}
        onSelect={setBranchFilter}
      />

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
  sectionHeaderFirst: { marginTop: 0 },
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
    fontSize: 11,
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
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textTertiary,
  },
  moreButton: {
    width: 32,
    height: 32,
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
