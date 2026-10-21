// src/screens/manager/TrackDeliveriesScreen.js
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import useCachedFocusLoader from '../../hooks/useCachedFocusLoader';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import LiveStatusPill from '../../components/common/LiveStatusPill';
import SectionHeader from '../../components/common/SectionHeader';
import UserAvatar from '../../components/common/UserAvatar';
import Icon from '../../components/common/Icon';
import authService from '../../services/authService';
import agentService from '../../services/agentService';
import inventoryService from '../../services/inventoryService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { formatRelativeTime } from '../../utils/formatters';
import { getInitials } from '../../utils/initials';

const STATUS_LABELS = { not_delivered: 'Pending', in_transit: 'In Transit', delivered: 'Delivered' };

// View-only filter over the deliveries already loaded.
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'in_transit', label: 'In transit' },
  { key: 'not_delivered', label: 'Pending' },
  { key: 'delivered', label: 'Delivered' },
];

function getStatusLabel(delivery) {
  return STATUS_LABELS[delivery.delivery_status] || STATUS_LABELS.not_delivered;
}

// Referenced lazily (called at render time, after `styles` below has been
// assigned) — safe despite appearing above the StyleSheet.create() call.
function getStatusPillStyle(status) {
  if (status === 'delivered') return styles.statusPillDelivered;
  if (status === 'in_transit') return styles.statusPillInTransit;
  return styles.statusPillPending;
}
function getStatusPillTextStyle(status) {
  if (status === 'delivered') return styles.statusPillTextDelivered;
  if (status === 'in_transit') return styles.statusPillTextInTransit;
  return styles.statusPillTextPending;
}

// Returns the full deliveries snapshot. If both sub-fetches failed (e.g.
// fully offline), keeps the previous snapshot entirely rather than blanking it.
const loadDeliveriesData = async (previous) => {
  const manager = await authService.getCurrentUser();
  const prev = previous?.managerId === manager?.id ? previous : null;
  const [deliveriesResult, agentsResult] = await Promise.all([
    inventoryService.getDeliveries(manager?.branchIds || []),
    agentService.getMyAgentAccounts(),
  ]);

  if (!deliveriesResult.success && !agentsResult.success && prev) {
    return prev;
  }

  return {
    managerId: manager?.id,
    deliveries: deliveriesResult.success ? deliveriesResult.data : prev?.deliveries ?? [],
    recipientNameById: agentsResult.success
      ? Object.fromEntries(agentsResult.data.map((a) => [a.id, a.full_name]))
      : prev?.recipientNameById ?? {},
    recipientPhotoById: agentsResult.success
      ? Object.fromEntries(agentsResult.data.map((a) => [a.id, a.profilePhotoUrl || null]))
      : prev?.recipientPhotoById ?? {},
  };
};

