// src/screens/salesrep/SalesRepStockScreen.js
// Same layout as ManagerStockScreen (header, branch banner, search + filter,
// three status sections with StockBatchCard rows). Reads branch inventory so a
// Sales Rep sees the same stock as the Manager on the same branch.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Animated, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import useCachedFocusLoader from '../../hooks/useCachedFocusLoader';
import useConnectionStatus from '../../hooks/useConnectionStatus';
import useOnlineLabel from '../../hooks/useOnlineLabel';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import StockBatchCard from '../../components/common/StockBatchCard';
import StockSectionHeader from '../../components/common/StockSectionHeader';
import BottomNavBar from '../../components/common/BottomNavBar';
import QRScannerModal from '../../components/common/QRScannerModal';
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

// Returns the full stock snapshot. A request that fails keeps its value from
// the previous snapshot instead of blanking the screen — same pattern the
// dashboards already use.
export const loadStockData = async (previous) => {
  const currentAgent = await authService.getCurrentUser();
  const prev = previous?.agent?.id === currentAgent?.id ? previous : null;

  // Each branch has its own storage, so the screen shows one branch at a time.
  const agentBranches = await requestService.getAgentBranches(currentAgent?.branchIds || []);
  const result = await inventoryService.getBranchStockForAgent(currentAgent?.id);

  // getAgentBranches collapses "no branches assigned" and "fetch failed"
  // into the same empty array — unlike `stock` below, falling back here
  // only on empty rather than checking a .success flag. An offline retry
  // coming back empty almost always means the fetch failed (losing this
  // wipes selectedBranchId downstream and blanks every stock section even
  // though `stock` itself is fine); a real zero-branch reassignment just
  // self-corrects on the next successful sync.
  const branches = agentBranches.length > 0 ? agentBranches : prev?.branches ?? [];

  return {
    agent: currentAgent,
    branches,
    stock: result.success ? result.data : prev?.stock ?? [],
  };
};

export default function SalesRepStockScreen() {
  const navigation = useNavigation();
  const connection = useConnectionStatus();
  const onlineLabel = useOnlineLabel();
  const { data: snapshot, isLoading, refreshControl } = useCachedFocusLoader('sales-rep-stock', loadStockData);
  const agent = snapshot?.agent ?? null;
  const branches = snapshot?.branches ?? [];
  const stock = snapshot?.stock ?? [];
  const [searchText, setSearchText] = useState('');
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [expiryFilter, setExpiryFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);

  // The search block slides away when you scroll down and comes back when you scroll up. It floats
  // over the list (the list keeps room for it at the top), so nothing resizes while you scroll.
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
  const [selectedBranchId, setSelectedBranchId] = useState(null);

  // Defaults to the first branch exactly once, when branches first arrive —
  // a manual pick is never overwritten by a background refresh. Kept out of
  // the cached snapshot itself since it's interaction state, not server data.
  useEffect(() => {
    if (!selectedBranchId && branches.length > 0) {
      setSelectedBranchId(branches[0].id);
    }
  }, [branches, selectedBranchId]);

  const handleTabPress = (key) => {
    if (key === 'dashboard') {
      navigation.navigate('SalesRepDashboard');
    } else if (key === 'stock') {
      // already here
    } else if (key === 'reports') {
      navigation.navigate('SalesRepReports');
    } else if (key === 'settings') {
      navigation.navigate('SalesRepSettings');
    } else {
      navigation.navigate('ComingSoon', { tabKey: key, role: 'salesrep' });
    }
  };

  const handleScanned = (qrCode) => {
    setIsScannerVisible(false);
    navigation.navigate('ReceiveStockSR', { initialQrCode: qrCode });
  };

  const query = searchText.trim().toLowerCase();
  const matchesQuery = (name, code) =>
    !query || name.toLowerCase().includes(query) || code.toLowerCase().includes(query);

  const matchesExpiryFilter = (row) => {
    if (expiryFilter === 'expired') return isExpired(row.exp_date);
    if (expiryFilter !== 'nearExpiry') return true;
    const daysLeft = daysUntil(row.exp_date);
    return daysLeft !== null && daysLeft <= NEAR_EXPIRY_DAYS;
  };

  // A batch fully released down to 0 persists in branch_inventory (never
  // deleted, to keep the logs intact), so 0-qty rows belong in Out of Stock.
  const selectedBranch = branches.find((b) => b.id === selectedBranchId);
  const branchStock = stock.filter((row) => row.branch_id === selectedBranchId);

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

  const renderBatchRow = (batches) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardScroll} contentContainerStyle={styles.cardRow}>
      {batches.map((row) => (
        <StockBatchCard
          key={row.id}
          tone={row.quantity >= STOCK_HEALTHY_THRESHOLD ? 'healthy' : 'low'}
          productName={row.product_name}
          image={PRODUCT_CATALOG.find((p) => p.code === row.product_code)?.image}
          quantity={row.quantity}
          batchNumber={row.batch_number}
          expDate={row.exp_date}
          onPress={() =>
            navigation.navigate('StockBatchDetail', {
              productName: row.product_name,
              quantity: row.quantity,
              batchNumber: row.batch_number,
              expDate: row.exp_date,
              mfgDate: row.mfg_date,
              branchName: selectedBranch?.name,
              hideQr: true,
              productCode: row.product_code,
              branchId: selectedBranch?.id,
            })
          }
        />
      ))}
    </ScrollView>
  );

  const renderOutOfStockRow = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardScroll} contentContainerStyle={styles.cardRow}>
      {outOfStockProducts.map((product) => (
        <StockBatchCard key={product.code} productName={product.name} image={product.image} outOfStock tone="out" />
      ))}
    </ScrollView>
  );

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          title="Stock Inventory"
          titleAlign="left"
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

        <View style={styles.listArea}>
        {isLoading ? (
          <ScrollView
          refreshControl={refreshControl} contentContainerStyle={[styles.content, { paddingTop: headerHeight + SPACING.sm }]} onScroll={handleListScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false}>
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
          <ScrollView refreshControl={refreshControl} contentContainerStyle={[styles.content, { paddingTop: headerHeight + SPACING.sm }]} onScroll={handleListScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false}>
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

            <View style={{ height: 24 }} />
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
              onSelect={setSelectedBranchId}
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

        <BottomNavBar activeTab="stock" onTabPress={handleTabPress} onFabPress={() => setIsScannerVisible(true)} fabLabel="Scan" />
      </View>

      <QRScannerModal
        visible={isScannerVisible}
        onClose={() => setIsScannerVisible(false)}
        onScanned={handleScanned}
      />

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
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  onlineText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.success,
  },
  onlineDotOffline: { backgroundColor: COLORS.warning },
  onlineTextOffline: { color: COLORS.warning },
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
  cardScroll: { marginHorizontal: -SPACING.lg, marginTop: SPACING.sm },
  emptyBox: {
    marginTop: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
  },
  skeletonSectionTitle: { marginBottom: SPACING.sm },
  skeletonCardRow: { flexDirection: 'row', gap: SPACING.sm },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: 96,
  },
  sectionSpacing: { marginTop: SPACING.md },
  cardRow: {
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
});
