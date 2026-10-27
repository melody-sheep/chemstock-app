// src/screens/manager/AgentStockRequestScreen.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import Alert from '../../utils/appAlert';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import LiveStatusPill from '../../components/common/LiveStatusPill';
import SectionHeader from '../../components/common/SectionHeader';
import UserAvatar from '../../components/common/UserAvatar';
import Icon from '../../components/common/Icon';
import Button from '../../components/common/Button';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import requestService from '../../services/requestService';
import agentService from '../../services/agentService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { formatRelativeTime } from '../../utils/formatters';
import { getInitials } from '../../utils/initials';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import friendlyError from '../../utils/friendlyError';

// The DB only ever tracks 3 statuses (pending/accepted/declined) —
// fulfilled_transaction_id is what actually answers "did the release
// complete," so the 4th display state ("Fulfilled") is derived here rather
// than stored, per the reviewed design (see 2026-08-24_stock_requests.sql).
function getDisplayStatus(request) {
  if (request.status === 'accepted' && request.fulfilledTransactionId) return 'fulfilled';
  if (request.status === 'accepted') return 'preparing';
  return request.status;
}

const STATUS_META = {
  pending: { label: 'Pending', bg: '#FFF1D6', text: '#B26400' },
  preparing: { label: 'Preparing', bg: '#E3F2FF', text: '#0085F9' },
  fulfilled: { label: 'Fulfilled', bg: '#EAFBF2', text: '#1E7A3A' },
  declined: { label: 'Declined', bg: '#FBDCDC', text: '#B91C1C' },
};

