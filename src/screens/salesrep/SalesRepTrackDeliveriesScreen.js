// src/screens/salesrep/SalesRepTrackDeliveriesScreen.js
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import useCachedFocusLoader from '../../hooks/useCachedFocusLoader';
import useOutbox from '../../hooks/useOutbox';
import { findQueuedReceipt, queuedHandoffStatus } from '../../utils/queuedReceipts';
import { SR_DELIVERIES_CACHE_KEY, loadDeliveriesData, isReceivable, confirmHandoffParams } from '../../utils/srDeliveries';
import DeliveryHandoffStatusBadge from '../../components/common/DeliveryHandoffStatusBadge';
import Header from '../../components/common/Header';
import SubScreenSecondaryHeader from '../../components/common/SubScreenSecondaryHeader';
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
        <SubScreenSecondaryHeader title="Track Deliveries" />

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : deliveries.length === 0 ? (
          <View style={styles.loadingWrap}>
            <Icon name="truck" size={32} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>
              {filterPending ? 'No pending collector deliveries right now.' : 'No incoming deliveries yet.'}
            </Text>
            <Text style={styles.emptySubtext}>
              {filterPending
                ? 'Deliveries on the way to you, or delivered and waiting for you, appear here for you to receive.'
                : 'Stock your manager releases via a Collector will show up here.'}
            </Text>
            {filterPending && (
              <TouchableOpacity
                style={styles.scanFallbackButton}
                onPress={() => setIsScannerVisible(true)}
                activeOpacity={0.8}
              >
                <Icon name="qrCode" size={18} color="#FFFFFF" />
                <Text style={styles.scanFallbackText}>Scan a QR</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <ScrollView
          refreshControl={refreshControl} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {deliveries.map((delivery) => {
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
                      From: {delivery.collectorName || 'Collector'}
                    </Text>
                    <Text style={styles.deliveryMeta}>{formatRelativeTime(delivery.createdAt)}</Text>
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
  content: { padding: SPACING.lg, gap: SPACING.sm },
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
  scanFallbackButton: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  scanFallbackText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
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
    width: 36,
    height: 36,
    borderRadius: 18,
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
    fontSize: TYPOGRAPHY.fontSize.sm,
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
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  statusPillTextPending: { color: '#B26400' },
  statusPillTextInTransit: { color: COLORS.primary },
  statusPillTextDelivered: { color: '#1E7A3A' },
});
