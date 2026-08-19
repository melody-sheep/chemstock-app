// src/screens/manager/ReleaseStockRecipientScreen.js
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import Input from '../../components/common/Input';
import Icon from '../../components/common/Icon';
import Stepper from '../../components/common/Stepper';
import Button from '../../components/common/Button';
import agentService from '../../services/agentService';
import authService from '../../services/authService';
import { ROLES } from '../../constants/roles';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const STEP_LABELS = ['Who receives the stock?', 'How many items?', 'Final Proof'];

const ROLE_TABS = [
  { key: ROLES.SALES_REP, label: 'Sales Rep', subtitle: 'Handed Directly' },
  { key: ROLES.COLLECTOR, label: 'Collector', subtitle: 'Middleman / Bridge' },
];

function getInitials(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ReleaseStockRecipientScreen() {
  const navigation = useNavigation();
  const [manager, setManager] = useState(null);
  const [agents, setAgents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeRole, setActiveRole] = useState(ROLES.SALES_REP);
  const [searchText, setSearchText] = useState('');
  const [selectedAgent, setSelectedAgent] = useState(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const [currentManager, result] = await Promise.all([
      authService.getCurrentUser(),
      agentService.getMyAgentAccounts(),
    ]);
    setManager(currentManager);
    setAgents(result.success ? result.data : []);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const managerBranchIds = manager?.branchIds || [];
  const query = searchText.trim().toLowerCase();

  const visibleAgents = agents.filter((agent) => {
    if (agent.role !== activeRole) return false;
    const sharesBranch = (agent.branch_ids || []).some((id) => managerBranchIds.includes(id));
    if (!sharesBranch) return false;
    if (!query) return true;
    return agent.full_name?.toLowerCase().includes(query) || agent.username?.toLowerCase().includes(query);
  });

  const handleSelectRole = (role) => {
    setActiveRole(role);
    setSelectedAgent(null);
  };

  const handleNext = () => {
    if (!selectedAgent) return;
    navigation.navigate('ReleaseStockMethod', {
      recipient: {
        id: selectedAgent.id,
        fullName: selectedAgent.full_name,
        username: selectedAgent.username,
        role: selectedAgent.role,
        branchName: selectedAgent.branchName,
      },
      branchId: managerBranchIds[0],
    });
  };

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton
          backButtonText="Manager Dashboard"
          showDocumentIcon
          onDocumentPress={() => navigation.navigate('StockLogs')}
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
        />

        <SecondaryHeader height={56}>
          <View style={styles.titleRow}>
            <Text style={styles.pageTitle}>Give Out Stock</Text>
            <View style={styles.onlinePill}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Online</Text>
            </View>
          </View>
        </SecondaryHeader>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Stepper currentStep={1} labels={STEP_LABELS} />

          <View style={styles.roleRow}>
            {ROLE_TABS.map((tab) => {
              const isActive = tab.key === activeRole;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.roleCard, isActive && styles.roleCardActive]}
                  onPress={() => handleSelectRole(tab.key)}
                  activeOpacity={0.7}
                >
                  {isActive && (
                    <View style={styles.roleCheckBadge}>
                      <Icon name="checkmark" size={12} color="#FFFFFF" />
                    </View>
                  )}
                  <Icon name="person" size={22} color={isActive ? COLORS.primary : COLORS.textSecondary} />
                  <Text style={[styles.roleCardLabel, isActive && styles.roleCardLabelActive]}>{tab.label}</Text>
                  <Text style={styles.roleCardSubtitle}>({tab.subtitle})</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Input
            icon="search"
            placeholder="Search by name..."
            value={searchText}
            onChangeText={setSearchText}
          />

          {isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : visibleAgents.length === 0 ? (
            <Text style={styles.emptyText}>
              No {ROLE_TABS.find((t) => t.key === activeRole)?.label.toLowerCase()}s found for your branch.
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.agentRow}>
              {visibleAgents.map((agent) => {
                const isSelected = selectedAgent?.id === agent.id;
                return (
                  <TouchableOpacity
                    key={agent.id}
                    style={[styles.agentCard, isSelected && styles.agentCardSelected]}
                    onPress={() => setSelectedAgent(agent)}
                    activeOpacity={0.7}
                  >
                    {isSelected && (
                      <View style={styles.agentCheckBadge}>
                        <Icon name="checkmark" size={10} color="#FFFFFF" />
                      </View>
                    )}
                    <View style={styles.agentAvatar}>
                      <Text style={styles.agentAvatarText}>{getInitials(agent.full_name)}</Text>
                    </View>
                    <Text style={styles.agentRoleLabel}>
                      {activeRole === ROLES.SALES_REP ? 'Sales Rep' : 'Collector'}
                    </Text>
                    <Text style={styles.agentName} numberOfLines={2}>{agent.full_name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <View style={{ height: 24 }} />
        </ScrollView>

        <View style={styles.bottomBar}>
          <Button
            title="Next"
            icon="arrowRight"
            iconPosition="right"
            onPress={handleNext}
            disabled={!selectedAgent}
            variant="black"
            height={52}
          />
        </View>
      </View>
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
  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' },
  onlineText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.success,
  },
  content: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: 24 },
  roleRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm, marginBottom: SPACING.md },
  roleCard: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
  },
  roleCardActive: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.success + '10',
  },
  roleCheckBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleCardLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
  },
  roleCardLabelActive: { color: COLORS.primary },
  roleCardSubtitle: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  loadingWrap: { paddingVertical: SPACING.xl, alignItems: 'center' },
  emptyText: {
    marginTop: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  agentRow: { gap: SPACING.sm, paddingTop: SPACING.md, paddingRight: SPACING.sm },
  agentCard: {
    width: 92,
    alignItems: 'center',
    gap: 4,
    padding: SPACING.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
  },
  agentCardSelected: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.success + '10',
  },
  agentCheckBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  agentAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentAvatarText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.primary,
  },
  agentRoleLabel: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
  },
  agentName: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  bottomBar: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    backgroundColor: COLORS.background,
  },
});
