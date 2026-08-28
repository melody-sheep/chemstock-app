// src/screens/manager/TrackDeliveriesScreen.js
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SubScreenSecondaryHeader from '../../components/common/SubScreenSecondaryHeader';
import CustomModal from '../../components/common/Modal';
import Icon from '../../components/common/Icon';
import StaticRouteMap from '../../components/common/StaticRouteMap';
import DeliveryTimeline from '../../components/common/DeliveryTimeline';
import authService from '../../services/authService';
import agentService from '../../services/agentService';
import inventoryService from '../../services/inventoryService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { formatRelativeTime } from '../../utils/formatters';

const STATUS_LABELS = { not_delivered: 'Pending', in_transit: 'In Transit', delivered: 'Delivered' };

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

function getLastCheckpoint(delivery) {
  const checkpoints = delivery.delivery_checkpoints || [];
  if (checkpoints.length === 0) return null;
  return checkpoints.reduce((latest, cp) =>
    new Date(cp.created_at) > new Date(latest.created_at) ? cp : latest
  );
}

// "Current Location" breadcrumb — the release moment (when the Collector's
// involvement began) plus every checkpoint they've since logged, oldest
// first. delivery_checkpoints comes back from the raw PostgREST embed in
// no guaranteed order, so it's sorted here.
function getTimelineEntries(delivery) {
  const checkpoints = [...(delivery.delivery_checkpoints || [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  return [
    { key: 'origin', label: 'Picked up by Collector', createdAt: delivery.created_at },
    ...checkpoints.map((cp, index) => ({ key: `cp-${index}`, label: cp.label, createdAt: cp.created_at })),
  ];
}

export default function TrackDeliveriesScreen() {
  const [deliveries, setDeliveries] = useState([]);
  const [recipientNameById, setRecipientNameById] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDelivery, setSelectedDelivery] = useState(null);

  const loadDeliveries = useCallback(async () => {
    setIsLoading(true);
    const manager = await authService.getCurrentUser();
    const [deliveriesResult, agentsResult] = await Promise.all([
      inventoryService.getDeliveries(manager?.branchIds || []),
      agentService.getMyAgentAccounts(),
    ]);
    setDeliveries(deliveriesResult.success ? deliveriesResult.data : []);
    if (agentsResult.success) {
      setRecipientNameById(Object.fromEntries(agentsResult.data.map((a) => [a.id, a.full_name])));
    }
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDeliveries();
    }, [loadDeliveries])
  );

  const closeDetail = () => setSelectedDelivery(null);

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
        <SubScreenSecondaryHeader title="Track Deliveries" syncStatus="online" />

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : deliveries.length === 0 ? (
          <View style={styles.loadingWrap}>
            <Icon name="truck" size={32} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No collector deliveries yet.</Text>
            <Text style={styles.emptySubtext}>
              Releases made via a Collector (not a direct Sales Rep handover) will show up here.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {deliveries.map((delivery) => {
              const isDelivered = delivery.delivery_status === 'delivered';
              const collectorName = recipientNameById[delivery.received_by] || 'Collector';
              const targetName = recipientNameById[delivery.target_recipient_id] || 'Sales Rep';
              return (
                <TouchableOpacity
                  key={delivery.id}
                  style={styles.deliveryCard}
                  onPress={() => setSelectedDelivery(delivery)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.deliveryIconBadge, isDelivered && styles.deliveryIconBadgeDelivered]}>
                    <Icon name="truck" size={18} color={isDelivered ? COLORS.success : COLORS.iconTrackStroke} />
                  </View>
                  <View style={styles.deliveryTextCol}>
                    <Text style={styles.deliveryTitle} numberOfLines={1}>
                      {collectorName} → {targetName}
                    </Text>
                    <Text style={styles.deliveryMeta}>{formatRelativeTime(delivery.created_at)}</Text>
                  </View>
                  <View style={[styles.statusPill, getStatusPillStyle(delivery.delivery_status)]}>
                    <Text style={[styles.statusPillText, getStatusPillTextStyle(delivery.delivery_status)]}>
                      {getStatusLabel(delivery)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 24 }} />
          </ScrollView>
        )}
      </View>

      <CustomModal visible={!!selectedDelivery} onClose={closeDetail} height={600}>
        {selectedDelivery && (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.detailHeaderRow}>
              <Text style={styles.detailTitle}>Delivery Details</Text>
              <View style={[styles.statusPill, getStatusPillStyle(selectedDelivery.delivery_status)]}>
                <Text style={[styles.statusPillText, getStatusPillTextStyle(selectedDelivery.delivery_status)]}>
                  {getStatusLabel(selectedDelivery)}
                </Text>
              </View>
            </View>
            <Text style={styles.detailSubtitle}>{new Date(selectedDelivery.created_at).toLocaleString()}</Text>

            <Text style={styles.detailSectionLabel}>Recipients</Text>
            <View style={styles.metaCard}>
              <View style={styles.metaRow}>
                <Icon name="person" size={16} color={COLORS.primary} />
                <Text style={styles.metaText}>
                  {recipientNameById[selectedDelivery.received_by] || 'Collector'} (Collector)
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Icon name="person" size={16} color={COLORS.primary} />
                <Text style={styles.metaText}>
                  {recipientNameById[selectedDelivery.target_recipient_id] || 'Sales Rep'} (Sales Representative)
                </Text>
              </View>
            </View>

            <Text style={styles.detailSectionLabel}>Items</Text>
            <View style={styles.itemsCard}>
              {(selectedDelivery.transaction_details || []).map((item, index) => (
                <View key={`${item.batch_number}-${index}`} style={[styles.itemRow, index === 0 && styles.itemRowFirst]}>
                  <Text style={styles.itemName}>{item.product_name}</Text>
                  <Text style={styles.itemMeta}>Qty: {item.quantity}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.detailSectionLabel}>Route</Text>
            <StaticRouteMap
              originCoords={selectedDelivery.origin_gps}
              destinationCoords={selectedDelivery.destination_gps}
              lastCheckpoint={getLastCheckpoint(selectedDelivery)}
              height={180}
              style={styles.map}
            />
            <Text style={styles.detailSectionLabel}>Current Location</Text>
            <DeliveryTimeline entries={getTimelineEntries(selectedDelivery)} />

            <View style={{ height: 24 }} />
          </ScrollView>
        )}
      </CustomModal>
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
  detailHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  detailSubtitle: {
    marginTop: 2,
    marginBottom: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  detailSectionLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: '#272632',
    marginBottom: SPACING.xs,
  },
  metaCard: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: SPACING.sm,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
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
    marginBottom: SPACING.md,
    overflow: 'hidden',
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
  map: { marginBottom: SPACING.xs },
});
