// src/screens/manager/TrackDeliveriesScreen.js
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SubScreenSecondaryHeader from '../../components/common/SubScreenSecondaryHeader';
import Icon from '../../components/common/Icon';
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

export default function TrackDeliveriesScreen() {
  const navigation = useNavigation();
  const [deliveries, setDeliveries] = useState([]);
  const [recipientNameById, setRecipientNameById] = useState({});
  const [recipientPhotoById, setRecipientPhotoById] = useState({});
  const [isLoading, setIsLoading] = useState(true);

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
      setRecipientPhotoById(Object.fromEntries(agentsResult.data.map((a) => [a.id, a.profilePhotoUrl || null])));
    }
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDeliveries();
    }, [loadDeliveries])
  );

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
        <SubScreenSecondaryHeader title="Track Deliveries" />

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
});
