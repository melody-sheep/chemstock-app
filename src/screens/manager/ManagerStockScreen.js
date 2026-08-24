// src/screens/manager/ManagerStockScreen.js
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import Input from '../../components/common/Input';
import Icon from '../../components/common/Icon';
import StockBatchCard from '../../components/common/StockBatchCard';
import BottomNavBar from '../../components/common/BottomNavBar';
import QRScannerModal from '../../components/common/QRScannerModal';
import FilterSheet from '../../components/common/FilterSheet';
import SkeletonBlock from '../../components/ui/SkeletonBlock';
import authService from '../../services/authService';
import inventoryService from '../../services/inventoryService';
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

export default function ManagerStockScreen() {
  const navigation = useNavigation();
  const [manager, setManager] = useState(null);
  const [stock, setStock] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [expiryFilter, setExpiryFilter] = useState('all');
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);

  const loadStock = useCallback(async () => {
    setIsLoading(true);
    const currentManager = await authService.getCurrentUser();
    setManager(currentManager);

    const branchIds = currentManager?.branchIds || [];
    const result = await inventoryService.getBranchStock(branchIds);
    setStock(result.success ? result.data : []);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStock();
    }, [loadStock])
  );

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
    } else {
      Alert.alert('Coming Soon', `${key.charAt(0).toUpperCase()}${key.slice(1)} isn't built yet.`);
    }
  };

  const handleScanned = (data) => {
    setIsScannerVisible(false);
    Alert.alert('QR Scanned', `Code: ${data}\n\nMatching this against your received batches is coming soon.`);
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
  const healthyBatches = stock.filter(
    (row) =>
      row.quantity >= STOCK_HEALTHY_THRESHOLD &&
      matchesQuery(row.product_name, row.product_code) &&
      matchesExpiryFilter(row)
  );
  const lowStockBatches = stock.filter(
    (row) =>
      row.quantity > 0 &&
      row.quantity < STOCK_HEALTHY_THRESHOLD &&
      matchesQuery(row.product_name, row.product_code) &&
      matchesExpiryFilter(row)
  );
  const stockedCodes = new Set(stock.filter((row) => row.quantity > 0).map((row) => row.product_code));
  const outOfStockProducts = PRODUCT_CATALOG.filter(
    (product) => !stockedCodes.has(product.code) && matchesQuery(product.name, product.code)
  );

  const renderBatchRow = (batches) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
      {batches.map((row) => (
        <StockBatchCard
          key={row.id}
          productName={row.product_name}
          quantity={row.quantity}
          batchNumber={row.batch_number}
          expDate={row.exp_date}
        />
      ))}
    </ScrollView>
  );

  const renderOutOfStockRow = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
      {outOfStockProducts.map((product) => (
        <StockBatchCard key={product.code} productName={product.name} outOfStock />
      ))}
    </ScrollView>
  );

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton
          backButtonText="Manager Dashboard"
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
                {manager?.branchName || 'No branch assigned'}
              </Text>
              <Text style={styles.branchSubtitle}>Branch Inventory</Text>
            </View>
            <View style={styles.onlinePill}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Online</Text>
            </View>
          </View>
        </SecondaryHeader>

        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Input icon="search" placeholder="Search products" value={searchText} onChangeText={setSearchText} />
          </View>
          <TouchableOpacity
            style={styles.filterButtonWrap}
            onPress={handleFilterPress}
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  searchInputWrap: { flex: 1 },
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
    paddingTop: SPACING.md,
    paddingBottom: 96,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  sectionSpacing: { marginTop: SPACING.lg },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
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
