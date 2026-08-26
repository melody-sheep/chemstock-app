// src/screens/manager/ReleaseStockRecipientScreen.js
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import Input from '../../components/common/Input';
import Icon from '../../components/common/Icon';
import Stepper from '../../components/common/Stepper';
import Button from '../../components/common/Button';
import BottomActionBar, { useBottomActionBarHeight } from '../../components/common/BottomActionBar';
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
  const route = useRoute();
  // Set when this screen was reached via "Prepare" on a Sales Rep's stock
  // request (AgentStockRequestScreen) — pre-fills the requester as recipient
  // and skips the manual scan/quick-register choice entirely, since the
  // request already specifies exact products/quantities. Absent for the
  // normal manual Release Stock flow, which behaves exactly as before.
  const prefillRequest = route.params?.prefillRequest;
  const bottomActionBarHeight = useBottomActionBarHeight();
  const [manager, setManager] = useState(null);
  const [agents, setAgents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeRole, setActiveRole] = useState(ROLES.SALES_REP);
  const [searchText, setSearchText] = useState('');
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [selectedTargetRep, setSelectedTargetRep] = useState(null);

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

  const isCollectorRole = activeRole === ROLES.COLLECTOR;

  const visibleAgents = agents.filter((agent) => {
    if (agent.role !== activeRole) return false;
    const sharesBranch = (agent.branch_ids || []).some((id) => managerBranchIds.includes(id));
    if (!sharesBranch) return false;
    if (!query) return true;
    return agent.full_name?.toLowerCase().includes(query) || agent.username?.toLowerCase().includes(query);
  });

  // A Collector is a courier, not the final recipient — the proposal's own
  // remote-release flow (Figure 27) has the manager pick the collector AND
  // the target Sales Rep the collector is delivering to, in the same step.
  // Independent of the active role tab/search box above, since it's always
  // pulled from the Sales Rep pool.
  const targetReps = agents.filter((agent) => {
    if (agent.role !== ROLES.SALES_REP) return false;
    return (agent.branch_ids || []).some((id) => managerBranchIds.includes(id));
  });

  const prefillAgent = prefillRequest
    ? agents.find((a) => a.id === prefillRequest.requestedBy.id) || null
    : null;

  // Runs once the agent list has loaded — pre-selects the requesting rep in
  // whatever slot matches the currently-active role tab (defaults to Sales
  // Rep, matching the requester's own role).
  useEffect(() => {
    if (!prefillRequest || !prefillAgent) return;
    if (activeRole === ROLES.SALES_REP && !selectedAgent) {
      setSelectedAgent(prefillAgent);
    } else if (activeRole === ROLES.COLLECTOR && !selectedTargetRep) {
      setSelectedTargetRep(prefillAgent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillAgent, activeRole]);

  const handleSelectRole = (role) => {
    setActiveRole(role);
    if (role === ROLES.SALES_REP) {
      setSelectedAgent(prefillRequest ? prefillAgent : null);
      setSelectedTargetRep(null);
    } else {
      setSelectedAgent(null);
      setSelectedTargetRep(prefillRequest ? prefillAgent : null);
    }
  };

  const toRecipientParam = (agent) => ({
    id: agent.id,
    fullName: agent.full_name,
    username: agent.username,
    role: agent.role,
    branchName: agent.branchName,
  });

  const canProceed = isCollectorRole ? !!selectedAgent && !!selectedTargetRep : !!selectedAgent;

  const handleNext = () => {
    if (!canProceed) return;
    const params = {
      recipient: toRecipientParam(selectedAgent),
      targetRecipient: isCollectorRole ? toRecipientParam(selectedTargetRep) : null,
      movementType: isCollectorRole ? 'collector' : 'direct',
      branchId: managerBranchIds[0],
    };

    if (prefillRequest) {
      navigation.navigate('ReleaseStockRequestReview', {
        ...params,
        requestId: prefillRequest.requestId,
        requestedItems: prefillRequest.items,
      });
    } else {
      navigation.navigate('ReleaseStockMethod', params);
    }
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

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomActionBarHeight + SPACING.md }]}
          showsVerticalScrollIndicator={false}
        >
          <Stepper currentStep={1} labels={STEP_LABELS} />

          {prefillRequest && (
            <View style={styles.prefillBanner}>
              <Icon name="checkCircle" size={16} color={COLORS.primary} weight="fill" />
              <Text style={styles.prefillBannerText}>
                Fulfilling stock request from {prefillRequest.requestedBy.fullName}
              </Text>
            </View>
          )}

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
                  <Icon
                    name={tab.key === ROLES.COLLECTOR ? 'truck' : 'person'}
                    size={22}
                    color={isActive ? COLORS.primary : COLORS.textSecondary}
                  />
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

          {isCollectorRole && selectedAgent && (
            <>
              <Text style={styles.targetRepLabel}>Deliver to (Sales Rep)</Text>
              {targetReps.length === 0 ? (
                <Text style={styles.emptyText}>No sales reps found for your branch.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.agentRow}>
                  {targetReps.map((agent) => {
                    const isSelected = selectedTargetRep?.id === agent.id;
                    return (
                      <TouchableOpacity
                        key={agent.id}
                        style={[styles.agentCard, isSelected && styles.agentCardSelected]}
                        onPress={() => setSelectedTargetRep(agent)}
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
                        <Text style={styles.agentRoleLabel}>Sales Rep</Text>
                        <Text style={styles.agentName} numberOfLines={2}>{agent.full_name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </>
          )}

          <View style={{ height: 24 }} />
        </ScrollView>

        <BottomActionBar>
          <Button
            title="Next"
            icon="arrowRight"
            iconPosition="right"
            onPress={handleNext}
            disabled={!canProceed}
            variant="black"
          />
        </BottomActionBar>
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
  content: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: 24 },
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
  prefillBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.sm,
    borderRadius: 10,
    backgroundColor: COLORS.primary + '12',
    marginTop: SPACING.sm,
  },
  prefillBannerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.primary,
  },
  loadingWrap: { paddingVertical: SPACING.xl, alignItems: 'center' },
  emptyText: {
    marginTop: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  targetRepLabel: {
    marginTop: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
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
});
