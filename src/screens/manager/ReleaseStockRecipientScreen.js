// src/screens/manager/ReleaseStockRecipientScreen.js
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BlurTargetView } from 'expo-blur';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import Header from '../../components/common/Header';
import useConnectionStatus from '../../hooks/useConnectionStatus';
import useOnlineLabel from '../../hooks/useOnlineLabel';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import LiveStatusPill from '../../components/common/LiveStatusPill';
import SectionHeader from '../../components/common/SectionHeader';
import Input from '../../components/common/Input';
import Icon from '../../components/common/Icon';
import UserAvatar from '../../components/common/UserAvatar';
import Stepper from '../../components/common/Stepper';
import Button from '../../components/common/Button';
import BranchSelector from '../../components/common/BranchSelector';
import BottomActionBar, { useBottomActionBarHeight } from '../../components/common/BottomActionBar';
import agentService from '../../services/agentService';
import authService from '../../services/authService';
import requestService from '../../services/requestService';
import { getInitials } from '../../utils/initials';
import { ROLES } from '../../constants/roles';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const STEP_LABELS = ['Who receives the stock?', 'How many items?', 'Final Proof'];

const ROLE_TABS = [
  { key: ROLES.SALES_REP, label: 'Sales Rep', subtitle: 'Receives it directly' },
  { key: ROLES.COLLECTOR, label: 'Collector', subtitle: 'Delivers it for you' },
];

// Same accent-per-role scheme as ManageAccountsScreen's agent role pill,
// so the two screens read consistently.
const ROLE_DOT_COLOR = {
  [ROLES.SALES_REP]: COLORS.accentOrange,
  [ROLES.COLLECTOR]: COLORS.accentPink,
};
const ROLE_BADGE_COLORS = {
  [ROLES.SALES_REP]: { bg: ROLE_DOT_COLOR[ROLES.SALES_REP] + '18', text: ROLE_DOT_COLOR[ROLES.SALES_REP] },
  [ROLES.COLLECTOR]: { bg: ROLE_DOT_COLOR[ROLES.COLLECTOR] + '18', text: ROLE_DOT_COLOR[ROLES.COLLECTOR] },
};

