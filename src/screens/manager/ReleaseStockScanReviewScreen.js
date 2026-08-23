// src/screens/manager/ReleaseStockScanReviewScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import Icon from '../../components/common/Icon';
import Stepper from '../../components/common/Stepper';
import Button from '../../components/common/Button';
import authService from '../../services/authService';
import inventoryService from '../../services/inventoryService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const STEP_LABELS = ['Who receives the stock?', 'How many items?', 'Final Proof'];

export default function ReleaseStockScanReviewScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { recipient, targetRecipient, branchId, movementType, qrCode } = route.params;

  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [items, setItems] = useState([]);

  useEffect(() => {
    (async () => {
      const manager = await authService.getCurrentUser();
      const result = await inventoryService.getReceivingBatchByQrCode(qrCode, manager?.branchIds || []);

      if (!result.success || !result.data) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }

      // Depleted batches now persist at quantity = 0 (never deleted — see
      // 2026-08-21 migration), so filter those out here: nothing left to
      // release from them, and showing a stuck-at-0 stepper isn't useful.
      const batchItems = (result.data.branch_inventory || [])
        .filter((row) => row.quantity > 0)
        .map((row) => ({
          branchInventoryId: row.id,
          productCode: row.product_code,
          productName: row.product_name,
          batchNumber: row.batch_number,
          currentQty: row.quantity,
          releaseQty: row.quantity,
          mfgDate: row.mfg_date,
          expDate: row.exp_date,
        }));

      setItems(batchItems);
      setIsLoading(false);
    })();
  }, [qrCode]);

  const handleAdjustQty = (branchInventoryId, delta) => {
    setItems((prev) =>
      prev.map((item) =>
        item.branchInventoryId === branchInventoryId
          ? { ...item, releaseQty: Math.max(0, Math.min(item.currentQty, item.releaseQty + delta)) }
          : item
      )
    );
  };

  const releaseItems = items.filter((item) => item.releaseQty > 0);
  const totalUnits = releaseItems.reduce((sum, item) => sum + item.releaseQty, 0);

  const handleNext = () => {
    if (releaseItems.length === 0) return;
    const params = { recipient, targetRecipient, branchId, movementType, items: releaseItems };
    navigation.navigate(movementType === 'collector' ? 'ReleaseStockDelivery' : 'ReleaseStockConfirm', params);
  };

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton
          backButtonText="Give Out Stock"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
        />

        <SecondaryHeader height={56}>
          <View style={styles.titleRow}>
            <Text style={styles.pageTitle}>Pick Products</Text>
            <View style={styles.onlinePill}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Online</Text>
            </View>
          </View>
        </SecondaryHeader>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Stepper currentStep={2} labels={STEP_LABELS} />

          <Text style={styles.sectionTitle}>Current Scanned Items</Text>

          {isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : notFound ? (
            <View style={styles.emptyBox}>
              <Icon name="warningTriangle" size={28} color={COLORS.error} />
              <Text style={styles.emptyTitle}>QR Code Not Recognized</Text>
              <Text style={styles.emptyText}>
                This code doesn't match a batch received at your branch. Try scanning again, or use Quick
                Register instead.
              </Text>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.emptyBox}>
              <Icon name="checkCircle" size={28} color={COLORS.success} weight="fill" />
              <Text style={styles.emptyTitle}>Batch Already Fully Released</Text>
              <Text style={styles.emptyText}>
                Every item from this batch has already been given out.
              </Text>
            </View>
          ) : (
            <View style={styles.itemsCard}>
              {items.map((item, index) => (
                <View
                  key={item.branchInventoryId}
                  style={[styles.itemRow, index === 0 && styles.itemRowFirst]}
                >
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.productName}</Text>
                    <Text style={styles.itemMeta}>Current stock: {item.currentQty} pcs</Text>
                    {item.expDate && (
                      <Text style={styles.itemMeta}>Exp: {new Date(item.expDate).toLocaleDateString()}</Text>
                    )}
                  </View>
                  <View style={styles.stepperInline}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => handleAdjustQty(item.branchInventoryId, -1)}
                      accessibilityLabel={`Decrease ${item.productName} release quantity`}
                    >
                      <Icon name="minus" size={14} color={COLORS.primary} />
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>{item.releaseQty}</Text>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => handleAdjustQty(item.branchInventoryId, 1)}
                      accessibilityLabel={`Increase ${item.productName} release quantity`}
                    >
                      <Icon name="plus" size={14} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {releaseItems.length > 0 && (
            <Text style={styles.summaryText}>
              📦 {releaseItems.length} item{releaseItems.length === 1 ? '' : 's'}, {totalUnits} units to release
            </Text>
          )}

          <Button
            title="Next"
            icon="arrowRight"
            iconPosition="right"
            onPress={handleNext}
            disabled={releaseItems.length === 0}
            variant="black"
            style={styles.nextButton}
          />
        </ScrollView>
      </View>
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
  pageTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' },
  onlineText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.success,
  },
  content: { padding: SPACING.lg, gap: SPACING.sm, paddingBottom: 40 },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  loadingWrap: { paddingVertical: SPACING.xl, alignItems: 'center' },
  emptyBox: {
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  itemsCard: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  itemRowFirst: { borderTopWidth: 0 },
  itemInfo: { flex: 1 },
  itemName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  itemMeta: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  stepperInline: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  stepperBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  stepperValue: {
    minWidth: 26,
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: '#272632',
  },
  summaryText: {
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: '#272632',
  },
  nextButton: { marginTop: SPACING.sm },
});
