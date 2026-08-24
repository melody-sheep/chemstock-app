// src/screens/salesrep/SalesRepTrackDeliveriesScreen.js
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import Header from '../../components/common/Header';
import CustomModal from '../../components/common/Modal';
import Icon from '../../components/common/Icon';
import StaticRouteMap from '../../components/common/StaticRouteMap';
import authService from '../../services/authService';
import inventoryService from '../../services/inventoryService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { formatRelativeTime } from '../../utils/formatters';

// Same "no collector write path exists yet" caveat as the Manager's
// TrackDeliveriesScreen — delivery_status only ever flips to 'delivered'
// once the Collector side has its own "mark delivered" action.
function getStatusLabel(delivery) {
  return delivery.deliveryStatus === 'delivered' ? 'Delivered' : 'Not Delivered';
}

export default function SalesRepTrackDeliveriesScreen() {
  const [deliveries, setDeliveries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDelivery, setSelectedDelivery] = useState(null);

  const loadDeliveries = useCallback(async () => {
    setIsLoading(true);
    const agent = await authService.getCurrentUser();
    const result = await inventoryService.getMyDeliveries(agent?.id);
    setDeliveries(result.success ? result.data : []);
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
          backButtonText="Sales Rep Dashboard"
          title="Track Deliveries"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
        />

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : deliveries.length === 0 ? (
          <View style={styles.loadingWrap}>
            <Icon name="truck" size={32} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No incoming deliveries yet.</Text>
            <Text style={styles.emptySubtext}>
              Stock your manager releases via a Collector will show up here.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {deliveries.map((delivery) => {
              const isDelivered = delivery.deliveryStatus === 'delivered';
              return (
                <TouchableOpacity
                  key={delivery.transactionId}
                  style={styles.deliveryCard}
                  onPress={() => setSelectedDelivery(delivery)}
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
                  </View>
                  <View style={[styles.statusPill, isDelivered ? styles.statusPillDelivered : styles.statusPillPending]}>
                    <Text style={[styles.statusPillText, isDelivered ? styles.statusPillTextDelivered : styles.statusPillTextPending]}>
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
              <View
                style={[
                  styles.statusPill,
                  selectedDelivery.deliveryStatus === 'delivered' ? styles.statusPillDelivered : styles.statusPillPending,
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    selectedDelivery.deliveryStatus === 'delivered'
                      ? styles.statusPillTextDelivered
                      : styles.statusPillTextPending,
                  ]}
                >
                  {getStatusLabel(selectedDelivery)}
                </Text>
              </View>
            </View>
            <Text style={styles.detailSubtitle}>{new Date(selectedDelivery.createdAt).toLocaleString()}</Text>

            <Text style={styles.detailSectionLabel}>Delivered By</Text>
            <View style={styles.metaCard}>
              <View style={styles.metaRow}>
                <Icon name="person" size={16} color={COLORS.primary} />
                <Text style={styles.metaText}>{selectedDelivery.collectorName || 'Collector'} (Collector)</Text>
              </View>
            </View>

            <Text style={styles.detailSectionLabel}>Items</Text>
            <View style={styles.itemsCard}>
              {(selectedDelivery.items || []).map((item, index) => (
                <View key={`${item.productCode}-${index}`} style={[styles.itemRow, index === 0 && styles.itemRowFirst]}>
                  <Text style={styles.itemName}>{item.productName}</Text>
                  <Text style={styles.itemMeta}>Qty: {item.quantity}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.detailSectionLabel}>Route</Text>
            <StaticRouteMap
              originCoords={selectedDelivery.originGps}
              destinationCoords={selectedDelivery.destinationGps}
              lastCheckpoint={selectedDelivery.lastCheckpoint}
              height={180}
              style={styles.map}
            />
            {selectedDelivery.lastCheckpoint ? (
              <Text style={styles.checkpointText}>
                Last location update: {formatRelativeTime(selectedDelivery.lastCheckpoint.createdAt)}
              </Text>
            ) : (
              <Text style={styles.checkpointText}>
                No location updates from the Collector yet.
              </Text>
            )}

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
  statusPillDelivered: { backgroundColor: '#EAFBF2' },
  statusPillText: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  statusPillTextPending: { color: '#B26400' },
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
  checkpointText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    fontStyle: 'italic',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
