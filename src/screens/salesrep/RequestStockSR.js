// src/screens/salesrep/RequestStockSR.js
// Same layout as ManagerStockScreen (header, branch banner, search + filter,
// three status sections, StockBatchCard rows). Shows branch inventory, since a
// request is made against what the branch can supply. Tapping a card opens a
// quantity popup and adds the product to the request list.
import React, { useCallback, useState } from 'react';
import { View, Text, Image, ScrollView, TextInput, TouchableOpacity, Pressable, Alert, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import Input from '../../components/common/Input';
import Icon from '../../components/common/Icon';
import StockBatchCard from '../../components/common/StockBatchCard';
import FilterSheet from '../../components/common/FilterSheet';
import CustomModal from '../../components/common/Modal';
import BranchSelector from '../../components/common/BranchSelector';
import SkeletonBlock from '../../components/ui/SkeletonBlock';
import authService from '../../services/authService';
import inventoryService from '../../services/inventoryService';
import requestService from '../../services/requestService';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import { STOCK_HEALTHY_THRESHOLD, NEAR_EXPIRY_DAYS } from '../../constants/inventory';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { daysUntil } from '../../utils/formatters';

const BRANCH_HEADER_HEIGHT = 76;

const EXPIRY_FILTER_OPTIONS = [
  { key: 'all', label: 'All Batches' },
  { key: 'nearExpiry', label: 'Near Expiry Only' },
];

export default function RequestStockSR() {
  const navigation = useNavigation();
  const [agent, setAgent] = useState(null);
  const [stock, setStock] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [expiryFilter, setExpiryFilter] = useState('all');
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [cart, setCart] = useState([]);
  const [activeProduct, setActiveProduct] = useState(null);
  const [modalQty, setModalQty] = useState(1);
  const [qtyText, setQtyText] = useState('1');

  // Keeps the number and the text box in sync (stepper buttons and reset).
  const setQty = (n) => {
    setModalQty(n);
    setQtyText(String(n));
  };

  const loadStock = useCallback(async () => {
    setIsLoading(true);
    const currentAgent = await authService.getCurrentUser();
    setAgent(currentAgent);

    // Each branch has its own storage, so the screen shows one branch at a time.
    const agentBranches = await requestService.getAgentBranches(currentAgent?.branchIds || []);
    setBranches(agentBranches);
    setSelectedBranchId((prev) => prev ?? agentBranches[0]?.id ?? null);

    const result = await inventoryService.getBranchStockForAgent(currentAgent?.id);
    setStock(result.success ? result.data : []);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStock();
    }, [loadStock])
  );

  const cartCount = cart.length;
  const selectedBranch = branches.find((b) => b.id === selectedBranchId);
  // Stock for the one branch this request is for, so every limit is per branch.
  const branchStock = stock.filter((row) => row.branch_id === selectedBranchId);

  // Total branch quantity per product code, used for the "on hand" line in the popup.
  const qtyByCode = branchStock.reduce((map, row) => {
    map[row.product_code] = (map[row.product_code] || 0) + row.quantity;
    return map;
  }, {});

  const query = searchText.trim().toLowerCase();
  const matchesQuery = (name, code) =>
    !query || name.toLowerCase().includes(query) || code.toLowerCase().includes(query);

  const matchesExpiryFilter = (row) => {
    if (expiryFilter !== 'nearExpiry') return true;
    const daysLeft = daysUntil(row.exp_date);
    return daysLeft !== null && daysLeft <= NEAR_EXPIRY_DAYS;
  };

  const healthyBatches = branchStock.filter(
    (row) =>
      row.quantity >= STOCK_HEALTHY_THRESHOLD &&
      matchesQuery(row.product_name, row.product_code) &&
      matchesExpiryFilter(row)
  );
  const lowStockBatches = branchStock.filter(
    (row) =>
      row.quantity > 0 &&
      row.quantity < STOCK_HEALTHY_THRESHOLD &&
      matchesQuery(row.product_name, row.product_code) &&
      matchesExpiryFilter(row)
  );
  const stockedCodes = new Set(branchStock.filter((row) => row.quantity > 0).map((row) => row.product_code));
  const outOfStockProducts = PRODUCT_CATALOG.filter(
    (product) => !stockedCodes.has(product.code) && matchesQuery(product.name, product.code)
  );

  // Most a rep can ask for is what the branch has on hand for that product.
  const availableFor = (code) => qtyByCode[code] || 0;

  // One request goes to one branch, so the list only ever holds one branch's
  // items. Switching branch with items in it asks first, then clears the list.
  const handleSelectBranch = (branchId) => {
    if (branchId === selectedBranchId) return;
    if (cart.length === 0) {
      setSelectedBranchId(branchId);
      return;
    }
    const next = branches.find((b) => b.id === branchId);
    Alert.alert(
      'Switch branch?',
      `Your request list has ${cart.length} item${cart.length === 1 ? '' : 's'} for ${selectedBranch?.name || 'this branch'}. Switching to ${next?.name || 'the other branch'} clears it.`,
      [
        { text: 'Keep list', style: 'cancel' },
        {
          text: 'Clear and switch',
          style: 'destructive',
          onPress: () => {
            setCart([]);
            setSelectedBranchId(branchId);
          },
        },
      ]
    );
  };

  const openRequestModal = (code, name) => {
    const existing = cart.find((line) => line.productCode === code);
    setQty(Math.min(availableFor(code), existing?.quantity || 1));
    setActiveProduct({ code, name, image: PRODUCT_CATALOG.find((p) => p.code === code)?.image });
  };

  const closeRequestModal = () => {
    setActiveProduct(null);
    setQty(1);
  };

  const handleSaveRequest = () => {
    if (!activeProduct || modalQty <= 0 || modalQty > availableFor(activeProduct.code)) return;
    setCart((prev) => {
      const withoutExisting = prev.filter((line) => line.productCode !== activeProduct.code);
      return [...withoutExisting, { productCode: activeProduct.code, productName: activeProduct.name, quantity: modalQty }];
    });
    closeRequestModal();
  };

  const handleViewRequestList = () => {
    if (cartCount === 0) return;
    navigation.navigate('RequestListSR', {
      items: cart,
      stock: branchStock,
      branchId: selectedBranchId,
      branchName: selectedBranch?.name || '',
    });
  };

  // Wraps a StockBatchCard so tapping it opens the request popup, and shows
  // a "Requesting N" tag when that product is already on the request list.
  const renderRequestableCard = (key, code, name, card) => {
    const inCart = cart.find((line) => line.productCode === code);
    return (
      <TouchableOpacity
        key={key}
        onPress={() => openRequestModal(code, name)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Request ${name}`}
      >
        {card}
        {inCart && (
          <View style={styles.inCartTag}>
            <Icon name="checkCircle" size={10} color={COLORS.primary} weight="fill" />
            <Text style={styles.inCartText}>Requesting {inCart.quantity}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderBatchRow = (batches) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
      {batches.map((row) =>
        renderRequestableCard(
          row.id,
          row.product_code,
          row.product_name,
          <StockBatchCard
            productName={row.product_name}
            image={PRODUCT_CATALOG.find((p) => p.code === row.product_code)?.image}
            quantity={row.quantity}
            batchNumber={row.batch_number}
            expDate={row.exp_date}
          />
        )
      )}
    </ScrollView>
  );

  const renderOutOfStockRow = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
      {outOfStockProducts.map((product) =>
        renderRequestableCard(
          product.code,
          product.code,
          product.name,
          <StockBatchCard productName={product.name} image={product.image} outOfStock />
        )
      )}
    </ScrollView>
  );

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          title="Request Stock"
          titleAlign="left"
          showBackButton
          backButtonText="Back"
          onBackPress={() => navigation.goBack()}
          showDocumentIcon
          onDocumentPress={() => navigation.navigate('SalesRepLogs')}
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
        />

        <SecondaryHeader height={BRANCH_HEADER_HEIGHT}>
          <View style={styles.branchRow}>
            <View style={styles.branchTextCol}>
              <Text style={styles.branchName} numberOfLines={1}>
                {selectedBranch?.name || 'No branch assigned'}
              </Text>
              <Text style={styles.branchSubtitle}>Branch Inventory</Text>
            </View>
            <View style={styles.onlinePill}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Online</Text>
            </View>
          </View>
        </SecondaryHeader>

        <BranchSelector branches={branches} selectedId={selectedBranchId} onSelect={handleSelectBranch} />

        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Input icon="search" placeholder="Search products" value={searchText} onChangeText={setSearchText} />
          </View>
          <TouchableOpacity
            style={styles.filterButtonWrap}
            onPress={() => setIsFilterSheetVisible(true)}
            activeOpacity={0.7}
            accessibilityLabel="Filters"
            accessibilityRole="button"
          >
            <Icon name="filter" size={20} color={COLORS.primary} />
            {expiryFilter !== 'all' && <View style={styles.filterActiveDot} />}
          </TouchableOpacity>
        </View>

        {expiryFilter !== 'all' && (
          <View style={styles.activeFilterRow}>
            <View style={styles.activeFilterChip}>
              <Text style={styles.activeFilterChipText}>Near Expiry Only</Text>
              <TouchableOpacity
                onPress={() => setExpiryFilter('all')}
                accessibilityLabel="Clear filter"
                accessibilityRole="button"
              >
                <Icon name="xCircle" size={16} color={COLORS.primary} weight="fill" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isLoading ? (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <SkeletonBlock width={180} height={18} borderRadius={4} style={styles.skeletonSectionTitle} />
            <View style={styles.skeletonCardRow}>
              <SkeletonBlock width={152} height={140} borderRadius={12} />
              <SkeletonBlock width={152} height={140} borderRadius={12} />
            </View>
            <SkeletonBlock
              width={180}
              height={18}
              borderRadius={4}
              style={[styles.skeletonSectionTitle, styles.sectionSpacing]}
            />
            <View style={styles.skeletonCardRow}>
              <SkeletonBlock width={152} height={140} borderRadius={12} />
              <SkeletonBlock width={152} height={140} borderRadius={12} />
            </View>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.statusDot, { backgroundColor: COLORS.success }]} />
              <Text style={styles.sectionTitle}>In-Stocks (Healthy Levels)</Text>
            </View>
            {healthyBatches.length > 0 ? (
              renderBatchRow(healthyBatches)
            ) : (
              <Text style={styles.emptyText}>No batches at healthy levels right now.</Text>
            )}

            <View style={[styles.sectionHeaderRow, styles.sectionSpacing]}>
              <View style={[styles.statusDot, { backgroundColor: COLORS.warning }]} />
              <Text style={styles.sectionTitle}>Almost Out of Stock (Resupply Soon)</Text>
            </View>
            {lowStockBatches.length > 0 ? (
              renderBatchRow(lowStockBatches)
            ) : (
              <Text style={styles.emptyText}>Nothing running low right now.</Text>
            )}

            <View style={[styles.sectionHeaderRow, styles.sectionSpacing]}>
              <View style={[styles.statusDot, { backgroundColor: COLORS.error }]} />
              <Text style={styles.sectionTitle}>Out of Stock (Empty Shelves)</Text>
            </View>
            {outOfStockProducts.length > 0 ? (
              renderOutOfStockRow()
            ) : (
              <Text style={styles.emptyText}>Every catalog product has stock on hand.</Text>
            )}

            <View style={{ height: cartCount > 0 ? 72 : 24 }} />
          </ScrollView>
        )}

        {cartCount > 0 && (
          <Pressable style={styles.reviewBar} onPress={handleViewRequestList}>
            <Text style={styles.reviewBarText}>({cartCount}) View Request List</Text>
          </Pressable>
        )}
      </View>

      <FilterSheet
        visible={isFilterSheetVisible}
        onClose={() => setIsFilterSheetVisible(false)}
        title="Filter Stock"
        options={EXPIRY_FILTER_OPTIONS}
        selectedKey={expiryFilter}
        onSelect={setExpiryFilter}
      />

      <CustomModal visible={!!activeProduct} onClose={closeRequestModal} height={380}>
        {activeProduct && (
          <View>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalTextCol}>
                <Text style={styles.modalTitle} numberOfLines={2}>{activeProduct.name}</Text>
                <Text style={styles.modalSubtitle}>Code: {activeProduct.code}</Text>
                <View style={styles.modalOnHandPill}>
                  <Icon name="boxPackage" size={12} color={COLORS.primary} />
                  <Text style={styles.modalOnHandText}>{qtyByCode[activeProduct.code] || 0} pcs at branch</Text>
                </View>
              </View>
              <View style={styles.modalImageWrap}>
                {activeProduct.image ? (
                  <Image source={activeProduct.image} style={styles.modalImage} resizeMode="contain" />
                ) : (
                  <Icon name="package" size={32} color="#94a3b8" />
                )}
              </View>
            </View>

            <Text style={styles.modalLabel}>Quantity to request</Text>
            {availableFor(activeProduct.code) === 0 ? (
              <Text style={styles.noStockText}>Out of stock at the branch, nothing to request.</Text>
            ) : (
              <Text style={styles.maxHintText}>Up to {availableFor(activeProduct.code)} pcs</Text>
            )}
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={styles.stepperBtnMinus}
                onPress={() => setQty(Math.max(1, modalQty - 1))}
                accessibilityLabel="Decrease quantity"
                accessibilityRole="button"
              >
                <Icon name="minus" size={16} color={COLORS.primary} weight="bold" />
              </TouchableOpacity>
              <TextInput
                style={styles.qtyInputModal}
                value={qtyText}
                keyboardType="number-pad"
                selectTextOnFocus
                maxLength={5}
                onChangeText={(text) => {
                  const digits = text.replace(/\D/g, '');
                  const capped = Math.min(parseInt(digits, 10) || 0, availableFor(activeProduct.code));
                  setQtyText(digits === '' ? '' : String(capped));
                  setModalQty(capped);
                }}
                onEndEditing={() => setQty(Math.min(availableFor(activeProduct.code), Math.max(1, modalQty)))}
                accessibilityLabel="Quantity to request"
              />
              <TouchableOpacity
                style={styles.stepperBtnPlus}
                onPress={() => setQty(Math.min(availableFor(activeProduct.code), modalQty + 1))}
                accessibilityLabel="Increase quantity"
                accessibilityRole="button"
              >
                <Icon name="plus" size={16} color="#FFFFFF" weight="bold" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtonRow}>
              <Pressable style={styles.cancelBtn} onPress={closeRequestModal} accessibilityRole="button">
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleSaveRequest} accessibilityRole="button">
                <Text style={styles.saveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        )}
      </CustomModal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  branchRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
  },
  branchTextCol: { flexShrink: 1 },
  branchName: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  branchSubtitle: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' },
  onlineText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.success,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  searchInputWrap: { flex: 1, marginBottom: -SPACING.md },
  filterButtonWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#757575',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7FEFF',
  },
  filterActiveDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
  },
  activeFilterRow: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm },
  activeFilterChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '12',
  },
  activeFilterChipText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.primary,
  },
  skeletonSectionTitle: { marginBottom: SPACING.sm },
  skeletonCardRow: { flexDirection: 'row', gap: SPACING.sm },
  content: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: 96 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: SPACING.xs },
  sectionSpacing: { marginTop: SPACING.md },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  cardRow: { gap: SPACING.sm, paddingRight: SPACING.sm },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  inCartTag: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary + '15',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 4,
  },
  inCartText: {
    fontSize: 9,
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  reviewBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 48,
    backgroundColor: '#03045E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewBarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },

  // Request popup
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  modalTextCol: { flex: 1 },
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  modalSubtitle: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  modalOnHandPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '12',
  },
  modalOnHandText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.primary,
  },
  modalImageWrap: {
    width: 84,
    height: 84,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImage: { width: 64, height: 64 },
  modalLabel: {
    marginTop: SPACING.lg,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    color: '#272632',
  },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginTop: SPACING.sm },
  stepperBtnMinus: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  stepperBtnPlus: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  stepperValue: {
    minWidth: 40,
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  noStockText: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: COLORS.error,
  },
  maxHintText: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  qtyInputModal: {
    minWidth: 96,
    height: 44,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 12,
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
    backgroundColor: '#FFFFFF',
  },
  modalButtonRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  cancelBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#B0B0B0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  cancelText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: '#555353',
  },
  saveBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  saveText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: '#FFFFFF',
  },
});
