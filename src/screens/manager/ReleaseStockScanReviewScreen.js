// src/screens/manager/ReleaseStockScanReviewScreen.js
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import Alert from '../../utils/appAlert';
import { StatusBar } from 'expo-status-bar';
import { BlurTargetView } from 'expo-blur';
import { useNavigation, useRoute } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import LiveStatusPill from '../../components/common/LiveStatusPill';
import Icon from '../../components/common/Icon';
import Stepper from '../../components/common/Stepper';
import Button from '../../components/common/Button';
import BottomActionBar, { useBottomActionBarHeight } from '../../components/common/BottomActionBar';
import QRScannerModal from '../../components/common/QRScannerModal';
import CustomModal from '../../components/common/Modal';
import authService from '../../services/authService';
import inventoryService from '../../services/inventoryService';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import { STOCK_HEALTHY_THRESHOLD, NEAR_EXPIRY_DAYS } from '../../constants/inventory';
import { daysUntil } from '../../utils/formatters';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const STEP_LABELS = ['Who receives the stock?', 'How many items?', 'Final Proof'];
const LEVEL_OK = { label: 'In-stock', bg: '#E1F4E8', color: '#1E7A3A' };
const LEVEL_LOW = { label: 'Almost out', bg: '#FFF1D6', color: '#B26400' };

import { isExpired } from '../../utils/expiry';

const toReleaseItem = (row, releaseQty) => ({
  branchInventoryId: row.id,
  productCode: row.product_code,
  productName: row.product_name,
  batchNumber: row.batch_number,
  currentQty: row.quantity,
  releaseQty,
  mfgDate: row.mfg_date,
  expDate: row.exp_date,
});

export default function ReleaseStockScanReviewScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { recipient, targetRecipient, branchId, movementType, qrCode } = route.params;
  const bottomActionBarHeight = useBottomActionBarHeight();
  const blurTarget = useRef(null);
  // While a quantity box is being typed in, what it currently shows (so it can be empty for a moment).
  const [qtyText, setQtyText] = useState({});

  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [items, setItems] = useState([]);
  // Products left out of the list because their batch has expired.
  const [expiredNames, setExpiredNames] = useState([]);

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
      const inStock = (result.data.branch_inventory || []).filter((row) => row.quantity > 0);
      // Expired batches are left out (BL-1), with a note saying so.
      const batchItems = inStock.filter((row) => !isExpired(row.exp_date)).map((row) => toReleaseItem(row, row.quantity));
      setExpiredNames(inStock.filter((row) => isExpired(row.exp_date)).map((row) => row.product_name));

      setItems(batchItems);
      setIsLoading(false);
    })();
  }, [qrCode]);

  // "Add More Stock": several batches/products in one release, so the Sales
  // Rep (or Collector) scans a single QR for all of them. Requested by the
  // PM via Jay, Oct 19.
  const [isAddMenuVisible, setIsAddMenuVisible] = useState(false);
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [branchStock, setBranchStock] = useState([]);
  const [isLoadingStock, setIsLoadingStock] = useState(false);

  // Adds batch rows; a batch already in the list just gets more units.
  const addRows = (rows, qtyFor) => {
    setItems((prev) => {
      const next = prev.map((item) => ({ ...item }));
      rows.filter((row) => row.quantity > 0 && !isExpired(row.exp_date)).forEach((row) => {
        const existing = next.find((item) => item.branchInventoryId === row.id);
        if (existing) {
          existing.releaseQty = Math.min(existing.currentQty, existing.releaseQty + qtyFor(row));
        } else {
          next.push(toReleaseItem(row, Math.min(row.quantity, qtyFor(row))));
        }
      });
      return next;
    });
    setNotFound(false);
  };

  const handleScannedMore = async (code) => {
    setIsScannerVisible(false);
    const manager = await authService.getCurrentUser();
    const result = await inventoryService.getReceivingBatchByQrCode(code, manager?.branchIds || []);
    if (!result.success || !result.data) {
      Alert.alert('QR Code Not Recognized', "This code doesn't match a batch received at your branch.");
      return;
    }
    // One release comes out of one branch's storage: a multi-branch manager
    // can't mix in a batch from another branch (the server doesn't check it).
    if (branchId && result.data.branch_id !== branchId) {
      Alert.alert('Different Branch', 'This batch belongs to another branch. A release can only include stock from the branch you are releasing from.');
      return;
    }
    const inStock = (result.data.branch_inventory || []).filter((row) => row.quantity > 0);
    if (inStock.length === 0) {
      Alert.alert('Nothing Left', 'Every item from this batch has already been given out.');
      return;
    }
    const rows = inStock.filter((row) => !isExpired(row.exp_date));
    if (rows.length < inStock.length) {
      const expired = inStock.filter((row) => isExpired(row.exp_date)).map((row) => row.product_name);
      if (rows.length === 0) {
        Alert.alert('Expired Stock', `${expired.join(', ')} has expired and can't be released.`);
        return;
      }
      Alert.alert('Expired Stock Skipped', `${expired.join(', ')} has expired and was not added.`);
    }
    // Same QR scanned again: don't add it twice — the amount is changed with
    // the + / − buttons on its row.
    const alreadyListed = rows.filter((row) => items.some((item) => item.branchInventoryId === row.id));
    if (alreadyListed.length === rows.length) {
      Alert.alert(
        'Already Scanned',
        `${rows.map((row) => row.product_name).join(', ')} is already in the list. Use + on its row to release more units.`
      );
      return;
    }
    // A batch with some items already listed: only the new ones are added.
    addRows(rows.filter((row) => !alreadyListed.includes(row)), (row) => row.quantity);
  };

  const openPicker = async () => {
    setIsAddMenuVisible(false);
    setIsPickerVisible(true);
    setIsLoadingStock(true);
    const manager = await authService.getCurrentUser();
    const result = await inventoryService.getBranchStock(branchId ? [branchId] : manager?.branchIds || []);
    setBranchStock((result.success ? result.data : []).filter((row) => row.quantity > 0));
    setIsLoadingStock(false);
  };

  const handleAdjustQty = (branchInventoryId, delta) => {
    setItems((prev) =>
      prev.map((item) =>
        item.branchInventoryId === branchInventoryId
          ? { ...item, releaseQty: Math.max(0, Math.min(item.currentQty, item.releaseQty + delta)) }
          : item
      )
    );
  };

  const forgetText = (id) =>
    setQtyText((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  const handleStep = (id, delta) => {
    forgetText(id);
    handleAdjustQty(id, delta);
  };
  // Typed quantity: digits only, never more than the stock on hand.
  const handleTypeQty = (id, text) => {
    const digits = text.replace(/\D/g, '');
    setItems((prev) =>
      prev.map((item) =>
        item.branchInventoryId === id ? { ...item, releaseQty: Math.min(item.currentQty, parseInt(digits, 10) || 0) } : item
      )
    );
    setQtyText((prev) => {
      const item = items.find((x) => x.branchInventoryId === id);
      const capped = Math.min(item ? item.currentQty : 0, parseInt(digits, 10) || 0);
      return { ...prev, [id]: digits === '' ? '' : String(capped) };
    });
  };
  const handleSetAll = (id, toAll) => {
    forgetText(id);
    setItems((prev) => prev.map((item) => (item.branchInventoryId === id ? { ...item, releaseQty: toAll ? item.currentQty : 0 } : item)));
  };
  const handleRemoveItem = (id) => {
    forgetText(id);
    setItems((prev) => prev.filter((item) => item.branchInventoryId !== id));
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

          <Text style={styles.sectionTitle}>Items to Release</Text>

          {expiredNames.length > 0 && !isLoading && (
            <View style={styles.expiredNote}>
              <Icon name="warningTriangle" size={16} color={COLORS.error} />
              <Text style={styles.expiredNoteText}>
                {expiredNames.join(', ')} has expired, so it can't be released and was left out.
              </Text>
            </View>
          )}

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
              {items.map((item, index) => {
                const image = PRODUCT_CATALOG.find((p) => p.code === item.productCode || p.code === item.productName)?.image;
                const level = item.currentQty < STOCK_HEALTHY_THRESHOLD ? LEVEL_LOW : LEVEL_OK;
                const days = item.expDate ? daysUntil(item.expDate) : null;
                const nearExpiry = days !== null && days >= 0 && days <= NEAR_EXPIRY_DAYS;
                const all = item.releaseQty === item.currentQty;
                return (
                  <View
                    key={item.branchInventoryId}
                    style={[styles.itemRowC, index === 0 && styles.itemRowFirst, item.releaseQty === 0 && styles.itemRowZero]}
                  >
                    <View style={styles.itemTopC}>
                      <View style={styles.thumbC}>
                        {image ? (
                          <Image source={image} style={styles.thumbImageC} resizeMode="contain" />
                        ) : (
                          <Icon name="package" size={24} color="#94a3b8" />
                        )}
                      </View>
                      <View style={styles.itemInfoC}>
                        <Text style={styles.itemNameC} numberOfLines={2}>{item.productName}</Text>
                        <Text style={styles.itemMetaC}>
                          Stock {item.currentQty} pcs{item.expDate ? ` · Exp ${new Date(item.expDate).toLocaleDateString()}` : ''}
                        </Text>
                        <View style={styles.tagRowC}>
                          <View style={[styles.tagC, { backgroundColor: level.bg }]}>
                            <Text style={[styles.tagTextC, { color: level.color }]}>{level.label}</Text>
                          </View>
                          {nearExpiry && (
                            <View style={[styles.tagC, { backgroundColor: '#FFF1D6' }]}>
                              <Text style={[styles.tagTextC, { color: '#B26400' }]}>Near expiry</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      {items.length > 1 && (
                        <TouchableOpacity
                          onPress={() => handleRemoveItem(item.branchInventoryId)}
                          hitSlop={8}
                          style={styles.removeBtnC}
                          accessibilityLabel={`Remove ${item.productName} from this release`}
                          accessibilityRole="button"
                        >
                          <Icon name="trash" size={18} color={COLORS.error} />
                        </TouchableOpacity>
                      )}
                    </View>

                    <View style={styles.qtyRowC}>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => handleStep(item.branchInventoryId, -1)}
                        accessibilityLabel={`Decrease ${item.productName} release quantity`}
                      >
                        <Icon name="minus" size={14} color={COLORS.primary} />
                      </TouchableOpacity>
                      <TextInput
                        style={styles.qtyInputC}
                        value={item.branchInventoryId in qtyText ? qtyText[item.branchInventoryId] : String(item.releaseQty)}
                        keyboardType="number-pad"
                        selectTextOnFocus
                        maxLength={5}
                        onChangeText={(text) => handleTypeQty(item.branchInventoryId, text)}
                        onEndEditing={() => forgetText(item.branchInventoryId)}
                        accessibilityLabel={`${item.productName} release quantity`}
                      />
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => handleStep(item.branchInventoryId, 1)}
                        accessibilityLabel={`Increase ${item.productName} release quantity`}
                      >
                        <Icon name="plus" size={14} color={COLORS.primary} />
                      </TouchableOpacity>
                      <View style={{ flex: 1 }} />
                      <TouchableOpacity
                        style={styles.allBtnC}
                        onPress={() => handleSetAll(item.branchInventoryId, !all)}
                        accessibilityRole="button"
                        accessibilityLabel={all ? 'Set quantity to zero' : 'Release all of this stock'}
                      >
                        <Text style={styles.allBtnTextC}>{all ? 'Clear' : 'All'}</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.hintC, all && styles.hintAllC, item.releaseQty === 0 && styles.hintZeroC]}>
                      {item.releaseQty === 0 ? 'Not included in this release' : `Releasing ${item.releaseQty} of ${item.currentQty}`}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {!isLoading && (
            <TouchableOpacity style={styles.addMoreButton} onPress={() => setIsAddMenuVisible(true)} activeOpacity={0.8}>
              <Icon name="plus" size={16} color={COLORS.primary} />
              <Text style={styles.addMoreText}>Add More Stock</Text>
            </TouchableOpacity>
          )}

          {releaseItems.length > 0 && (
            <View style={styles.summaryCardC}>
              <Icon name="package" size={18} color={COLORS.primary} />
              <Text style={styles.summaryCardText}>
                {releaseItems.length} item{releaseItems.length === 1 ? '' : 's'} · {totalUnits} unit{totalUnits === 1 ? '' : 's'} to release
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

      <CustomModal visible={isAddMenuVisible} onClose={() => setIsAddMenuVisible(false)} height="auto">
        <Text style={styles.modalTitle}>Add More Stock</Text>
        <Text style={styles.modalSubtitle}>Everything goes out together under one QR.</Text>
        <TouchableOpacity
          style={styles.menuRow}
          onPress={() => {
            setIsAddMenuVisible(false);
            setIsScannerVisible(true);
          }}
        >
          <Icon name="qrCode" size={20} color={COLORS.primary} />
          <View style={styles.menuTextWrap}>
            <Text style={styles.menuTitle}>Scan another batch QR</Text>
            <Text style={styles.menuText}>Adds every item in that batch.</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuRow} onPress={openPicker}>
          <Icon name="package" size={20} color={COLORS.primary} />
          <View style={styles.menuTextWrap}>
            <Text style={styles.menuTitle}>Pick from branch stock</Text>
            <Text style={styles.menuText}>Choose products already on your shelf.</Text>
          </View>
        </TouchableOpacity>
      </CustomModal>

      <CustomModal visible={isPickerVisible} onClose={() => setIsPickerVisible(false)} height={520}>
        <Text style={styles.modalTitle}>Branch Stock</Text>
        <Text style={styles.modalSubtitle}>Tap a batch to add 1 unit. Adjust the amount after.</Text>
        {isLoadingStock ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={styles.pickerLoading} />
        ) : (
          <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
            {branchStock.length === 0 && <Text style={styles.menuText}>No stock on hand at this branch.</Text>}
            {branchStock.map((row) => {
              const inList = items.find((item) => item.branchInventoryId === row.id);
              const expired = isExpired(row.exp_date);
              return (
                <TouchableOpacity
                  key={row.id}
                  style={[styles.stockRow, expired && styles.stockRowExpired]}
                  onPress={() => addRows([row], () => 1)}
                  disabled={expired}
                >
                  <View style={styles.menuTextWrap}>
                    <Text style={styles.menuTitle}>{row.product_name}</Text>
                    <Text style={styles.menuText}>
                      {row.quantity} pcs{row.exp_date ? ' · Exp ' + new Date(row.exp_date).toLocaleDateString() : ''}
                    </Text>
                  </View>
                  {expired ? (
                    <Text style={styles.expiredText}>Expired</Text>
                  ) : inList ? (
                    <Text style={styles.inListText}>{inList.releaseQty} added</Text>
                  ) : (
                    <Icon name="plus" size={16} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
        <Button
          title="Done"
          variant="black"
          onPress={() => setIsPickerVisible(false)}
          height={44}
          fontSize={15}
          style={styles.pickerDone}
        />
      </CustomModal>

      <QRScannerModal visible={isScannerVisible} onClose={() => setIsScannerVisible(false)} onScanned={handleScannedMore} />
    </>
  );
}

const styles = StyleSheet.create({
  contentTarget: { flex: 1 },
  itemRowC: { padding: SPACING.md, borderTopWidth: 1, borderTopColor: '#F0F0F0', gap: 10 },
  itemRowZero: { backgroundColor: '#FAFAFB' },
  itemTopC: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  thumbC: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#F7F8FA', borderWidth: 1, borderColor: '#EEEEEE', alignItems: 'center', justifyContent: 'center', padding: 4 },
  thumbImageC: { width: '100%', height: '100%' },
  itemInfoC: { flex: 1 },
  itemNameC: { fontSize: TYPOGRAPHY.fontSize.base, color: '#272632', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  itemMetaC: { marginTop: 2, fontSize: 12, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.regular },
  tagRowC: { marginTop: 5, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagC: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  tagTextC: { fontSize: 11, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  removeBtnC: { padding: 4 },
  qtyRowC: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  qtyInputC: { minWidth: 72, height: 44, borderWidth: 1.5, borderColor: '#B9D9FF', borderRadius: 12, textAlign: 'center', fontSize: 18, color: '#272632', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', backgroundColor: '#FFFFFF', paddingVertical: 0 },
  allBtnC: { paddingHorizontal: 16, height: 36, borderRadius: 18, backgroundColor: '#EAF4FF', alignItems: 'center', justifyContent: 'center' },
  allBtnTextC: { fontSize: 13, color: '#0085F9', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  hintC: { fontSize: 12, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.regular },
  hintAllC: { color: '#B26400' },
  hintZeroC: { color: '#9AA3B2' },
  summaryCardC: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#EAF4FF' },
  summaryCardText: { fontSize: TYPOGRAPHY.fontSize.sm, color: '#0A66C2', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  container: { flex: 1, backgroundColor: COLORS.background },
  addMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: SPACING.md,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
    backgroundColor: '#FFFFFF',
  },
  addMoreText: { fontSize: TYPOGRAPHY.fontSize.sm, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', color: COLORS.primary },
  modalTitle: { fontSize: TYPOGRAPHY.fontSize.lg, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', color: '#272632' },
  modalSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
    marginTop: 2,
    marginBottom: SPACING.md,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EAEFF5',
  },
  menuTextWrap: { flex: 1 },
  menuTitle: { fontSize: TYPOGRAPHY.fontSize.sm, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', color: '#272632' },
  menuText: { fontSize: TYPOGRAPHY.fontSize.xs, fontFamily: TYPOGRAPHY.fontFamily.regular, color: COLORS.textSecondary, marginTop: 2 },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  inListText: { fontSize: TYPOGRAPHY.fontSize.xs, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', color: COLORS.success },
  pickerList: { flex: 1 },
  pickerLoading: { marginTop: SPACING.lg },
  pickerDone: { marginTop: SPACING.sm, width: '100%' },
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
    fontSize: 12,
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
  stockRowExpired: { opacity: 0.55 },
  expiredText: { fontSize: 12, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', color: COLORS.error },
  expiredNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: 12,
    backgroundColor: '#FDECEC',
  },
  expiredNoteText: { flex: 1, fontSize: 12, fontFamily: TYPOGRAPHY.fontFamily.regular, color: COLORS.error },
});