export default function AgentStockRequestScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const focusId = route.params?.focusId || null;
  const scrollRef = useRef(null);
  const cardYRef = useRef({});
  const [highlightedId, setHighlightedId] = useState(null);
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyRequestId, setBusyRequestId] = useState(null);
  const [declineTarget, setDeclineTarget] = useState(null);
  // View-only filter over the requests already loaded.
  const [statusFilter, setStatusFilter] = useState('all');
  // Profile photos by agent id (a read of the manager's own agents; the cards just show initials without it).
  const [photoUrlByAgentId, setPhotoUrlByAgentId] = useState({});

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    const result = await requestService.getBranchStockRequests(50);
    setRequests(result.success ? result.data : []);
    setIsLoading(false);
    try {
      const agents = await agentService.getMyAgentAccounts();
      if (agents.success) {
        setPhotoUrlByAgentId(Object.fromEntries(agents.data.map((a) => [a.id, a.profilePhotoUrl])));
      }
    } catch (error) {
      // No photos: the cards keep showing initials.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [loadRequests])
  );

  const buildPrefillRequest = (request) => ({
    requestId: request.requestId,
    branchId: request.branchId,
    requestedBy: { id: request.requestedById, fullName: request.requestedByName },
    items: request.items || [],
  });

  const handlePrepare = async (request) => {
    if (busyRequestId) return;
    setBusyRequestId(request.requestId);

    const result = await requestService.acceptStockRequest(request.requestId);
    setBusyRequestId(null);

    if (!result.success) {
      Alert.alert('Failed to Accept Request', friendlyError(result.message) || 'Please try again.');
      return;
    }

    navigation.navigate('ReleaseStockRecipient', { prefillRequest: buildPrefillRequest(request) });
  };

  // Request is already 'accepted' (shown as "Preparing") from an earlier
  // Prepare tap — the manager backed out of Release Stock before finishing
  // it. accept_stock_request only allows 'pending' -> 'accepted', so it
  // can't be called again here; just re-enter the same flow where they left off.
  const handleContinue = (request) => {
    navigation.navigate('ReleaseStockRecipient', { prefillRequest: buildPrefillRequest(request) });
  };

  const confirmDecline = async () => {
    if (!declineTarget) return;
    setBusyRequestId(declineTarget.requestId);
    const result = await requestService.declineStockRequest(declineTarget.requestId, null);
    setBusyRequestId(null);
    setDeclineTarget(null);

    if (!result.success) {
      Alert.alert('Failed to Decline Request', friendlyError(result.message) || 'Please try again.');
      return;
    }
    loadRequests();
  };

  // Opens the release this request was fulfilled with. The Logs screen shows that one log's
  // detail; if it can't find it, it simply shows the list as before.
  const handleViewLogs = (request) => {
    navigation.navigate('StockLogs', request?.fulfilledTransactionId ? { openTransactionId: request.fulfilledTransactionId } : undefined);
  };

  // Tapped from a notification: show that request's tab, scroll to it and mark it.
  useEffect(() => {
    if (!focusId || isLoading) return;
    const match = requests.find((r) => r.requestId === focusId);
    if (!match) return;
    setStatusFilter(getDisplayStatus(match));
    setHighlightedId(focusId);
    const timer = setTimeout(() => {
      const y = cardYRef.current[focusId];
      if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 80), animated: true });
    }, 350);
    const fade = setTimeout(() => setHighlightedId(null), 4000);
    return () => {
      clearTimeout(timer);
      clearTimeout(fade);
    };
  }, [focusId, isLoading, requests]);

  const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'preparing', label: 'Preparing' },
    { key: 'fulfilled', label: 'Fulfilled' },
    { key: 'declined', label: 'Declined' },
  ];
  const countFor = (key) => (key === 'all' ? requests.length : requests.filter((r) => getDisplayStatus(r) === key).length);
  const visibleRequests = statusFilter === 'all' ? requests : requests.filter((r) => getDisplayStatus(r) === statusFilter);
  const imageFor = (code) => PRODUCT_CATALOG.find((p) => p.code === code)?.image;

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
              <Text style={styles.pageTitle} numberOfLines={1}>Agent Stock Request</Text>
              <Text style={styles.pageSubtitle}>Review what your Sales Reps asked for</Text>
            </View>
            <LiveStatusPill pillStyle={styles.onlinePill} dotStyle={styles.onlineDot} textStyle={styles.onlineText} />
          </View>
        </SecondaryHeader>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : requests.length === 0 ? (
          <View style={styles.loadingWrap}>
            <View style={styles.emptyIconCircle}>
              <Icon name="peopleGroup" size={28} color={COLORS.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>No stock requests yet</Text>
            <Text style={styles.emptyText}>Requests from your Sales Reps show up here.</Text>
          </View>
        ) : (
          <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroll}
              contentContainerStyle={styles.filterRow}
            >
              {FILTERS.map((filter) => {
                const isActive = filter.key === statusFilter;
                return (
                  <TouchableOpacity
                    key={filter.key}
                    style={[styles.filterPill, isActive && styles.filterPillActive]}
                    onPress={() => setStatusFilter(filter.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                      {filter.label} ({countFor(filter.key)})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <SectionHeader icon="peopleGroup" size="md" label={`Requests (${visibleRequests.length})`} style={styles.listLabel} />

            {visibleRequests.length === 0 && (
              <Text style={styles.noMatchText}>No {statusFilter} requests right now.</Text>
            )}

            {visibleRequests.map((request) => {
              const displayStatus = getDisplayStatus(request);
              const meta = STATUS_META[displayStatus];
              const isBusy = busyRequestId === request.requestId;

              return (
                <View
                  key={request.requestId}
                  onLayout={(event) => {
                    cardYRef.current[request.requestId] = event.nativeEvent.layout.y;
                  }}
                  style={[styles.requestCard, { borderLeftColor: meta.text }, highlightedId === request.requestId && styles.requestCardHighlight]}
                >
                  <View style={styles.requestHeaderRow}>
                    <UserAvatar
                      photoUrl={photoUrlByAgentId[request.requestedById]}
                      fallbackText={getInitials(request.requestedByName)}
                      size={40}
                      backgroundColor={COLORS.primaryLight}
                      fallbackTextColor={COLORS.primary}
                    />
                    <View style={styles.requestHeaderText}>
                      <Text style={styles.requestName} numberOfLines={1}>{request.requestedByName}</Text>
                      <Text style={styles.requestMeta}>
                        Sales Rep · Sent {formatRelativeTime(request.createdAt)}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: meta.text }]}>{meta.label}</Text>
                    </View>
                  </View>

                  <View style={styles.itemsList}>
                    {(request.items || []).map((item, index) => {
                      const image = imageFor(item.productCode) || imageFor(item.productName);
                      return (
                        <View key={`${item.productCode}-${index}`} style={styles.itemRow}>
                          <View style={styles.itemThumb}>
                            {image ? (
                              <Image source={image} style={styles.itemImage} resizeMode="contain" />
                            ) : (
                              <Icon name="boxPackage" size={18} />
                            )}
                          </View>
                          <Text style={styles.itemText} numberOfLines={1}>{item.productName}</Text>
                          <View style={styles.qtyChip}>
                            <Text style={styles.qtyChipText}>{item.quantity} pcs</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>

                  <Text style={styles.requestId}>Request #{request.requestId.slice(0, 8).toUpperCase()}</Text>

                  {displayStatus === 'declined' && request.declineReason && (
                    <View style={styles.reasonBox}>
                      <Icon name="warningTriangle" size={14} color={COLORS.error} />
                      <Text style={styles.declineReasonText}>{request.declineReason}</Text>
                    </View>
                  )}

                  {(displayStatus === 'pending' || displayStatus === 'preparing') && (
                    <View style={styles.actionRow}>
                      <Button
                        title="Decline"
                        variant="outline"
                        accentColor={COLORS.error}
                        onPress={() => setDeclineTarget(request)}
                        disabled={isBusy}
                        style={styles.actionButton}
                        height={44}
                        fontSize={15}
                        borderRadius={22}
                        hasShadow={false}
                      />
                      {displayStatus === 'pending' && (
                        <Button
                          title={isBusy ? 'Preparing…' : 'Prepare'}
                          variant="black"
                          onPress={() => handlePrepare(request)}
                          loading={isBusy}
                          disabled={isBusy}
                          style={styles.actionButton}
                          height={44}
                          fontSize={15}
                          borderRadius={22}
                        />
                      )}
                      {displayStatus === 'preparing' && (
                        <Button
                          title="Continue"
                          variant="black"
                          onPress={() => handleContinue(request)}
                          disabled={isBusy}
                          style={styles.actionButton}
                          height={44}
                          fontSize={15}
                          borderRadius={22}
                        />
                      )}
                    </View>
                  )}

                  {displayStatus === 'fulfilled' && (
                    <Button
                      title="View release log"
                      variant="outline"
                      accentColor="#2E9E5B"
                      icon="document"
                      iconSize={16}
                      onPress={() => handleViewLogs(request)}
                      style={styles.viewLogsButton}
                      width="100%"
                      height={44}
                      fontSize={15}
                      borderRadius={22}
                      hasShadow={false}
                    />
                  )}
                </View>
              );
            })}
            <View style={{ height: 24 }} />
          </ScrollView>
        )}
      </View>

      <ConfirmationDialog
        visible={!!declineTarget}
        onCancel={() => setDeclineTarget(null)}
        onConfirm={confirmDecline}
        icon="xCircle"
        title="Decline Request"
        description={`This will decline ${declineTarget?.requestedByName || 'this'}'s stock request. This can't be undone.`}
        confirmLabel="Decline"
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
    color: COLORS.textSecondary,
  },
  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' },
  onlineText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.success,
  },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F3F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  content: { padding: SPACING.lg, gap: SPACING.sm },
  filterScroll: { marginHorizontal: -SPACING.lg },
  filterRow: { paddingHorizontal: SPACING.lg, gap: SPACING.sm },
  filterPill: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#D5DAE3',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillActive: { borderColor: '#0085F9', backgroundColor: '#EAF4FF' },
  filterPillText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: COLORS.textSecondary,
  },
  filterPillTextActive: { color: '#0085F9', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  listLabel: { marginTop: SPACING.sm, marginBottom: 0 },
  noMatchText: { marginTop: SPACING.sm, fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.textSecondary },
  // The coloured left edge follows the request's status.
  requestCard: {
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  requestCardHighlight: { borderColor: '#0085F9', backgroundColor: '#F1F7FF' },
  requestHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  requestHeaderText: { flex: 1 },
  requestName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeText: { fontSize: 11, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: TYPOGRAPHY.fontWeight.bold },
  requestMeta: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  itemsList: { gap: 6 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  itemThumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  itemImage: { width: '100%', height: '100%' },
  itemText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  qtyChip: { borderRadius: 2, backgroundColor: '#0085F9', paddingHorizontal: 8, height: 24, justifyContent: 'center' },
  qtyChipText: { fontSize: 12, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', color: '#FFFFFF' },
  requestId: { fontSize: 11, color: COLORS.textTertiary, fontFamily: TYPOGRAPHY.fontFamily.regular },
  reasonBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: SPACING.sm,
    borderRadius: 8,
    backgroundColor: '#FDECEC',
  },
  declineReasonText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: COLORS.error,
  },
  actionRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: 2 },
  actionButton: { flex: 1 },
  viewLogsButton: { marginTop: 2 },
});
