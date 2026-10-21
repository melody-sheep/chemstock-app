// src/screens/salesrep/RequestStockSR.js
// Same layout as ManagerStockScreen (header, branch banner, search + filter,
// three status sections, StockBatchCard rows). Shows branch inventory, since a
// request is made against what the branch can supply. Tapping a card opens a
// quantity popup and adds the product to the request list.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, ScrollView, TextInput, TouchableOpacity, Pressable, Animated, StyleSheet } from 'react-native';
import Alert from '../../utils/appAlert';
import { StatusBar } from 'expo-status-bar';
import { BlurTargetView } from 'expo-blur';
import { useNavigation, useRoute } from '@react-navigation/native';
import Header from '../../components/common/Header';
import useConnectionStatus from '../../hooks/useConnectionStatus';
import useOnlineLabel from '../../hooks/useOnlineLabel';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import Button from '../../components/common/Button';
import BottomActionBar, { useBottomActionBarHeight } from '../../components/common/BottomActionBar';
import StockSectionHeader from '../../components/common/StockSectionHeader';
import Icon from '../../components/common/Icon';
import StockBatchCard from '../../components/common/StockBatchCard';
import CustomModal from '../../components/common/Modal';
import BranchSelector from '../../components/common/BranchSelector';
import SkeletonBlock from '../../components/ui/SkeletonBlock';
import useCachedFocusLoader from '../../hooks/useCachedFocusLoader';
import authService from '../../services/authService';
import inventoryService from '../../services/inventoryService';
import requestService from '../../services/requestService';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import { STOCK_HEALTHY_THRESHOLD, NEAR_EXPIRY_DAYS } from '../../constants/inventory';
import HintChip from '../../components/common/HintChip';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { daysUntil } from '../../utils/formatters';
import { isExpired } from '../../utils/expiry';

const BRANCH_HEADER_HEIGHT = 76;

// Same filters and sorting as the Manager stock screen; they work on the batches already loaded.
const EXPIRY_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'nearExpiry', label: 'Near expiry' },
  { key: 'expired', label: 'Expired' },
];
const LEVEL_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'healthy', label: 'In-stock' },
  { key: 'low', label: 'Almost out' },
  { key: 'out', label: 'Out of stock' },
];
const SORT_OPTIONS = [
  { key: 'default', label: 'Soonest expiry' },
  { key: 'qtyDesc', label: 'Most stock' },
  { key: 'qtyAsc', label: 'Least stock' },
  { key: 'nameAsc', label: 'Name A–Z' },
];
const EXPIRY_LABELS = { nearExpiry: 'Near expiry', expired: 'Expired' };
const LEVEL_LABELS = { healthy: 'In-stock only', low: 'Almost out only', out: 'Out of stock only' };
const SORT_LABELS = { qtyDesc: 'Most stock first', qtyAsc: 'Least stock first', nameAsc: 'Name A–Z' };

// A failed fetch keeps the previous snapshot instead of blanking the screen.
// getAgentBranches doesn't distinguish "genuinely no branches" from "the
// request failed" (both return []), so an empty result here falls back to
// whatever branch list was cached rather than wiping the selector.
const loadRequestableStockData = async (previous) => {
  const currentAgent = await authService.getCurrentUser();
  const prev = previous?.agent?.id === currentAgent?.id ? previous : null;

  const branchesResult = await requestService.getAgentBranches(currentAgent?.branchIds || []);
  const stockResult = await inventoryService.getBranchStockForAgent(currentAgent?.id);

  return {
    agent: currentAgent,
    branches: branchesResult.length > 0 ? branchesResult : prev?.branches ?? [],
    stock: stockResult.success ? stockResult.data : prev?.stock ?? [],
  };
};

const STOCK_PILL = {
  healthy: { bg: '#E1F4E8', color: '#1E7A3A' },
  low: { bg: '#FFF1D6', color: '#B26400' },
  out: { bg: '#FDECEC', color: '#B91C1C' },
};

