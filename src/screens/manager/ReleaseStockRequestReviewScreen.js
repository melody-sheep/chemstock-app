// src/screens/manager/ReleaseStockRequestReviewScreen.js
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import { BlurTargetView } from 'expo-blur';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import LiveStatusPill from '../../components/common/LiveStatusPill';
import Icon from '../../components/common/Icon';
import Stepper from '../../components/common/Stepper';
import Button from '../../components/common/Button';
import BottomActionBar, { useBottomActionBarHeight } from '../../components/common/BottomActionBar';
import HintChip from '../../components/common/HintChip';
import UserAvatar from '../../components/common/UserAvatar';
import authService from '../../services/authService';
import inventoryService from '../../services/inventoryService';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { isExpired } from '../../utils/expiry';
import { getInitials } from '../../utils/initials';

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
      (row) => row.product_code === reqItem.productCode && row.quantity > 0 && !isExpired(row.exp_date)
    );
    // Expired batches are never allocated (BL-1); counted so the banner can say why.
    const expiredQty = branchStock
      .filter((row) => row.product_code === reqItem.productCode && row.quantity > 0 && isExpired(row.exp_date))
      .reduce((sum, row) => sum + row.quantity, 0);
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
      shortfalls.push({ productCode: reqItem.productCode, productName: reqItem.productName, requestedQty: reqItem.quantity, shortBy: remaining, expiredQty });
    }
  }

  return { rows, shortfalls };
}

export default function ReleaseStockRequestReviewScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { recipient, targetRecipient, branchId, movementType, requestId, requestedItems } = route.params;
  const bottomActionBarHeight = useBottomActionBarHeight();
  const blurTarget = useRef(null);

  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [shortfalls, setShortfalls] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [qtyText, setQtyText] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const manager = await authService.getCurrentUser();
        // Only the request's own branch — allocating from every branch the
        // manager covers could pull batches from the wrong storage.
        const result = await inventoryService.getBranchStock(branchId ? [branchId] : manager?.branchIds || []);
        if (!result.success) {
          throw new Error(result.message || 'Could not load branch stock.');
        }

        const { rows, shortfalls: shorts } = allocateItems(requestedItems || [], result.data || []);
        setItems(rows);
        setShortfalls(shorts);
      } catch (error) {
        console.error('[ERROR] [ReleaseStockRequestReview] Failed to load branch stock:', error);
        setLoadError('Could not load branch stock. Go back and try again.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [requestedItems]);

  const handleAdjustQty = (branchInventoryId, delta) => {
    setQtyText((prev) => {
      if (!(branchInventoryId in prev)) return prev;
      const next = { ...prev };
      delete next[branchInventoryId];
      return next;
    });
    setItems((prev) =>
      prev.map((item) =>
        item.branchInventoryId === branchInventoryId
          ? { ...item, releaseQty: Math.max(0, Math.min(item.currentQty, item.releaseQty + delta)) }
          : item
      )
    );
  };

  const handleTypeQty = (branchInventoryId, text) => {
    const digits = text.replace(/\D/g, '');
    const item = items.find((row) => row.branchInventoryId === branchInventoryId);
    const quantity = Math.min(item?.currentQty || 0, parseInt(digits, 10) || 0);
    setItems((prev) =>
      prev.map((row) =>
        row.branchInventoryId === branchInventoryId ? { ...row, releaseQty: quantity } : row
      )
    );
    setQtyText((prev) => ({ ...prev, [branchInventoryId]: digits === '' ? '' : String(quantity) }));
  };

  const forgetQtyText = (branchInventoryId) => {
    setQtyText((prev) => {
      if (!(branchInventoryId in prev)) return prev;
      const next = { ...prev };
      delete next[branchInventoryId];
      return next;
    });
  };

  const requestedTotalUnits = (requestedItems || []).reduce((sum, item) => sum + item.quantity, 0);
  const requestedSalesRep = movementType === 'collector' ? targetRecipient : recipient;
  const releaseItems = items.filter((item) => item.releaseQty > 0);
  const totalUnits = releaseItems.reduce((sum, item) => sum + item.releaseQty, 0);

  // Products where the amount being released no longer matches what the
  // Sales Rep asked for, so the Manager knows they're changing the request.
  const changedFromRequest = isLoading || loadError
    ? []
    : (requestedItems || [])
        .map((req) => ({
          productCode: req.productCode,
          productName: req.productName,
          requestedQty: req.quantity,
          releasingQty: items
            .filter((item) => item.productCode === req.productCode)
            .reduce((sum, item) => sum + item.releaseQty, 0),
        }))
        .filter((row) => row.releasingQty !== row.requestedQty);

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
            <Text style={styles.pageTitle}>Review Request</Text>
            <LiveStatusPill pillStyle={styles.onlinePill} dotStyle={styles.onlineDot} textStyle={styles.onlineText} />
          </View>
        </SecondaryHeader>

        <BlurTargetView ref={blurTarget} style={styles.contentTarget}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomActionBarHeight + SPACING.md }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Stepper currentStep={2} labels={STEP_LABELS} />

          <View style={styles.requestCard}>
            <UserAvatar
              photoUrl={requestedSalesRep?.profilePhotoUrl}
              fallbackText={getInitials(requestedSalesRep?.fullName)}
              size={56}
              backgroundColor={COLORS.primaryLight}
              fallbackTextColor={COLORS.primary}
            />
            <View style={styles.requestInfo}>
              <Text style={styles.requestEyebrow}>STOCK REQUEST</Text>
              <Text style={styles.requestRecipient} numberOfLines={1}>{requestedSalesRep?.fullName || 'Sales Rep'}</Text>
              {movementType === 'collector' && (
                <Text style={styles.requestMeta}>Delivered by {recipient?.fullName || 'Collector'}</Text>
              )}
              <Text style={styles.requestMeta}>
                {(requestedItems || []).length} product{(requestedItems || []).length === 1 ? '' : 's'} · {requestedTotalUnits} unit{requestedTotalUnits === 1 ? '' : 's'} requested
              </Text>
            </View>
          </View>

          <HintChip
            id="release-request-qty"
            text="Stock is allocated from eligible batches. Adjust each batch amount below; expired stock is never included."
            style={styles.hint}
          />

          <Text style={styles.sectionTitle}>Items to Release</Text>

          {isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : loadError ? (
            <View style={styles.emptyBox}>
              <Icon name="warningTriangle" size={28} color={COLORS.error} />
              <Text style={styles.emptyTitle}>Stock Could Not Be Loaded</Text>
              <Text style={styles.emptyText}>{loadError}</Text>
            </View>
          ) : (
            <>
              {shortfalls.length > 0 && (
                <View style={styles.shortfallBanner}>
                  <Icon name="warningTriangle" size={16} color={COLORS.error} />
                  <View style={{ flex: 1 }}>
                    {shortfalls.map((s) => (
                      <Text key={s.productCode} style={styles.shortfallText}>
                        {s.productName}: requested {s.requestedQty}, only {s.requestedQty - s.shortBy} available{s.expiredQty > 0 ? ` (${s.expiredQty} expired, can't be released)` : ''}
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
                  {items.map((item, index) => {
                    const image = PRODUCT_CATALOG.find(
                      (product) => product.code === item.productCode || product.code === item.productName
                    )?.image;
                    return (
                      <View
                        key={item.branchInventoryId}
                        style={[styles.itemRow, index === 0 && styles.itemRowFirst, item.releaseQty === 0 && styles.itemRowZero]}
                      >
                        <View style={styles.itemTop}>
                          <View style={styles.thumb}>
                            {image ? (
                              <Image source={image} style={styles.thumbImage} resizeMode="contain" />
                            ) : (
                              <Icon name="package" size={24} color="#94a3b8" />
                            )}
                          </View>
                          <View style={styles.itemInfo}>
                            <Text style={styles.itemName} numberOfLines={2}>{item.productName}</Text>
                            <Text style={styles.itemMeta}>
                              Stock {item.currentQty} pcs{item.batchNumber ? ` · Batch ${item.batchNumber}` : ''}
                            </Text>
                            {item.expDate && (
                              <Text style={styles.itemMeta}>Exp {new Date(item.expDate).toLocaleDateString()}</Text>
                            )}
                          </View>
                        </View>
                        <View style={styles.qtyRow}>
                          <TouchableOpacity
                            style={styles.stepperBtn}
                            onPress={() => handleAdjustQty(item.branchInventoryId, -1)}
                            accessibilityLabel={`Decrease ${item.productName} release quantity`}
                            accessibilityRole="button"
                          >
                            <Icon name="minus" size={14} color={COLORS.primary} />
                          </TouchableOpacity>
                          <TextInput
                            style={styles.qtyInput}
                            value={item.branchInventoryId in qtyText ? qtyText[item.branchInventoryId] : String(item.releaseQty)}
                            keyboardType="number-pad"
                            selectTextOnFocus
                            maxLength={7}
                            onChangeText={(text) => handleTypeQty(item.branchInventoryId, text)}
                            onEndEditing={() => forgetQtyText(item.branchInventoryId)}
                            accessibilityLabel={`${item.productName} release quantity`}
                          />
                          <TouchableOpacity
                            style={styles.stepperBtn}
                            onPress={() => handleAdjustQty(item.branchInventoryId, 1)}
                            accessibilityLabel={`Increase ${item.productName} release quantity`}
                            accessibilityRole="button"
                          >
                            <Icon name="plus" size={14} color={COLORS.primary} />
                          </TouchableOpacity>
                        </View>
                        <Text style={[styles.itemHint, item.releaseQty === 0 && styles.itemHintZero]}>
                          {item.releaseQty === 0 ? 'Not included in this release' : `Releasing ${item.releaseQty} of ${item.currentQty} from this batch`}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}

          {!loadError && changedFromRequest.length > 0 && (
            <View style={styles.changedBanner}>
              <Icon name="warning" size={16} color="#B26400" />
              <View style={{ flex: 1 }}>
                <Text style={styles.changedTitle}>You're changing the Sales Rep's request</Text>
                {changedFromRequest.map((row) => (
                  <Text key={row.productCode} style={styles.changedText}>
                    {row.productName}: requested {row.requestedQty}, releasing {row.releasingQty}
                  </Text>
                ))}
                <Text style={styles.changedText}>They will receive these amounts instead of what they asked for.</Text>
              </View>
            </View>
          )}

          {releaseItems.length > 0 && (
            <View style={styles.summaryCard}>
              <Icon name="package" size={18} color={COLORS.primary} />
              <Text style={styles.summaryText}>
                {releaseItems.length} batch{releaseItems.length === 1 ? '' : 'es'} · {totalUnits} unit{totalUnits === 1 ? '' : 's'} to release
              </Text>
            </View>
          )}

        </ScrollView>
        </BlurTargetView>

        <BottomActionBar variant="glass" blurTarget={blurTarget}>
          <Button
            title="Next"
            icon="arrowRight"
            iconPosition="right"
            onPress={handleNext}
            disabled={releaseItems.length === 0}
            variant="black"
          />
        </BottomActionBar>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  contentTarget: { flex: 1 },
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
  content: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, gap: SPACING.sm, paddingBottom: 40 },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    backgroundColor: '#FFFFFF',
  },
  requestInfo: { flex: 1 },
  requestEyebrow: {
    fontSize: 10,
    letterSpacing: 0.8,
    color: COLORS.textTertiary,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  requestRecipient: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.textPrimary,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  requestMeta: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  hint: { marginBottom: SPACING.xs },
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
  changedBanner: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.md,
    marginTop: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE1A8',
    backgroundColor: '#FFF4E0',
  },
  changedTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    color: '#7A4A00',
    marginBottom: 2,
  },
  changedText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: '#7A4A00',
    marginTop: 2,
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
    borderColor: COLORS.borderSubtle,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  itemRow: {
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.dividerSubtle,
    gap: 10,
  },
  itemRowFirst: { borderTopWidth: 0 },
  itemRowZero: { backgroundColor: '#FAFAFB' },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#F7F8FA',
    borderWidth: 1,
    borderColor: '#EEEEEE',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  thumbImage: { width: '100%', height: '100%' },
  itemInfo: { flex: 1 },
  itemName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
  },
  itemMeta: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  stepperBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF4FF',
  },
  qtyInput: {
    minWidth: 72,
    height: 44,
    borderWidth: 1.5,
    borderColor: '#B9D9FF',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
    fontSize: 18,
    color: COLORS.textPrimary,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    paddingVertical: 0,
  },
  itemHint: { fontSize: 12, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.regular },
  itemHintZero: { color: COLORS.textTertiary },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#EAF4FF',
  },
  summaryText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    color: '#0A66C2',
  },
});