export default function ReleaseStockRecipientScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const connection = useConnectionStatus();
  const onlineLabel = useOnlineLabel();
  const blurTarget = useRef(null);
  // Set when this screen was reached via "Prepare" on a Sales Rep's stock
  // request (AgentStockRequestScreen) — pre-fills the requester as recipient
  // and skips the manual scan/quick-register choice entirely, since the
  // request already specifies exact products/quantities. Absent for the
  // normal manual Release Stock flow, which behaves exactly as before.
  const prefillRequest = route.params?.prefillRequest;
  const bottomActionBarHeight = useBottomActionBarHeight();
  const [manager, setManager] = useState(null);
  const [agents, setAgents] = useState([]);
  const [branches, setBranches] = useState([]);
  // A request is fulfilled from the branch it was sent to — the server
  // rejects the link otherwise — so that branch is fixed, not chosen.
  const [selectedBranchId, setSelectedBranchId] = useState(prefillRequest?.branchId || null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeRole, setActiveRole] = useState(ROLES.SALES_REP);
  const [searchText, setSearchText] = useState('');
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [selectedTargetRep, setSelectedTargetRep] = useState(null);

  // The two swipeable card rows slide the chosen person into view (a pick near the edge
  // used to stay half hidden).
  const agentScrollRef = useRef(null);
  const agentLayouts = useRef({});
  const targetScrollRef = useRef(null);
  const targetLayouts = useRef({});
  useEffect(() => {
    const layout = agentLayouts.current[selectedAgent?.id];
    if (layout) agentScrollRef.current?.scrollTo({ x: Math.max(0, layout.x - SPACING.md), animated: true });
  }, [selectedAgent]);
  useEffect(() => {
    const layout = targetLayouts.current[selectedTargetRep?.id];
    if (layout) targetScrollRef.current?.scrollTo({ x: Math.max(0, layout.x - SPACING.md), animated: true });
  }, [selectedTargetRep]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const [currentManager, result] = await Promise.all([
      authService.getCurrentUser(),
      agentService.getMyAgentAccounts(),
    ]);
    setManager(currentManager);
    setAgents(result.success ? result.data : []);

    const managerBranches = await requestService.getAgentBranches(currentManager?.branchIds || []);
    setBranches(managerBranches);
    // One branch is picked for the manager; several means they must choose,
    // same pattern as Receive Stock's "Receive into which branch?" (Figure 21).
    setSelectedBranchId((prev) => prev || (managerBranches.length === 1 ? managerBranches[0].id : prev));

    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const query = searchText.trim().toLowerCase();

  const isCollectorRole = activeRole === ROLES.COLLECTOR;

  // Once a branch is chosen, recipients are scoped to that branch
  // specifically — releasing from Branch A shouldn't offer an agent who
  // only belongs to Branch B as a recipient.
  const visibleAgents = agents.filter((agent) => {
    if (agent.role !== activeRole) return false;
    if (!selectedBranchId) return false;
    if (!(agent.branch_ids || []).includes(selectedBranchId)) return false;
    if (!query) return true;
    return agent.full_name?.toLowerCase().includes(query) || agent.username?.toLowerCase().includes(query);
  });

  // A Collector is a courier, not the final recipient — the proposal's own
  // remote-release flow (Figure 27) has the manager pick the collector AND
  // the target Sales Rep the collector is delivering to, in the same step.
  // Independent of the active role tab/search box above, since it's always
  // pulled from the Sales Rep pool, but still scoped to the chosen branch.
  const targetReps = agents.filter((agent) => {
    if (agent.role !== ROLES.SALES_REP) return false;
    if (!selectedBranchId) return false;
    return (agent.branch_ids || []).includes(selectedBranchId);
  });

  const prefillBranchName = branches.find((b) => b.id === prefillRequest?.branchId)?.name;

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
    profilePhotoUrl: agent.profilePhotoUrl,
  });

  const canProceed =
    !!selectedBranchId && (isCollectorRole ? !!selectedAgent && !!selectedTargetRep : !!selectedAgent);

  const handleNext = () => {
    if (!canProceed) return;
    const params = {
      recipient: toRecipientParam(selectedAgent),
      targetRecipient: isCollectorRole ? toRecipientParam(selectedTargetRep) : null,
      movementType: isCollectorRole ? 'collector' : 'direct',
      branchId: selectedBranchId,
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

        <SecondaryHeader height={76}>
          <View style={styles.titleRow}>
            <View style={styles.titleTextCol}>
              <Text style={styles.pageTitle} numberOfLines={1}>Give Out Stock</Text>
              <Text style={styles.pageSubtitle}>Choose who receives the stock</Text>
            </View>
            <LiveStatusPill pillStyle={styles.onlinePill} dotStyle={styles.onlineDot} textStyle={styles.onlineText} />
          </View>
        </SecondaryHeader>

        <BlurTargetView ref={blurTarget} style={styles.contentTarget}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomActionBarHeight + SPACING.md }]}
          showsVerticalScrollIndicator={false}
        >
          <Stepper currentStep={1} labels={STEP_LABELS} />

          {branches.length > 1 && !prefillRequest?.branchId && (
            <>
              <SectionHeader icon="building" size="md" label="Release from which branch?" style={styles.labelFirst} />
              <BranchSelector
                branches={branches}
                selectedId={selectedBranchId}
                onSelect={setSelectedBranchId}
                edgePadding={0}
                scrollable
                scrollBleed={SPACING.md}
              />
            </>
          )}

          {prefillRequest && (
            <View style={styles.prefillBanner}>
              <Icon name="checkCircle" size={16} color={COLORS.primary} weight="fill" />
              <Text style={styles.prefillBannerText}>
                Fulfilling stock request from {prefillRequest.requestedBy.fullName}
                {prefillBranchName ? ` · ${prefillBranchName}` : ''}
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
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                >
                  {isActive && (
                    <View style={styles.roleCheckBadge}>
                      <Icon name="checkmark" size={12} color="#FFFFFF" />
                    </View>
                  )}
                  <Icon
                    name={tab.key === ROLES.COLLECTOR ? 'truck' : 'person'}
                    size={24}
                    color={isActive ? COLORS.primary : COLORS.textSecondary}
                  />
                  <View style={styles.roleTextCol}>
                    <Text style={[styles.roleCardLabel, isActive && styles.roleCardLabelActive]}>{tab.label}</Text>
                    <Text style={styles.roleCardSubtitle} numberOfLines={2}>{tab.subtitle}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.searchWrap}>
            <Input
              icon="search"
              placeholder="Search by name..."
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>

          {!connection.online ? (
            <Text style={styles.emptyText}>
              You're offline. Releasing stock needs an internet connection — reconnect to continue.
            </Text>
          ) : isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : visibleAgents.length === 0 ? (
            <Text style={styles.emptyText}>
              No {ROLE_TABS.find((t) => t.key === activeRole)?.label.toLowerCase()}s found for your branch.
            </Text>
          ) : (
            <>
            <SectionHeader
              icon={activeRole === ROLES.COLLECTOR ? 'truck' : 'person'}
              size="md"
              label={`${activeRole === ROLES.COLLECTOR ? 'Collectors' : 'Sales Reps'} (${visibleAgents.length})`}
              style={styles.labelAfterSearch}
            />
            <ScrollView ref={agentScrollRef} horizontal showsHorizontalScrollIndicator={false} style={styles.agentScroll} contentContainerStyle={styles.agentRow}>
              {visibleAgents.map((agent) => {
                const isSelected = selectedAgent?.id === agent.id;
                return (
                  <TouchableOpacity
                    key={agent.id}
                    style={[styles.agentCard, isSelected && styles.agentCardSelected]}
                    onPress={() => setSelectedAgent(agent)}
                    onLayout={(event) => {
                      agentLayouts.current[agent.id] = event.nativeEvent.layout;
                    }}
                    activeOpacity={0.7}
                  >
                    {isSelected && (
                      <View style={styles.agentCheckBadge}>
                        <Icon name="checkmark" size={10} color="#FFFFFF" />
                      </View>
                    )}
                    <UserAvatar
                      photoUrl={agent.profilePhotoUrl}
                      fallbackText={getInitials(agent.full_name)}
                      size={40}
                      backgroundColor={COLORS.primaryLight}
                      fallbackTextColor={COLORS.primary}
                    />
                    <Text style={styles.agentName} numberOfLines={2}>{agent.full_name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            </>
          )}

          {isCollectorRole && selectedAgent && (
            <>
              <SectionHeader icon="package" size="md" label={`Deliver to which Sales Rep? (${targetReps.length})`} style={styles.labelSpaced} />
              {targetReps.length === 0 ? (
                <Text style={styles.emptyText}>No sales reps found for your branch.</Text>
              ) : (
                <ScrollView ref={targetScrollRef} horizontal showsHorizontalScrollIndicator={false} style={styles.agentScroll} contentContainerStyle={styles.agentRow}>
                  {targetReps.map((agent) => {
                    const isSelected = selectedTargetRep?.id === agent.id;
                    return (
                      <TouchableOpacity
                        key={agent.id}
                        style={[styles.agentCard, isSelected && styles.agentCardSelected]}
                        onPress={() => setSelectedTargetRep(agent)}
                        onLayout={(event) => {
                          targetLayouts.current[agent.id] = event.nativeEvent.layout;
                        }}
                        activeOpacity={0.7}
                      >
                        {isSelected && (
                          <View style={styles.agentCheckBadge}>
                            <Icon name="checkmark" size={10} color="#FFFFFF" />
                          </View>
                        )}
                        <UserAvatar
                          photoUrl={agent.profilePhotoUrl}
                          fallbackText={getInitials(agent.full_name)}
                          size={40}
                          backgroundColor={COLORS.primaryLight}
                          fallbackTextColor={COLORS.primary}
                        />
                        <Text style={styles.agentName} numberOfLines={2}>{agent.full_name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </>
          )}

          <View style={{ height: 8 }} />
        </ScrollView>
        </BlurTargetView>

        <BottomActionBar variant="glass" blurTarget={blurTarget}>
          <Button
            title={
              canProceed
                ? 'Next'
                : !selectedBranchId
                ? 'Choose a Branch'
                : !selectedAgent
                ? isCollectorRole
                  ? 'Pick a Collector'
                  : 'Pick a Sales Rep'
                : 'Pick the Sales Rep to Deliver To'
            }
            icon={canProceed ? 'arrowRight' : undefined}
            iconPosition="right"
            onPress={handleNext}
            disabled={!canProceed}
            variant="black"
            height={48}
            fontSize={16}
            borderRadius={24}
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
  onlineDotOffline: { backgroundColor: COLORS.warning },
  onlineTextOffline: { color: COLORS.warning },
  contentTarget: { flex: 1 },
  content: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: 24 },
  labelFirst: { marginTop: SPACING.md, marginBottom: 0 },
  labelSpaced: { marginTop: SPACING.md, marginBottom: 0 },
  labelAfterSearch: { marginTop: 0, marginBottom: 0 },
  titleTextCol: { flexShrink: 1, flex: 1 },
  pageSubtitle: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
    marginTop: SPACING.lg,
  },
  roleRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  roleCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: 64,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
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
  roleTextCol: { flex: 1 },
  roleCardSubtitle: {
    fontSize: 12,
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
  targetRepLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  targetRepLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  searchWrap: { marginTop: SPACING.md },
  // The rows of people swipe sideways and run to the screen edge.
  agentScroll: { marginHorizontal: -SPACING.md, marginTop: SPACING.sm },
  agentRow: { gap: SPACING.sm, paddingHorizontal: SPACING.md },
  agentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 150,
    maxWidth: 200,
    height: 64,
    gap: SPACING.sm,
    paddingLeft: SPACING.sm,
    paddingRight: SPACING.md,
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
  roleBadge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: 6,
  },
  agentRoleLabel: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    letterSpacing: 0.4,
  },
  agentName: {
    flexShrink: 1,
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textPrimary,
  },
});
