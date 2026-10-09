// src/screens/manager/ManagerStockScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import useCachedFocusLoader from '../../hooks/useCachedFocusLoader';
import useConnectionStatus from '../../hooks/useConnectionStatus';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import Input from '../../components/common/Input';
import Icon from '../../components/common/Icon';
import StockBatchCard from '../../components/common/StockBatchCard';
import StockSectionHeader from '../../components/common/StockSectionHeader';
import BottomNavBar from '../../components/common/BottomNavBar';
import QRScannerModal from '../../components/common/QRScannerModal';
import FilterSheet from '../../components/common/FilterSheet';
import BranchSelector from '../../components/common/BranchSelector';
import SkeletonBlock from '../../components/ui/SkeletonBlock';
import authService from '../../services/authService';
import { describeReceivingScan } from '../../utils/scanLookup';
import inventoryService from '../../services/inventoryService';
import requestService from '../../services/requestService';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import { STOCK_HEALTHY_THRESHOLD, NEAR_EXPIRY_DAYS } from '../../constants/inventory';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { daysUntil, formatClockTime } from '../../utils/formatters';

const BRANCH_HEADER_HEIGHT = 76;

const EXPIRY_FILTER_OPTIONS = [
  { key: 'all', label: 'All Batches', description: 'Show every batch, regardless of expiry', icon: 'grid' },
  { key: 'nearExpiry', label: 'Near Expiry Only', description: 'Only batches expiring soon', icon: 'warningTriangle' },
];

// Returns the full stock snapshot. A request that fails keeps its value from
// the previous snapshot instead of blanking the screen — same pattern the
// dashboards already use.
const loadStockData = async (previous) => {
  const currentManager = await authService.getCurrentUser();
  const prev = previous?.manager?.id === currentManager?.id ? previous : null;

  // Each branch has its own storage, so the screen shows one branch at a time.
  const branchIds = currentManager?.branchIds || [];
  const agentBranches = await requestService.getAgentBranches(branchIds);
  const result = await inventoryService.getBranchStock(branchIds);

  // getAgentBranches collapses "no branches assigned" and "fetch failed"
  // into the same empty array — unlike `stock` below, falling back here
  // only on empty rather than checking a .success flag. An offline retry
  // coming back empty almost always means the fetch failed (losing this
  // wipes selectedBranchId downstream and blanks every stock section even
  // though `stock` itself is fine); a real zero-branch reassignment just
  // self-corrects on the next successful sync.
  const branches = agentBranches.length > 0 ? agentBranches : prev?.branches ?? [];

  return {
    manager: currentManager,
    branches,
    stock: result.success ? result.data : prev?.stock ?? [],
  };
};

