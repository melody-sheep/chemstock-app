// src/screens/collector/CollectorDeliveredStockScreen.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Image, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRoute, useNavigation } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SubScreenSecondaryHeader from '../../components/common/SubScreenSecondaryHeader';
import CustomModal from '../../components/common/Modal';
import Icon from '../../components/common/Icon';
import UserAvatar from '../../components/common/UserAvatar';
import Button from '../../components/common/Button';
import { getInitials } from '../../utils/initials';
import LogCard from '../../components/common/LogCard';
import useOutbox from '../../hooks/useOutbox';
import authService from '../../services/authService';
import deliveryService from '../../services/deliveryService';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { formatRelativeTime } from '../../utils/formatters';
import { useMarkLogsSeen } from '../../hooks/useUnseenLogCount';

function summarizeItems(items) {
  const totalUnits = (items || []).reduce((sum, item) => sum + item.quantity, 0);
  return `${totalUnits} unit${totalUnits === 1 ? '' : 's'} · ${(items || []).length} product${(items || []).length === 1 ? '' : 's'}`;
}

export default function CollectorDeliveredStockScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  useMarkLogsSeen();
  const focusId = route.params?.focusId || null;
  const [deliveries, setDeliveries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const openedFocusIdRef = useRef(null);
  // Opened straight onto one delivery (Recent Logs, a notification): closing it goes back to where
  // the tap came from, not to the full list.
  const openedFromLinkRef = useRef(false);
  // Stops marked delivered while offline, not yet on the server.
  const { pending: queuedFinishes } = useOutbox('finish_delivery_leg');

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

  useEffect(() => {
    if (!focusId) {
      openedFocusIdRef.current = null;
      return;
    }
    if (isLoading || openedFocusIdRef.current === focusId) return;
    const match = deliveries.find((delivery) => delivery.transactionId === focusId);
    if (match) {
      openedFocusIdRef.current = focusId;
      openedFromLinkRef.current = true;
      setSelectedDelivery(match);
    }
  }, [focusId, isLoading, deliveries]);

  const closeDetail = () => {
    setSelectedDelivery(null);
    if (openedFromLinkRef.current) {
      openedFromLinkRef.current = false;
      navigation.goBack();
    }
  };

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
        <SubScreenSecondaryHeader title="Delivered Stock" />

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : deliveries.length === 0 && queuedFinishes.length === 0 ? (
          <View style={styles.loadingWrap}>
            <Icon name="successCircle" size={32} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No completed deliveries yet.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {queuedFinishes.map((entry) => (
              <LogCard
                key={entry.id}
                type="requestPending"
                title={entry.payload?.label || 'Delivery'}
                meta="Waiting for network — saved on this device"
                time={formatRelativeTime(new Date(entry.createdAt).toISOString())}
              />
            ))}
            {deliveries.map((delivery) => (
              <LogCard
                key={delivery.transactionId}
                type="delivery"
                title={`Delivered to ${delivery.targetRecipientName || 'Sales Rep'}`}
                meta={summarizeItems(delivery.items)}
                time={formatRelativeTime(delivery.deliveredAt || delivery.createdAt)}
                onPress={() => setSelectedDelivery(delivery)}
              />
            ))}
            <View style={{ height: 24 }} />
          </ScrollView>
        )}
      </View>

      <CustomModal visible={!!selectedDelivery} onClose={closeDetail} height="auto" maxHeight={680}>
        {selectedDelivery && (() => {
          const items = selectedDelivery.items || [];
          const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
          const when = new Date(selectedDelivery.deliveredAt || selectedDelivery.createdAt);
          return (
            <>
              <View style={styles.sheetHandle} />
              <ScrollView showsVerticalScrollIndicator={false} style={styles.sheetScroll}>
                <View style={styles.sheetHeader}>
                  <UserAvatar
                    photoUrl={selectedDelivery.targetRecipientPhotoUrl}
                    fallbackText={getInitials(selectedDelivery.targetRecipientName)}
                    size={48}
                    backgroundColor="#F1F3F6"
                    fallbackTextColor={COLORS.primary}
                  />
                  <View style={styles.sheetHeaderText}>
                    <Text style={styles.detailTitle} numberOfLines={1}>{selectedDelivery.targetRecipientName || 'Sales Rep'}</Text>
                    <Text style={styles.detailRole}>Sales Representative</Text>
                  </View>
                  <View style={styles.deliveredPill}>
                    <Icon name="checkCircle" size={13} color="#1E7A3A" weight="fill" />
                    <Text style={styles.deliveredPillText}>Delivered</Text>
                  </View>
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.statTile}>
                    <Text style={styles.statValue}>{totalUnits}</Text>
                    <Text style={styles.statLabel}>Units</Text>
                  </View>
                  <View style={styles.statTile}>
                    <Text style={styles.statValue}>{items.length}</Text>
                    <Text style={styles.statLabel}>Product{items.length === 1 ? '' : 's'}</Text>
                  </View>
                </View>

                <Text style={styles.detailSectionLabel}>ITEMS</Text>
                <View style={styles.itemsCard}>
                  {items.map((item, index) => (
                    <View key={`${item.batchNumber}-${index}`} style={[styles.itemRow, index === 0 && styles.itemRowFirst]}>
                      <View style={styles.itemIconWrap}>
                        {PRODUCT_CATALOG.find((p) => p.code === item.productCode)?.image ? (
                          <Image
                            source={PRODUCT_CATALOG.find((p) => p.code === item.productCode).image}
                            style={styles.itemIconImage}
                            resizeMode="contain"
                          />
                        ) : (
                          <Icon name="package" size={16} color="#03045E" />
                        )}
                      </View>
                      <View style={styles.itemTextWrap}>
                        <Text style={styles.itemName}>{item.productName}</Text>
                      </View>
                      <Text style={styles.itemMeta}>Qty: {item.quantity}</Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.detailSectionLabel}>DETAILS</Text>
                <View style={styles.detailsCard}>
                  <View style={styles.detailRow}>
                    <Icon name="clock" size={16} color={COLORS.textSecondary} />
                    <Text style={styles.detailLabel}>Delivered</Text>
                    <Text style={styles.detailValue}>{when.toLocaleString()}</Text>
                  </View>
                  {!!selectedDelivery.branchName && (
                    <View style={styles.detailRow}>
                      <Icon name="building" size={16} color={COLORS.primary} />
                      <Text style={styles.detailLabel}>From</Text>
                      <Text style={styles.detailValue} numberOfLines={1}>{selectedDelivery.branchName}</Text>
                    </View>
                  )}
                </View>
              </ScrollView>

              <Button
                title="Close"
                variant="outline"
                onPress={closeDetail}
                hasShadow={false}
                height={48}
                fontSize={16}
                borderRadius={24}
                width="100%"
                style={styles.closeButton}
              />
            </>
          );
        })()}
      </CustomModal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  content: { padding: SPACING.lg, gap: SPACING.xs },
  emptyText: { fontSize: TYPOGRAPHY.fontSize.sm, fontFamily: TYPOGRAPHY.fontFamily.regular, color: COLORS.textSecondary },
  sheetHandle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#DADDE3', marginTop: -8, marginBottom: 14 },
  sheetScroll: { flexShrink: 1 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetHeaderText: { flex: 1 },
  detailTitle: { fontSize: TYPOGRAPHY.fontSize.lg, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', color: '#272632' },
  detailRole: { marginTop: 1, fontSize: 12, fontFamily: TYPOGRAPHY.fontFamily.regular, color: COLORS.textSecondary },
  deliveredPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#E1F4E8' },
  deliveredPillText: { fontSize: 12, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', color: '#1E7A3A' },
  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: 14 },
  statTile: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: '#F5F6F9' },
  statValue: { fontSize: 20, color: '#272632', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  statLabel: { fontSize: 12, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.regular },
  detailSectionLabel: { marginTop: 16, marginBottom: 8, fontSize: 12, letterSpacing: 0.8, color: '#6B7280', fontFamily: TYPOGRAPHY.fontFamily.semibold, fontWeight: '600' },
  detailsCard: { borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  detailLabel: { fontSize: 14, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.regular },
  detailValue: { flex: 1, textAlign: 'right', fontSize: 14, color: '#272632', fontFamily: TYPOGRAPHY.fontFamily.semibold, fontWeight: '600' },
  closeButton: { marginTop: 14 },
  itemsCard: { borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 12, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  itemRow: { flexDirection: 'row', alignItems: 'center', padding: SPACING.sm, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  itemRowFirst: { borderTopWidth: 0 },
  itemIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
    overflow: 'hidden',
  },
  itemIconImage: { width: '100%', height: '100%' },
  itemTextWrap: { flex: 1 },
  itemName: { fontSize: TYPOGRAPHY.fontSize.sm, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', color: '#272632' },
  itemMeta: { fontSize: 12, fontFamily: TYPOGRAPHY.fontFamily.regular, color: COLORS.textSecondary },
});
