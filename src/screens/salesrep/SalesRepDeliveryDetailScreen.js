// src/screens/salesrep/SalesRepDeliveryDetailScreen.js
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Header from '../../components/common/Header';
import SubScreenSecondaryHeader from '../../components/common/SubScreenSecondaryHeader';
import Icon from '../../components/common/Icon';
import StaticRouteMap from '../../components/common/StaticRouteMap';
import DeliveryTimeline from '../../components/common/DeliveryTimeline';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const STATUS_LABELS = { not_delivered: 'Pending', in_transit: 'In Transit', delivered: 'Delivered' };

function getStatusLabel(delivery) {
  return STATUS_LABELS[delivery.deliveryStatus] || STATUS_LABELS.not_delivered;
}

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

// "Current Location" breadcrumb — the release moment (when the Collector's
// involvement began) plus every checkpoint they've since logged, oldest
// first. `checkpoints` comes from get_my_deliveries already ascending.
function getTimelineEntries(delivery) {
  return [
    { key: 'origin', label: 'Picked up by Collector', createdAt: delivery.createdAt },
    ...(delivery.checkpoints || []).map((cp, index) => ({ key: `cp-${index}`, label: cp.label, createdAt: cp.createdAt })),
  ];
}

/**
 * SalesRepDeliveryDetailScreen - full-screen, hand-pannable/zoomable map
 * (same treatment as CollectorDeliverStockScreen) with the delivery's
 * status/legend floating over the top and a scrollable bottom sheet
 * (Delivered By, Items, Current Location) floating over the bottom —
 * the map itself stays interactive everywhere else on screen.
 */
export default function SalesRepDeliveryDetailScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const { delivery } = route.params || {};

  if (!delivery) {
    return (
      <View style={styles.screen}>
        <StatusBar style="light" />
        <Header showBackButton height={56} backgroundColor={COLORS.primary} textColor="#FFFFFF" />
        <SubScreenSecondaryHeader title="Delivery Details" syncStatus="online" />
        <View style={styles.loadingWrap}>
          <Text style={styles.emptyText}>Delivery not found.</Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <Header
          showBackButton
          backButtonText="Track Deliveries"
          height={56}
          backgroundColor={COLORS.primary}
          textColor="#FFFFFF"
          onBackPress={() => navigation.goBack()}
        />
        <SubScreenSecondaryHeader title="Delivery Details" syncStatus="online" />

        <View style={styles.mapWrap}>
          <StaticRouteMap
            fill
            originCoords={delivery.originGps}
            destinationCoords={delivery.destinationGps}
            lastCheckpoint={delivery.lastCheckpoint}
            style={styles.mapFill}
            showZoomControl
            showScale
          />

          <View style={styles.topOverlayRow} pointerEvents="box-none">
            <View style={styles.legendPill}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#0085F9' }]} />
                <Text style={styles.legendText}>Start</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#F4A825' }]} />
                <Text style={styles.legendText}>Collector</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#E63946' }]} />
                <Text style={styles.legendText}>You</Text>
              </View>
            </View>

            <View style={[styles.statusPill, getStatusPillStyle(delivery.deliveryStatus)]}>
              <Text style={[styles.statusPillText, getStatusPillTextStyle(delivery.deliveryStatus)]}>
                {getStatusLabel(delivery)}
              </Text>
            </View>
          </View>

          <View style={[styles.bottomSheet, { paddingBottom: Math.max(insets.bottom, SPACING.md) }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.detailSubtitle}>{new Date(delivery.createdAt).toLocaleString()}</Text>

            <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionLabel}>Delivered By</Text>
              <View style={styles.metaCard}>
                <View style={styles.metaRow}>
                  <Icon name="person" size={16} color={COLORS.primary} />
                  <Text style={styles.metaText}>{delivery.collectorName || 'Collector'} (Collector)</Text>
                </View>
              </View>

              <Text style={styles.sectionLabel}>Items</Text>
              <View style={styles.itemsCard}>
                {(delivery.items || []).map((item, index) => (
                  <View key={`${item.productCode}-${index}`} style={[styles.itemRow, index === 0 && styles.itemRowFirst]}>
                    <Text style={styles.itemName}>{item.productName}</Text>
                    <Text style={styles.itemMeta}>Qty: {item.quantity}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.sectionLabel}>Current Location</Text>
              <DeliveryTimeline entries={getTimelineEntries(delivery)} />

              <View style={{ height: SPACING.md }} />
            </ScrollView>
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: COLORS.textSecondary,
  },

  mapWrap: { flex: 1, position: 'relative', overflow: 'hidden' },
  mapFill: { borderRadius: 0, borderWidth: 0 },

  topOverlayRow: {
    position: 'absolute',
    top: SPACING.md,
    left: SPACING.md,
    right: SPACING.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontSize: 10, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.medium },

  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
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

  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    marginBottom: SPACING.xs,
  },
  detailSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  detailScroll: { flex: 1 },
  sectionLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: '#272632',
    marginBottom: SPACING.xs,
    marginTop: SPACING.xs,
  },
  metaCard: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: SPACING.sm,
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  metaText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: '#272632',
  },
  itemsCard: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  itemRowFirst: { borderTopWidth: 0 },
  itemName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  itemMeta: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
});
