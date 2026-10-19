// src/screens/manager/ReleaseStockScanReviewScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
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
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const STEP_LABELS = ['Who receives the stock?', 'How many items?', 'Final Proof'];

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
        .map((row) => toReleaseItem(row, row.quantity));

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
      rows.filter((row) => row.quantity > 0).forEach((row) => {
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
    const rows = (result.data.branch_inventory || []).filter((row) => row.quantity > 0);
    if (rows.length === 0) {
      Alert.alert('Nothing Left', 'Every item from this batch has already been given out.');
      return;
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

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomActionBarHeight + SPACING.md }]}
          showsVerticalScrollIndicator={false}
        >
          <Stepper currentStep={2} labels={STEP_LABELS} />

          <Text style={styles.sectionTitle}>Items to Release</Text>

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

          {!isLoading && (
            <TouchableOpacity style={styles.addMoreButton} onPress={() => setIsAddMenuVisible(true)} activeOpacity={0.8}>
              <Icon name="plus" size={16} color={COLORS.primary} />
              <Text style={styles.addMoreText}>Add More Stock</Text>
            </TouchableOpacity>
          )}

          {releaseItems.length > 0 && (
            <Text style={styles.summaryText}>
              📦 {releaseItems.length} item{releaseItems.length === 1 ? '' : 's'}, {totalUnits} units to release
            </Text>
          )}

        </ScrollView>

        <BottomActionBar>
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
              return (
                <TouchableOpacity key={row.id} style={styles.stockRow} onPress={() => addRows([row], () => 1)}>
                  <View style={styles.menuTextWrap}>
                    <Text style={styles.menuTitle}>{row.product_name}</Text>
                    <Text style={styles.menuText}>
                      {row.quantity} pcs{row.exp_date ? ' · Exp ' + new Date(row.exp_date).toLocaleDateString() : ''}
                    </Text>
                  </View>
                  {inList ? (
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
});