export default function TrackDeliveriesScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const focusId = route.params?.focusId || null;
  const { data: snapshot, isLoading, refreshControl } = useCachedFocusLoader('manager-track-deliveries', loadDeliveriesData);
  const deliveries = snapshot?.deliveries ?? [];
  const recipientNameById = snapshot?.recipientNameById ?? {};
  const recipientPhotoById = snapshot?.recipientPhotoById ?? {};
  const openedFocusIdRef = useRef(null);
  const [statusFilter, setStatusFilter] = useState('all');
  // A delivery with an unknown status counts as pending, the same as its label does.
  const statusOf = (delivery) => (STATUS_LABELS[delivery.delivery_status] ? delivery.delivery_status : 'not_delivered');
  const countFor = (key) => (key === 'all' ? deliveries.length : deliveries.filter((d) => statusOf(d) === key).length);
  const visibleDeliveries = statusFilter === 'all' ? deliveries : deliveries.filter((d) => statusOf(d) === statusFilter);

  useEffect(() => {
    if (!focusId) {
      openedFocusIdRef.current = null;
      return;
    }
    if (isLoading || openedFocusIdRef.current === focusId) return;
    const match = deliveries.find((delivery) => delivery.id === focusId);
    if (!match) return;

    openedFocusIdRef.current = focusId;
    const collectorName = recipientNameById[match.received_by] || 'Collector';
    const targetName = recipientNameById[match.target_recipient_id] || 'Sales Rep';
    // Swap this list for the detail, so Back returns to where the notification was tapped.
    navigation.replace('TrackDeliveryDetail', {
      delivery: match,
      collectorName,
      targetName,
      collectorPhotoUrl: recipientPhotoById[match.received_by] || null,
      targetPhotoUrl: recipientPhotoById[match.target_recipient_id] || null,
    });
  }, [focusId, isLoading, deliveries, recipientNameById, recipientPhotoById, navigation]);

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
        />
        <SecondaryHeader height={76}>
          <View style={styles.titleRow}>
            <View style={styles.titleTextCol}>
              <Text style={styles.pageTitle} numberOfLines={1}>Track Deliveries</Text>
              <Text style={styles.pageSubtitle}>Follow your team's deliveries</Text>
            </View>
            <LiveStatusPill pillStyle={styles.onlinePill} dotStyle={styles.onlineDot} textStyle={styles.onlineText} />
          </View>
        </SecondaryHeader>
        <TouchableOpacity style={styles.teamBar} onPress={() => navigation.navigate('TeamMap')} activeOpacity={0.8}>
          <Icon name="location" size={24} color="#0085F9" />
          <View style={styles.teamBarText}>
            <Text style={styles.teamBarTitle}>Team Locations</Text>
            <Text style={styles.teamBarSub}>Where your Sales Reps and Collectors were last seen</Text>
          </View>
          <Icon name="arrowRight" size={16} color="#0085F9" />
        </TouchableOpacity>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : deliveries.length === 0 ? (
          <View style={styles.loadingWrap}>
            <View style={styles.emptyIconCircle}>
              <Icon name="truck" size={28} color={COLORS.textSecondary} />
            </View>
            <Text style={styles.emptyText}>No collector deliveries yet.</Text>
            <Text style={styles.emptySubtext}>
              Releases made via a Collector (not a direct Sales Rep handover) will show up here.
            </Text>
          </View>
        ) : (
          <ScrollView
          refreshControl={refreshControl} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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

            <SectionHeader icon="truck" size="md" label={`Deliveries (${visibleDeliveries.length})`} style={styles.listLabel} />

            {visibleDeliveries.length === 0 && (
              <Text style={styles.noMatchText}>No {(STATUS_LABELS[statusFilter] || '').toLowerCase()} deliveries right now.</Text>
            )}

            {visibleDeliveries.map((delivery) => {
              const collectorName = recipientNameById[delivery.received_by] || 'Collector';
              const targetName = recipientNameById[delivery.target_recipient_id] || 'Sales Rep';
              return (
                <TouchableOpacity
                  key={delivery.id}
                  style={styles.deliveryCard}
                  onPress={() =>
                    navigation.navigate('TrackDeliveryDetail', {
                      delivery,
                      collectorName,
                      targetName,
                      collectorPhotoUrl: recipientPhotoById[delivery.received_by] || null,
                      targetPhotoUrl: recipientPhotoById[delivery.target_recipient_id] || null,
                    })
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.avatarPair}>
                    <UserAvatar
                      photoUrl={recipientPhotoById[delivery.received_by] || null}
                      fallbackText={getInitials(collectorName)}
                      size={32}
                      backgroundColor={COLORS.primaryLight}
                      fallbackTextColor={COLORS.primary}
                    />
                    <Icon name="arrowRight" size={14} color={COLORS.textSecondary} />
                    <UserAvatar
                      photoUrl={recipientPhotoById[delivery.target_recipient_id] || null}
                      fallbackText={getInitials(targetName)}
                      size={32}
                      backgroundColor={COLORS.primaryLight}
                      fallbackTextColor={COLORS.primary}
                    />
                  </View>
                  <View style={styles.deliveryTextCol}>
                    <Text style={styles.deliveryTitle}>
                      {collectorName} → {targetName}
                    </Text>
                    <View style={styles.deliveryMetaRow}>
                      <Icon name="clock" size={14} color={COLORS.textSecondary} />
                      <Text style={styles.deliveryMeta}>{formatRelativeTime(delivery.created_at)}</Text>
                      <View style={[styles.statusPill, getStatusPillStyle(delivery.delivery_status)]}>
                        <Text style={[styles.statusPillText, getStatusPillTextStyle(delivery.delivery_status)]}>
                          {getStatusLabel(delivery)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Icon name="arrowRight" size={16} color="#94a3b8" />
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 24 }} />
          </ScrollView>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
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
  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' },
  onlineText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.success,
  },
  teamBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dotted',
    borderColor: '#0085F9',
    backgroundColor: '#EAF4FF',
  },
  teamBarText: { flex: 1 },
  teamBarTitle: { fontSize: TYPOGRAPHY.fontSize.base, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', color: '#0085F9' },
  teamBarSub: { fontSize: TYPOGRAPHY.fontSize.sm, fontFamily: TYPOGRAPHY.fontFamily.regular, color: COLORS.textSecondary, marginTop: 1 },
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.xl },
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
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
  },
  filterPillTextActive: {
    color: '#0085F9',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  listLabel: { marginTop: SPACING.sm, marginBottom: 0 },
  noMatchText: {
    marginTop: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F3F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textSecondary,
  },
  emptySubtext: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  deliveryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    padding: SPACING.sm,
  },
  avatarPair: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deliveryTextCol: { flex: 1, gap: 6 },
  deliveryMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  deliveryTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  deliveryMeta: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusPillPending: { backgroundColor: '#FFF1D6' },
  statusPillInTransit: { backgroundColor: '#E3F2FF' },
  statusPillDelivered: { backgroundColor: '#EAFBF2' },
  statusPillText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  statusPillTextPending: { color: '#B26400' },
  statusPillTextInTransit: { color: COLORS.primary },
  statusPillTextDelivered: { color: '#1E7A3A' },
});