export default function ManagerStockScreen() {
  const navigation = useNavigation();
  const connection = useConnectionStatus();
  const { data: snapshot, isLoading } = useCachedFocusLoader('manager-stock', loadStockData);
  const manager = snapshot?.manager ?? null;
  const branches = snapshot?.branches ?? [];
  const stock = snapshot?.stock ?? [];
  const [searchText, setSearchText] = useState('');
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [expiryFilter, setExpiryFilter] = useState('all');
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState(null);

  // Defaults to the first branch exactly once, when branches first arrive —
  // a manual pick is never overwritten by a background refresh. Kept out of
  // the cached snapshot itself since it's interaction state, not server data.
  useEffect(() => {
    if (!selectedBranchId && branches.length > 0) {
      setSelectedBranchId(branches[0].id);
    }
  }, [branches, selectedBranchId]);

  const handleDocumentPress = () => {
    navigation.navigate('StockLogs');
  };

  const handleFilterPress = () => {
    setIsFilterSheetVisible(true);
  };

  const handleTabPress = (key) => {
    if (key === 'dashboard') {
      navigation.navigate('ManagerDashboard', undefined, { pop: true });
    } else if (key === 'stock') {
      // already here
    } else if (key === 'reports') {
      navigation.navigate('ManagerReports');
    } else if (key === 'settings') {
      navigation.navigate('ManagerSettings');
    } else {
      navigation.navigate('ComingSoon', { tabKey: key, role: 'manager' });
    }
  };

  const handleScanned = async (qrCode) => {
    setIsScannerVisible(false);
    const manager = await authService.getCurrentUser();
    const summary = await describeReceivingScan(qrCode, manager?.branchIds || []);
    Alert.alert(summary.title, summary.message);
  };

  const query = searchText.trim().toLowerCase();
  const matchesQuery = (name, code) =>
    !query || name.toLowerCase().includes(query) || code.toLowerCase().includes(query);

  const matchesExpiryFilter = (row) => {
    if (expiryFilter !== 'nearExpiry') return true;
    const daysLeft = daysUntil(row.exp_date);
    return daysLeft !== null && daysLeft <= NEAR_EXPIRY_DAYS;
  };

  // A batch fully released down to 0 now persists (never deleted — see
  // 2026-08-21 migration, needed to keep receiving/release logs from losing
  // their own history). A 0-qty row has nothing left to show as a batch
  // card in either "healthy" or "almost out" — it belongs in Out of Stock.
  const selectedBranch = branches.find((b) => b.id === selectedBranchId);
  const branchStock = stock.filter((row) => row.branch_id === selectedBranchId);

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

  const renderBatchRow = (batches) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
      {batches.map((row) => (
        <StockBatchCard
          key={row.id}
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
            })
          }
        />
      ))}
    </ScrollView>
  );

  const renderOutOfStockRow = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
      {outOfStockProducts.map((product) => (
        <StockBatchCard key={product.code} productName={product.name} image={product.image} outOfStock />
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
          onDocumentPress={handleDocumentPress}
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
                {connection.online ? 'Online' : `Offline · ${formatClockTime(connection.lastOnlineAt)}`}
              </Text>
            </View>
          </View>
        </SecondaryHeader>

        <View style={styles.stockHeaderStatic}>
          <BranchSelector
            branches={branches}
            selectedId={selectedBranchId}
            onSelect={setSelectedBranchId}
            edgePadding={SPACING.md}
          />

          <View style={styles.searchRow}>
            <View style={styles.searchInputWrap}>
              <Input
                icon="search"
                placeholder="Search products"
                value={searchText}
                onChangeText={setSearchText}
                height={40}
              />
            </View>
            <TouchableOpacity
              style={styles.filterButtonWrap}
              onPress={handleFilterPress}
              activeOpacity={0.7}
              accessibilityLabel="Filters"
              accessibilityRole="button"
            >
              <Icon name="filter" size={18} color={COLORS.primary} />
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
        </View>

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
            <StockSectionHeader
              dotColor={COLORS.success}
              label="In-Stock"
              tooltip="These products have healthy stock levels — no action needed."
            />
            {healthyBatches.length > 0 ? (
              renderBatchRow(healthyBatches)
            ) : (
              <Text style={styles.emptyText}>No batches at healthy levels right now.</Text>
            )}

            <StockSectionHeader
              dotColor={COLORS.warning}
              label="Almost Out"
              tooltip="These products are running low — plan to resupply soon."
              style={styles.sectionSpacing}
            />
            {lowStockBatches.length > 0 ? (
              renderBatchRow(lowStockBatches)
            ) : (
              <Text style={styles.emptyText}>Nothing running low right now.</Text>
            )}

            <StockSectionHeader
              dotColor={COLORS.error}
              label="Out of Stock"
              tooltip="These products have no stock left on the shelf."
              style={styles.sectionSpacing}
            />
            {outOfStockProducts.length > 0 ? (
              renderOutOfStockRow()
            ) : (
              <Text style={styles.emptyText}>Every catalog product has stock on hand.</Text>
            )}

            <View style={{ height: 24 }} />
          </ScrollView>
        )}

        <BottomNavBar activeTab="stock" onTabPress={handleTabPress} onFabPress={() => setIsScannerVisible(true)} />
      </View>

      <QRScannerModal
        visible={isScannerVisible}
        onClose={() => setIsScannerVisible(false)}
        onScanned={handleScanned}
      />

      <FilterSheet
        visible={isFilterSheetVisible}
        onClose={() => setIsFilterSheetVisible(false)}
        title="Filter Stock"
        options={EXPIRY_FILTER_OPTIONS}
        selectedKey={expiryFilter}
        onSelect={setExpiryFilter}
      />
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
  // Static now (the scroll-hide version was pulled after three attempts
  // never worked right) — the bottom border is what visually separates it
  // from the stock cards below instead.
  stockHeaderStatic: {
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#EAEFF5',
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
    width: 40,
    height: 40,
    borderRadius: 10,
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
  activeFilterRow: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
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
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: 96,
  },
  sectionSpacing: { marginTop: SPACING.md },
  cardRow: {
    gap: SPACING.sm,
    paddingRight: SPACING.sm,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
});
