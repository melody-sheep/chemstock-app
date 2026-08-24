// src/screens/manager/ReleaseStockRequestReviewScreen.js
import React, { useEffect, useState } from 'react';
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

// Greedily allocates each requested product against the branch's live stock
// (already sorted soonest-expiring-first by getBranchStock — FIFO for
// free), capped at whatever's actually on hand. Returns both the flat,
// editable item list (one row per allocated batch) and a per-product
// shortfall summary for the "requested more than available" banner.
function allocateItems(requestedItems, branchStock) {
  const rows = [];
  const shortfalls = [];

  for (const reqItem of requestedItems) {
    const matchingBatches = branchStock.filter(
      (row) => row.product_code === reqItem.productCode && row.quantity > 0
    );
    let remaining = reqItem.quantity;

    for (const batch of matchingBatches) {
      if (remaining <= 0) break;
      const allocQty = Math.min(remaining, batch.quantity);
      rows.push({
        branchInventoryId: batch.id,
        productCode: batch.product_code,
        productName: batch.product_name,
        batchNumber: batch.batch_number,
        currentQty: batch.quantity,
        releaseQty: allocQty,
        expDate: batch.exp_date,
      });
      remaining -= allocQty;
    }

    if (remaining > 0) {
      shortfalls.push({ productCode: reqItem.productCode, productName: reqItem.productName, requestedQty: reqItem.quantity, shortBy: remaining });
    }
  }

  return { rows, shortfalls };
}

export default function ReleaseStockRequestReviewScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { recipient, targetRecipient, branchId, movementType, requestId, requestedItems } = route.params;

  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [shortfalls, setShortfalls] = useState([]);

  useEffect(() => {
    (async () => {
      const manager = await authService.getCurrentUser();
      const result = await inventoryService.getBranchStock(manager?.branchIds || []);
      const branchStock = result.success ? result.data : [];

      const { rows, shortfalls: shorts } = allocateItems(requestedItems || [], branchStock);
      setItems(rows);
      setShortfalls(shorts);
      setIsLoading(false);
    })();
  }, [requestedItems]);

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
    const params = { recipient, targetRecipient, branchId, movementType, items: releaseItems, requestId };
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

          <Text style={styles.sectionTitle}>Auto-Allocated from Requested Items</Text>

          {isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : (
            <>
              {shortfalls.length > 0 && (
                <View style={styles.shortfallBanner}>
                  <Icon name="warningTriangle" size={16} color={COLORS.error} />
                  <View style={{ flex: 1 }}>
                    {shortfalls.map((s) => (
                      <Text key={s.productCode} style={styles.shortfallText}>
                        {s.productName}: requested {s.requestedQty}, only {s.requestedQty - s.shortBy} available
                      </Text>
                    ))}
                  </View>
                </View>
              )}

              {items.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Icon name="warningTriangle" size={28} color={COLORS.error} />
                  <Text style={styles.emptyTitle}>Nothing Available</Text>
                  <Text style={styles.emptyText}>
                    None of the requested products currently have stock at your branch.
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
            </>
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
  shortfallBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.error + '30',
    backgroundColor: COLORS.error + '0D',
  },
  shortfallText: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.error,
  },
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