export default function RequestStockSR() {
  const navigation = useNavigation();
  const blurTarget = useRef(null);
  const bottomActionBarHeight = useBottomActionBarHeight();
  const connection = useConnectionStatus();
  const onlineLabel = useOnlineLabel();
  const { data: snapshot, isLoading, refreshControlAt } = useCachedFocusLoader('sales-rep-request-stock', loadRequestableStockData);
  const agent = snapshot?.agent ?? null;
  const branches = snapshot?.branches ?? [];
  const stock = snapshot?.stock ?? [];

  const [searchText, setSearchText] = useState('');
  const [expiryFilter, setExpiryFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [cart, setCart] = useState([]);
  const [activeProduct, setActiveProduct] = useState(null);
  const [modalQty, setModalQty] = useState(1);
  const [qtyText, setQtyText] = useState('1');

  // Each branch has its own storage, so the screen shows one branch at a
  // time — default to the first once branches are available, same as before,
  // just driven off the cached snapshot instead of the raw load call.
  useEffect(() => {
    if (selectedBranchId || branches.length === 0) return;
    setSelectedBranchId(branches[0].id);
  }, [branches, selectedBranchId]);

  // The branch chips + search block slides away when you scroll down and comes back when you scroll
  // up. It floats over the list (the list keeps room for it at the top), so nothing resizes while
  // you scroll.
  const [headerHeight, setHeaderHeight] = useState(0);
  const headerProgress = useRef(new Animated.Value(0)).current; // 0 shown, 1 hidden
  const headerHidden = useRef(false);
  const lastScrollY = useRef(0);
  const setHeaderHidden = (hide) => {
    if (headerHidden.current === hide) return;
    headerHidden.current = hide;
    Animated.timing(headerProgress, { toValue: hide ? 1 : 0, duration: 50, useNativeDriver: true }).start();
  };
  const handleListScroll = (event) => {
    const y = event.nativeEvent.contentOffset.y;
    const delta = y - lastScrollY.current;
    lastScrollY.current = y;
    if (y <= 8) {
      setHeaderHidden(false);
    } else if (delta > 6 && y > headerHeight) {
      setHeaderHidden(true);
    } else if (delta < -6) {
      setHeaderHidden(false);
    }
  };
  const headerTranslateY = headerProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -headerHeight] });

  // Keeps the number and the text box in sync (stepper buttons and reset).
  const setQty = (n) => {
    setModalQty(n);
    setQtyText(String(n));
  };

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
    if (expiryFilter === 'expired') return isExpired(row.exp_date);
    if (expiryFilter !== 'nearExpiry') return true;
    const daysLeft = daysUntil(row.exp_date);
    return daysLeft !== null && daysLeft <= NEAR_EXPIRY_DAYS;
  };

  // "default" keeps the order the batches arrive in (soonest expiry first).
  const sortBatches = (rows) => {
    if (sortBy === 'qtyDesc') return [...rows].sort((a, b) => b.quantity - a.quantity);
    if (sortBy === 'qtyAsc') return [...rows].sort((a, b) => a.quantity - b.quantity);
    if (sortBy === 'nameAsc') return [...rows].sort((a, b) => a.product_name.localeCompare(b.product_name));
    return rows;
  };
  const hasActiveFilters = expiryFilter !== 'all' || levelFilter !== 'all' || sortBy !== 'default';
  const resetFilters = () => {
    setExpiryFilter('all');
    setLevelFilter('all');
    setSortBy('default');
  };
  const showHealthy = levelFilter === 'all' || levelFilter === 'healthy';
  const showLow = levelFilter === 'all' || levelFilter === 'low';
  const showOut = levelFilter === 'all' || levelFilter === 'out';

  const healthyBatches = sortBatches(branchStock.filter(
    (row) =>
      row.quantity >= STOCK_HEALTHY_THRESHOLD &&
      matchesQuery(row.product_name, row.product_code) &&
      matchesExpiryFilter(row)
  ));
  const lowStockBatches = sortBatches(branchStock.filter(
    (row) =>
      row.quantity > 0 &&
      row.quantity < STOCK_HEALTHY_THRESHOLD &&
      matchesQuery(row.product_name, row.product_code) &&
      matchesExpiryFilter(row)
  ));
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

  // Opened from a product's details ("Request This Product"): pick that
  // branch and open the quantity popup for that product straight away.
  const route = useRoute();
  const prefillProductCode = route.params?.prefillProductCode || null;
  const prefillBranchId = route.params?.branchId || null;
  useEffect(() => {
    if (prefillBranchId && branches.some((b) => b.id === prefillBranchId) && selectedBranchId !== prefillBranchId && cart.length === 0) {
      setSelectedBranchId(prefillBranchId);
    }
  }, [prefillBranchId, branches]);
  useEffect(() => {
    if (!prefillProductCode || !selectedBranchId || isLoading) return;
    if (prefillBranchId && selectedBranchId !== prefillBranchId) return;
    const row = branchStock.find((r) => r.product_code === prefillProductCode);
    if (row) openRequestModal(row.product_code, row.product_name);
    else Alert.alert('Not Available', 'This product has no stock at the branch right now.');
    navigation.setParams({ prefillProductCode: null });
  }, [prefillProductCode, selectedBranchId, stock, isLoading]);

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
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardScroll} contentContainerStyle={styles.cardRow}>
      {batches.map((row) =>
        renderRequestableCard(
          row.id,
          row.product_code,
          row.product_name,
          <StockBatchCard
            tone={row.quantity >= STOCK_HEALTHY_THRESHOLD ? 'healthy' : 'low'}
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
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardScroll} contentContainerStyle={styles.cardRow}>
      {outOfStockProducts.map((product) =>
        renderRequestableCard(
          product.code,
          product.code,
          product.name,
          <StockBatchCard productName={product.name} image={product.image} outOfStock tone="out" />
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
              <View style={[styles.onlineDot, !connection.online && styles.onlineDotOffline]} />
              <Text style={[styles.onlineText, !connection.online && styles.onlineTextOffline]}>
                {onlineLabel}
              </Text>
            </View>
          </View>
        </SecondaryHeader>

        <BlurTargetView ref={blurTarget} style={styles.contentTarget}>
        <View style={styles.listArea}>
        {isLoading ? (
          <ScrollView
          refreshControl={refreshControlAt(headerHeight)} contentContainerStyle={[styles.content, { paddingTop: headerHeight + SPACING.sm }]} onScroll={handleListScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false}>
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
          <ScrollView refreshControl={refreshControlAt(headerHeight)} contentContainerStyle={[styles.content, { paddingTop: headerHeight + SPACING.sm }]} onScroll={handleListScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false}>
            <HintChip id="request-pick" text={"Tap a product to add it to your request, then open the list at the bottom to review and send it."} style={{ marginBottom: SPACING.md }} />
            {showHealthy && (
            <>
            <StockSectionHeader
              dotColor={COLORS.success}
              label="In-Stock"
              count={healthyBatches.length}
              tooltip="These products have healthy stock levels — no action needed."
            />
            {healthyBatches.length > 0 ? (
              renderBatchRow(healthyBatches)
            ) : (
              <View style={styles.emptyBox}><Text style={styles.emptyText}>No batches at healthy levels right now.</Text></View>
            )}
            </>
            )}

            {showLow && (
            <>
            <StockSectionHeader
              dotColor={COLORS.warning}
              label="Almost Out"
              count={lowStockBatches.length}
              tooltip="These products are running low — plan to resupply soon."
              style={styles.sectionSpacing}
            />
            {lowStockBatches.length > 0 ? (
              renderBatchRow(lowStockBatches)
            ) : (
              <View style={styles.emptyBox}><Text style={styles.emptyText}>Nothing running low right now.</Text></View>
            )}
            </>
            )}

            {showOut && (
            <>
            <StockSectionHeader
              dotColor={COLORS.error}
              label="Out of Stock"
              count={outOfStockProducts.length}
              tooltip="These products have no stock left on the shelf."
              style={styles.sectionSpacing}
            />
            {outOfStockProducts.length > 0 ? (
              renderOutOfStockRow()
            ) : (
              <View style={styles.emptyBox}><Text style={styles.emptyText}>Every catalog product has stock on hand.</Text></View>
            )}
            </>
            )}

            <View style={{ height: cartCount > 0 ? bottomActionBarHeight + SPACING.sm : 24 }} />
          </ScrollView>
        )}

        <Animated.View
          style={[styles.stockHeaderStatic, { transform: [{ translateY: headerTranslateY }] }]}
          onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
        >
          <View style={styles.branchChipsWrap}>
            <BranchSelector
              branches={branches}
              selectedId={selectedBranchId}
              onSelect={handleSelectBranch}
              scrollable
              scrollBleed={SPACING.md}
            />
          </View>

          <View style={styles.searchRow}>
            <View style={styles.searchField}>
              <Icon name="search" size={18} color={COLORS.textSecondary} />
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Search products"
                placeholderTextColor={COLORS.textTertiary}
                style={styles.searchInput}
                returnKeyType="search"
                autoCorrect={false}
                accessibilityLabel="Search products"
              />
              {searchText.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchText('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <Icon name="xCircle" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={styles.filterButtonWrap}
              onPress={() => setIsFilterSheetVisible(true)}
              activeOpacity={0.8}
              accessibilityLabel="Filters"
              accessibilityRole="button"
            >
              <Icon name="filter" size={20} color="#FFFFFF" />
              {hasActiveFilters && <View style={styles.filterActiveDot} />}
            </TouchableOpacity>
          </View>

          {hasActiveFilters && (
            <View style={styles.activeFilterRow}>
              {expiryFilter !== 'all' && (
                <View style={styles.activeFilterChip}>
                  <Text style={styles.activeFilterChipText}>{EXPIRY_LABELS[expiryFilter]}</Text>
                  <TouchableOpacity onPress={() => setExpiryFilter('all')} accessibilityLabel="Clear expiry filter" accessibilityRole="button">
                    <Icon name="xCircle" size={16} color={COLORS.error} weight="fill" />
                  </TouchableOpacity>
                </View>
              )}
              {levelFilter !== 'all' && (
                <View style={styles.activeFilterChip}>
                  <Text style={styles.activeFilterChipText}>{LEVEL_LABELS[levelFilter]}</Text>
                  <TouchableOpacity onPress={() => setLevelFilter('all')} accessibilityLabel="Clear stock level filter" accessibilityRole="button">
                    <Icon name="xCircle" size={16} color={COLORS.error} weight="fill" />
                  </TouchableOpacity>
                </View>
              )}
              {sortBy !== 'default' && (
                <View style={styles.activeFilterChip}>
                  <Text style={styles.activeFilterChipText}>{SORT_LABELS[sortBy]}</Text>
                  <TouchableOpacity onPress={() => setSortBy('default')} accessibilityLabel="Clear sorting" accessibilityRole="button">
                    <Icon name="xCircle" size={16} color={COLORS.error} weight="fill" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </Animated.View>
        </View>
        </BlurTargetView>

        {cartCount > 0 && (
          <BottomActionBar variant="glass" blurTarget={blurTarget}>
            <Button
              title={`View Request List (${cartCount})`}
              variant="black"
              onPress={handleViewRequestList}
              height={48}
              fontSize={16}
              borderRadius={24}
            />
          </BottomActionBar>
        )}
      </View>

      <CustomModal visible={isFilterSheetVisible} onClose={() => setIsFilterSheetVisible(false)} height="auto">
        <View style={styles.sheetHeaderRow}>
          <Text style={styles.sheetTitle}>Filter & sort</Text>
          {hasActiveFilters && (
            <TouchableOpacity onPress={resetFilters} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.sheetReset}>Reset</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.sheetLabel}>EXPIRY</Text>
        <View style={styles.optionRow}>
          {EXPIRY_OPTIONS.map((option) => {
            const isActive = option.key === expiryFilter;
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.optionChip, isActive && styles.optionChipActive]}
                onPress={() => setExpiryFilter(option.key)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <Text style={[styles.optionChipText, isActive && styles.optionChipTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sheetLabel}>STOCK LEVEL</Text>
        <View style={styles.optionRow}>
          {LEVEL_OPTIONS.map((option) => {
            const isActive = option.key === levelFilter;
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.optionChip, isActive && styles.optionChipActive]}
                onPress={() => setLevelFilter(option.key)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <Text style={[styles.optionChipText, isActive && styles.optionChipTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sheetLabel}>SORT BY</Text>
        <View style={styles.optionRow}>
          {SORT_OPTIONS.map((option) => {
            const isActive = option.key === sortBy;
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.optionChip, isActive && styles.optionChipActive]}
                onPress={() => setSortBy(option.key)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <Text style={[styles.optionChipText, isActive && styles.optionChipTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Button
          title="Done"
          variant="black"
          onPress={() => setIsFilterSheetVisible(false)}
          height={48}
          fontSize={16}
          borderRadius={24}
          style={styles.sheetDone}
        />
      </CustomModal>

      <CustomModal visible={!!activeProduct} onClose={closeRequestModal} height="auto">
        {activeProduct && (
          <View>
            <View style={styles.sheetHandle} />
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalTextCol}>
                <Text style={styles.modalTitle} numberOfLines={2}>{activeProduct.name}</Text>
                <Text style={styles.modalSubtitle}>Code: {activeProduct.code}</Text>
                {(() => {
                  // The pill follows the stock level: red none, amber low, green healthy.
                  const atBranch = qtyByCode[activeProduct.code] || 0;
                  const tone = atBranch === 0 ? STOCK_PILL.out : atBranch < STOCK_HEALTHY_THRESHOLD ? STOCK_PILL.low : STOCK_PILL.healthy;
                  return (
                    <View style={[styles.modalOnHandPill, { backgroundColor: tone.bg }]}>
                      <Icon name="package" size={14} color={tone.color} weight="fill" />
                      <Text style={[styles.modalOnHandText, { color: tone.color }]}>{atBranch} pcs at branch</Text>
                    </View>
                  );
                })()}
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
                style={[styles.stepperBtnMinus, availableFor(activeProduct.code) === 0 && styles.stepperDisabled]}
                disabled={availableFor(activeProduct.code) === 0}
                onPress={() => setQty(Math.max(1, modalQty - 1))}
                accessibilityLabel="Decrease quantity"
                accessibilityRole="button"
              >
                <Icon name="minus" size={16} color={COLORS.primary} weight="bold" />
              </TouchableOpacity>
              <TextInput
                style={[styles.qtyInputModal, availableFor(activeProduct.code) === 0 && styles.qtyInputDisabled]}
                editable={availableFor(activeProduct.code) > 0}
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
                style={[styles.stepperBtnPlus, availableFor(activeProduct.code) === 0 && styles.stepperDisabled]}
                disabled={availableFor(activeProduct.code) === 0}
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
              <Pressable
                style={[styles.saveBtn, availableFor(activeProduct.code) === 0 && styles.saveBtnDisabled]}
                onPress={handleSaveRequest}
                disabled={availableFor(activeProduct.code) === 0}
                accessibilityRole="button"
                accessibilityState={{ disabled: availableFor(activeProduct.code) === 0 }}
              >
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
  onlineDotOffline: { backgroundColor: COLORS.warning },
  onlineText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.success,
  },
  onlineTextOffline: { color: COLORS.warning },
  contentTarget: { flex: 1 },
  listArea: { flex: 1, overflow: 'hidden' },
  // Floats at the top of the list with a solid background, so cards pass cleanly under it.
  stockHeaderStatic: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: SPACING.xs,
    backgroundColor: COLORS.background,
    zIndex: 2,
    elevation: 2,
  },
  branchChipsWrap: { paddingHorizontal: SPACING.md },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  searchField: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#D5DAE3',
    backgroundColor: '#FFFFFF',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 0,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textPrimary,
  },
  filterButtonWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterActiveDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
  },
  activeFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  activeFilterChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.error + '55',
    backgroundColor: '#FDECEC',
  },
  activeFilterChipText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.error,
  },
  sheetHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.xs },
  sheetTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  sheetReset: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.error,
  },
  sheetLabel: {
    marginTop: SPACING.md,
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textTertiary,
    letterSpacing: 0.8,
  },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm },
  optionChip: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: '#D5DAE3',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionChipActive: { borderColor: '#0085F9', backgroundColor: '#EAF4FF' },
  optionChipText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
  },
  optionChipTextActive: {
    color: '#0085F9',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  sheetDone: { marginTop: SPACING.lg },
  skeletonSectionTitle: { marginBottom: SPACING.sm },
  skeletonCardRow: { flexDirection: 'row', gap: SPACING.sm },
  content: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: 96 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs },
  sectionBar: { width: 4, height: 18, borderRadius: 2 },
  sectionSpacing: { marginTop: SPACING.md },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  cardScroll: { marginHorizontal: -SPACING.lg, marginTop: SPACING.xs },
  cardRow: { gap: SPACING.sm, paddingHorizontal: SPACING.lg },
  emptyBox: { marginTop: SPACING.xs, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderRadius: 2, borderWidth: 1, borderColor: '#E5E5E5', backgroundColor: '#FFFFFF' },
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
    fontSize: 11,
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },

  // Request popup
  sheetHandle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#DADDE3', marginTop: -8, marginBottom: 14 },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  modalTextCol: { flex: 1 },
  modalOnHandPillOut: { backgroundColor: '#FDECEC' },
  modalOnHandTextOut: { color: COLORS.error },
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
    backgroundColor: '#E1F4E8',
  },
  modalOnHandText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#1E7A3A',
  },
  modalImageWrap: {
    width: 84,
    height: 84,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#F7F8FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImage: { width: 64, height: 64 },
  modalLabel: {
    marginTop: SPACING.lg,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    color: '#272632',
  },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginTop: SPACING.sm },
  stepperBtnMinus: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  stepperDisabled: { opacity: 0.35 },
  qtyInputDisabled: { backgroundColor: '#F1F3F6', borderColor: '#E3E6EC', color: '#9AA3B2' },
  saveBtnDisabled: { backgroundColor: '#C5CAD3' },
  stepperBtnPlus: {
    width: 46,
    height: 46,
    borderRadius: 23,
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
    minWidth: 100,
    height: 50,
    borderWidth: 1.5,
    borderColor: '#B9D9FF',
    borderRadius: 14,
    textAlign: 'center',
    fontSize: 22,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
    backgroundColor: '#FFFFFF',
  },
  modalButtonRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#D5DAE3',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  cancelText: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: '#555353',
  },
  saveBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  saveText: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: '#FFFFFF',
  },
});
