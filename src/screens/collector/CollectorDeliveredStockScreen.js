// src/screens/collector/CollectorDeliveredStockScreen.js
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SubScreenSecondaryHeader from '../../components/common/SubScreenSecondaryHeader';
import CustomModal from '../../components/common/Modal';
import Icon from '../../components/common/Icon';
import authService from '../../services/authService';
import deliveryService from '../../services/deliveryService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { formatRelativeTime } from '../../utils/formatters';

function summarizeItems(items) {
  const totalUnits = (items || []).reduce((sum, item) => sum + item.quantity, 0);
  return `${totalUnits} unit${totalUnits === 1 ? '' : 's'} · ${(items || []).length} product${(items || []).length === 1 ? '' : 's'}`;
}

export default function CollectorDeliveredStockScreen() {
  const [deliveries, setDeliveries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDelivery, setSelectedDelivery] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const agent = await authService.getCurrentUser();
    const result = await deliveryService.getMyCollectorDeliveries(agent?.id);
    const all = result.success ? result.data : [];
    setDeliveries(all.filter((d) => d.stage === 'delivered'));
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const closeDetail = () => setSelectedDelivery(null);

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton
          backButtonText="Collector Dashboard"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
        />
        <SubScreenSecondaryHeader title="Delivered Stock" syncStatus="online" />

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : deliveries.length === 0 ? (
          <View style={styles.loadingWrap}>
            <Icon name="successCircle" size={32} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No completed deliveries yet.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {deliveries.map((delivery) => (
              <TouchableOpacity
                key={delivery.transactionId}
                style={styles.card}
                onPress={() => setSelectedDelivery(delivery)}
                activeOpacity={0.7}
              >
                <View style={styles.iconBadge}>
                  <Icon name="checkCircle" size={18} color={COLORS.success} weight="fill" />
                </View>
                <View style={styles.textCol}>
                  <Text style={styles.title} numberOfLines={1}>
                    Delivered to {delivery.targetRecipientName || 'Sales Rep'}
                  </Text>
                  <Text style={styles.meta}>{summarizeItems(delivery.items)}</Text>
                </View>
                <Text style={styles.time}>{formatRelativeTime(delivery.deliveredAt || delivery.createdAt)}</Text>
              </TouchableOpacity>
            ))}
            <View style={{ height: 24 }} />
          </ScrollView>
        )}
      </View>

      <CustomModal visible={!!selectedDelivery} onClose={closeDetail} height={480}>
        {selectedDelivery && (
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.detailTitle}>Delivered to {selectedDelivery.targetRecipientName || 'Sales Rep'}</Text>
            <Text style={styles.detailSubtitle}>
              {new Date(selectedDelivery.deliveredAt || selectedDelivery.createdAt).toLocaleString()}
            </Text>

            <Text style={styles.detailSectionLabel}>Items</Text>
            <View style={styles.itemsCard}>
              {(selectedDelivery.items || []).map((item, index) => (
                <View key={`${item.batchNumber}-${index}`} style={[styles.itemRow, index === 0 && styles.itemRowFirst]}>
                  <Text style={styles.itemName}>{item.productName}</Text>
                  <Text style={styles.itemMeta}>Qty: {item.quantity}</Text>
                </View>
              ))}
            </View>

            <View style={{ height: 24 }} />
          </ScrollView>
        )}
      </CustomModal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  content: { padding: SPACING.lg, gap: SPACING.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    padding: SPACING.sm,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.success + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1 },
  title: { fontSize: TYPOGRAPHY.fontSize.sm, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', color: '#272632' },
  meta: { marginTop: 2, fontSize: TYPOGRAPHY.fontSize.xs, fontFamily: TYPOGRAPHY.fontFamily.regular, color: COLORS.textSecondary },
  time: { fontSize: 11, fontFamily: TYPOGRAPHY.fontFamily.regular, color: COLORS.textTertiary },
  emptyText: { fontSize: TYPOGRAPHY.fontSize.sm, fontFamily: TYPOGRAPHY.fontFamily.regular, color: COLORS.textSecondary },
  detailTitle: { fontSize: TYPOGRAPHY.fontSize.lg, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', color: '#272632' },
  detailSubtitle: { marginTop: 2, marginBottom: SPACING.md, fontSize: TYPOGRAPHY.fontSize.sm, fontFamily: TYPOGRAPHY.fontFamily.regular, color: COLORS.textSecondary },
  detailSectionLabel: { fontSize: TYPOGRAPHY.fontSize.sm, fontFamily: TYPOGRAPHY.fontFamily.semibold, fontWeight: '600', color: '#272632', marginBottom: SPACING.xs },
  itemsCard: { borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 12, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', padding: SPACING.sm, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  itemRowFirst: { borderTopWidth: 0 },
  itemName: { fontSize: TYPOGRAPHY.fontSize.sm, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', color: '#272632' },
  itemMeta: { fontSize: 11, fontFamily: TYPOGRAPHY.fontFamily.regular, color: COLORS.textSecondary },
});
