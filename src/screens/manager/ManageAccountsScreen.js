// src/screens/manager/ManageAccountsScreen.js
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import FilterSheet from '../../components/common/FilterSheet';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import agentService from '../../services/agentService';
import authService from '../../services/authService';
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

function getInitials(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function AgentCard({ account, onRemove }) {
  return (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{getInitials(account.full_name)}</Text>
      </View>

      <View style={styles.cardTextCol}>
        <Text style={styles.cardName} numberOfLines={1}>{account.full_name}</Text>
        <View style={styles.roleRow}>
          <View style={[styles.roleDot, { backgroundColor: ROLE_DOT_COLOR[account.role] || COLORS.textTertiary }]} />
          <Text style={styles.roleText}>{ROLE_LABELS[account.role] || account.role}</Text>
        </View>
        <Text style={styles.branchText} numberOfLines={1}>
          {account.branchName || 'No branch assigned'}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.moreButton}
        onPress={() => onRemove(account)}
        accessibilityLabel={`Remove ${account.full_name}`}
        accessibilityRole="button"
      >
        <Icon name="moreVertical" size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

export default function ManageAccountsScreen() {
  const navigation = useNavigation();
  const [manager, setManager] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('all');
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);
  const [accountToRemove, setAccountToRemove] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    const [currentManager, result] = await Promise.all([
      authService.getCurrentUser(),
      agentService.getMyAgentAccounts(),
    ]);
    setManager(currentManager);
    setAccounts(result.success ? result.data : []);
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
    Alert.alert('Branch Workspace', 'Switching between individual branches is coming soon.');
  };

  const handleRemovePress = (account) => {
    setAccountToRemove(account);
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

  const filteredAccounts = roleFilter === 'all' ? accounts : accounts.filter((a) => a.role === roleFilter);
  const activeFilterOption = ROLE_FILTER_OPTIONS.find((option) => option.key === roleFilter);

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton
          backButtonText="Manager Dashboard"
          showDocumentIcon
          onDocumentPress={() => Alert.alert('Documents', 'Coming soon.')}
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
        />

        <SecondaryHeader height={BRANCH_HEADER_HEIGHT}>
          <View style={styles.titleRow}>
            <Text style={styles.pageTitle}>Account Management</Text>
            <View style={styles.onlinePill}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Online</Text>
            </View>
          </View>
        </SecondaryHeader>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.label}>Current Branch Workspace</Text>
          <TouchableOpacity style={styles.workspaceBox} onPress={handleWorkspacePress} activeOpacity={0.7}>
            <Text style={styles.workspaceText} numberOfLines={1}>
              {manager?.branchName || 'No branch assigned'}
            </Text>
            <Icon name="caretDown" size={16} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={[styles.label, styles.filterLabel]}>View Filter (Agents)</Text>
          <TouchableOpacity
            style={styles.filterBar}
            onPress={() => setIsFilterSheetVisible(true)}
            activeOpacity={0.8}
          >
            <View style={styles.filterBarLeft}>
              <Icon name="idCard" size={18} color="#FFFFFF" weight="fill" />
              <Text style={styles.filterBarText}>
                {activeFilterOption.label} ({filteredAccounts.length})
              </Text>
            </View>
            <Icon name="filter" size={18} color="#FFFFFF" />
          </TouchableOpacity>

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
                <AgentCard key={account.id} account={account} onRemove={handleRemovePress} />
              ))}
            </View>
          )}

          <View style={{ height: 8 }} />
        </ScrollView>

        <View style={styles.bottomBar}>
          <Button
            title="Create New Employee Account"
            icon="plus"
            iconWeight="bold"
            onPress={() => navigation.navigate('AgentAccounts')}
            variant="black"
          />
        </View>
      </View>

      <FilterSheet
        visible={isFilterSheetVisible}
        onClose={() => setIsFilterSheetVisible(false)}
        title="Filter Agents"
        options={ROLE_FILTER_OPTIONS}
        selectedKey={roleFilter}
        onSelect={setRoleFilter}
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
  pageTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  content: { padding: SPACING.lg, paddingBottom: 24 },
  label: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  filterLabel: { marginTop: SPACING.lg },
  workspaceBox: {
    height: 48,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  workspaceText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: '#FFFFFF',
  },
  filterBar: {
    height: 48,
    borderRadius: 10,
    backgroundColor: COLORS.accentOrange,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  filterBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  filterBarText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    padding: SPACING.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.primary,
  },
  cardTextCol: { flex: 1 },
  cardName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  roleDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  roleText: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
  },
  branchText: {
    marginTop: 2,
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
  bottomBar: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    backgroundColor: COLORS.background,
  },
});
