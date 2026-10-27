// src/screens/salesrep/SalesRepTrackDeliveriesScreen.js
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import Alert from '../../utils/appAlert';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import useCachedFocusLoader from '../../hooks/useCachedFocusLoader';
import useOutbox from '../../hooks/useOutbox';
import { findQueuedReceipt, queuedHandoffStatus } from '../../utils/queuedReceipts';
import { SR_DELIVERIES_CACHE_KEY, loadDeliveriesData, isReceivable, confirmHandoffParams } from '../../utils/srDeliveries';
import DeliveryHandoffStatusBadge from '../../components/common/DeliveryHandoffStatusBadge';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import LiveStatusPill from '../../components/common/LiveStatusPill';
import SectionHeader from '../../components/common/SectionHeader';
import Icon from '../../components/common/Icon';
import QRScannerModal from '../../components/common/QRScannerModal';
import authService from '../../services/authService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { formatRelativeTime } from '../../utils/formatters';
import { routeQrScan } from '../../utils/routeQrScan';
import friendlyError from '../../utils/friendlyError';

const STATUS_LABELS = { not_delivered: 'Pending', in_transit: 'In Transit', delivered: 'Delivered' };

function getStatusLabel(delivery) {
  return STATUS_LABELS[delivery.deliveryStatus] || STATUS_LABELS.not_delivered;
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

export default function SalesRepTrackDeliveriesScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const filterPending = route.params?.filterPending === true;
  const { data: snapshot, isLoading, refreshControl } = useCachedFocusLoader(SR_DELIVERIES_CACHE_KEY, loadDeliveriesData);
  // A delivery confirmed offline on this phone shows as such until it syncs.
  const { pending: queuedEntries } = useOutbox();
  const allDeliveries = (snapshot?.deliveries ?? []).map((delivery) => {
    if (delivery.handoffStatus === 'confirmed') return delivery;
    const queued = findQueuedReceipt(
      { transactionId: delivery.transactionId, qrCode: delivery.qrCode },
      snapshot?.agentId,
      queuedEntries
    );
    return queued ? { ...delivery, handoffStatus: queuedHandoffStatus(queued), isQueued: true } : delivery;
  });
  const deliveries = filterPending ? allDeliveries.filter(isReceivable) : allDeliveries;
  // View-only filter over what is already loaded.
  const [statusFilter, setStatusFilter] = useState('all');
  const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'delivered', label: 'Delivered' },
  ];
  const isDeliveredRow = (d) => d.deliveryStatus === 'delivered';
  const countFor = (key) =>
    key === 'all' ? deliveries.length : deliveries.filter((d) => (key === 'delivered' ? isDeliveredRow(d) : !isDeliveredRow(d))).length;
  const visibleDeliveries =
    statusFilter === 'all' ? deliveries : deliveries.filter((d) => (statusFilter === 'delivered' ? isDeliveredRow(d) : !isDeliveredRow(d)));

  // Tapped from a notification about one delivery: open it the way tapping its card does,
  // swapping this list out so Back returns to the notifications.
  const focusTransactionId = route.params?.transactionId || null;
  const openedFocusRef = useRef(null);
  useEffect(() => {
    if (!focusTransactionId || isLoading || openedFocusRef.current === focusTransactionId) return;
    const match = allDeliveries.find((d) => d.transactionId === focusTransactionId);
    if (!match) return;
    openedFocusRef.current = focusTransactionId;
    const canReceive = !match.isQueued && isReceivable(match);
    if (canReceive) navigation.replace('SalesRepConfirmHandoff', confirmHandoffParams(match));
    else navigation.replace('SalesRepDeliveryDetail', { delivery: match });
  }, [focusTransactionId, isLoading, allDeliveries.length]);
  const handleScanned = async (qrCode) => {
    setIsScannerVisible(false);
    try {
      const agent = await authService.getCurrentUser();
      await routeQrScan({ qrCode, agentId: agent?.id, navigation });
    } catch (error) {
      Alert.alert('Unable to Verify QR', friendlyError(error.message) || 'Please try again.');
    }
  };

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton
          backButtonText="Sales Rep Dashboard"
          height={56}
          backgroundColor={COLORS.primary}
          textColor="#FFFFFF"
        />
        <SecondaryHeader height={76}>
          <View style={styles.titleRow}>
            <View style={styles.titleTextCol}>
              <Text style={styles.pageTitle} numberOfLines={1}>Track Deliveries</Text>
              <Text style={styles.pageSubtitle}>Stock on its way to you</Text>
            </View>
            <LiveStatusPill pillStyle={styles.onlinePill} dotStyle={styles.onlineDot} textStyle={styles.onlineText} />
          </View>
        </SecondaryHeader>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : deliveries.length === 0 ? (
          <ScrollView
            contentContainerStyle={styles.emptyScrollContent}
            refreshControl={refreshControl}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Icon name="truck" size={30} color={COLORS.primary} />
              </View>
              <Text style={styles.emptyEyebrow}>DELIVERIES</Text>
              <Text style={styles.emptyText}>
                {filterPending ? 'Nothing to receive yet' : 'No deliveries yet'}
              </Text>
              <Text style={styles.emptySubtext}>
                {filterPending
                  ? 'New collector deliveries will appear here. Have a release QR? Scan it to receive stock.'
                  : 'Stock released to you through a collector will appear here.'}
              </Text>
              {filterPending && (
                <TouchableOpacity
                  style={styles.scanFallbackButton}
                  onPress={() => setIsScannerVisible(true)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Scan a stock release QR code"
                >
                  <Icon name="qrCode" size={18} color="#FFFFFF" />
                  <Text style={styles.scanFallbackText}>Scan release QR</Text>
                  <Icon name="arrowRight" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        ) : (
          <ScrollView
          refreshControl={refreshControl} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
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
            {visibleDeliveries.map((delivery) => {
              const isDelivered = delivery.deliveryStatus === 'delivered';
              const canReceive = !delivery.isQueued && isReceivable(delivery);
              const badgeStatus = delivery.isQueued
                ? delivery.handoffStatus
                : canReceive
                  ? isDelivered ? 'pending_sr' : 'awaiting_collector'
                  : null;
              return (
                <TouchableOpacity
                  key={delivery.transactionId}
                  style={styles.deliveryCard}
                  onPress={() =>
                    canReceive
                      ? navigation.navigate('SalesRepConfirmHandoff', confirmHandoffParams(delivery))
                      : navigation.navigate('SalesRepDeliveryDetail', { delivery })
                  }
                  activeOpacity={0.7}
                >
                  <View style={[styles.deliveryIconBadge, isDelivered && styles.deliveryIconBadgeDelivered]}>
                    <Icon name="truck" size={18} color={isDelivered ? COLORS.success : COLORS.iconTrackStroke} />
                  </View>
                  <View style={styles.deliveryTextCol}>
                    <Text style={styles.deliveryTitle} numberOfLines={1}>
                      {delivery.collectorName || 'Collector'}
                    </Text>
                    <Text style={styles.deliveryMeta}>Collector · {formatRelativeTime(delivery.createdAt)}</Text>
                    {!!badgeStatus && (
                      <View style={styles.handoffBadgeWrap}>
                        <DeliveryHandoffStatusBadge status={badgeStatus} />
                      </View>
                    )}
                  </View>
                  {!(isDelivered && badgeStatus === 'pending_sr') && (
                    <View style={[styles.statusPill, getStatusPillStyle(delivery.deliveryStatus)]}>
                      <Text style={[styles.statusPillText, getStatusPillTextStyle(delivery.deliveryStatus)]}>
                        {getStatusLabel(delivery)}
                      </Text>
                    </View>
                  )}
                  <Icon name="arrowRight" size={16} color="#94a3b8" />
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 24 }} />
          </ScrollView>
        )}
      </View>
      <QRScannerModal
        visible={isScannerVisible}
        onClose={() => setIsScannerVisible(false)}
        onScanned={handleScanned}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.xl },
  emptyScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: 16,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
    marginBottom: SPACING.md,
  },
  emptyEyebrow: {
    color: COLORS.primary,
    fontSize: 10,
    letterSpacing: 1.1,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    marginBottom: SPACING.xs,
  },
  content: { padding: SPACING.lg, gap: SPACING.sm },
  titleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md },
  titleTextCol: { flexShrink: 1, flex: 1 },
  pageTitle: { fontSize: TYPOGRAPHY.fontSize.lg, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: TYPOGRAPHY.fontWeight.bold, color: '#272632' },
  pageSubtitle: { marginTop: 2, fontSize: TYPOGRAPHY.fontSize.xs, fontFamily: TYPOGRAPHY.fontFamily.regular, color: COLORS.textSecondary },
  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' },
  onlineText: { fontSize: TYPOGRAPHY.fontSize.xs, fontFamily: TYPOGRAPHY.fontFamily.medium, color: COLORS.success },
  filterScroll: { marginHorizontal: -SPACING.lg },
  filterRow: { paddingHorizontal: SPACING.lg, gap: SPACING.sm },
  filterPill: { height: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5, borderColor: '#D5DAE3', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  filterPillActive: { borderColor: '#0085F9', backgroundColor: '#EAF4FF' },
  filterPillText: { fontSize: TYPOGRAPHY.fontSize.sm, fontFamily: TYPOGRAPHY.fontFamily.medium, color: COLORS.textSecondary },
  filterPillTextActive: { color: '#0085F9', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  listLabel: { marginTop: SPACING.sm, marginBottom: 0 },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: SPACING.sm,
  },
  scanFallbackButton: {
    alignSelf: 'stretch',
    marginTop: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
  },
  scanFallbackText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
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
  deliveryIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.iconTrackFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveryIconBadgeDelivered: {
    backgroundColor: COLORS.success + '15',
  },
  deliveryTextCol: { flex: 1 },
  handoffBadgeWrap: { marginTop: 6 },
  deliveryTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  deliveryMeta: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
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
