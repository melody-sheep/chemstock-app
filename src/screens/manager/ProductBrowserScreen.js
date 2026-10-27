// src/screens/manager/ProductBrowserScreen.js
import React, { useCallback, useState } from 'react';
import { View, Text, Image, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import LiveStatusPill from '../../components/common/LiveStatusPill';
import SectionHeader from '../../components/common/SectionHeader';
import Icon from '../../components/common/Icon';
import FilterSheet from '../../components/common/FilterSheet';
import authService from '../../services/authService';
import inventoryService from '../../services/inventoryService';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import { NEAR_EXPIRY_DAYS } from '../../constants/inventory';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { daysUntil } from '../../utils/formatters';
import { isExpired } from '../../utils/expiry';
import { getFrequentProductCodes } from '../../utils/productUsage';

const SORT_OPTIONS = [
  { key: 'nameAsc', label: 'Name (A–Z)' },
  { key: 'nameDesc', label: 'Name (Z–A)' },
  { key: 'codeAsc', label: 'Code (A–Z)' },
  { key: 'codeDesc', label: 'Code (Z–A)' },
];

function sortProducts(list, sortOrder) {
  const sorted = [...list];
  switch (sortOrder) {
    case 'nameDesc':
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
    case 'codeAsc':
      return sorted.sort((a, b) => a.code.localeCompare(b.code));
    case 'codeDesc':
      return sorted.sort((a, b) => b.code.localeCompare(a.code));
    case 'nameAsc':
    default:
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
  }
}

// What the soonest-expiring batch on the shelf looks like: a label and colours.
function expiryStatus(expDate) {
  const daysLeft = daysUntil(expDate);
  if (daysLeft === null) return { label: 'No expiry set', color: '#757575', bg: '#F1F5F9', urgent: false };
  if (isExpired(expDate)) return { label: 'Expired batch', color: COLORS.error, bg: '#FDECEC', urgent: true };
  if (daysLeft <= NEAR_EXPIRY_DAYS) return { label: 'Near expiry', color: '#B45309', bg: '#FFF3D6', urgent: true };
  return { label: 'Safe batch', color: COLORS.success, bg: COLORS.success + '18', urgent: false };
}

/**
 * ProductBrowserScreen - full-screen "pick a product" browser for Add New
 * Batches. Shows the entire catalog in one flat, sortable list rather than
 * grouped by stock level — a manager browsing to add a batch is looking for
 * a specific product, not triaging stock health (that's what Manager Stocks
 * is for). A "Frequently added" row surfaces the manager's own most-used
 * products as a quick pick above the full list.
 */
export default function ProductBrowserScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const alreadySelectedCodes = route.params?.selectedCodes || [];

  const [stock, setStock] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [sortOrder, setSortOrder] = useState('nameAsc');
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);
  const [frequentCodes, setFrequentCodes] = useState([]);

  const loadStock = useCallback(async () => {
    setIsLoading(true);
    const currentManager = await authService.getCurrentUser();
    const branchIds = currentManager?.branchIds || [];
    const result = await inventoryService.getBranchStock(branchIds);
    setStock(result.success ? result.data : []);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStock();
      getFrequentProductCodes().then(setFrequentCodes);
    }, [loadStock])
  );

  const handleSelect = (product) => {
    navigation.navigate('AddNewBatches', { selectedProduct: product }, { pop: true });
  };

  const handleFilterPress = () => {
    setIsFilterSheetVisible(true);
  };

  // getBranchStock already returns rows soonest-expiring-first, so the
  // first row seen per product code here is the batch worth surfacing.
  const stockByProduct = {};
  stock.filter((row) => row.quantity > 0).forEach((row) => {
    if (!stockByProduct[row.product_code]) {
      stockByProduct[row.product_code] = { totalQty: 0, earliestRow: row };
    }
    stockByProduct[row.product_code].totalQty += row.quantity;
  });

  const query = searchText.trim().toLowerCase();
  const matchesQuery = (product) =>
    !query || product.name.toLowerCase().includes(query) || product.code.toLowerCase().includes(query);

  const pickableProducts = sortProducts(
    PRODUCT_CATALOG.filter((p) => !alreadySelectedCodes.includes(p.code) && matchesQuery(p)),
    sortOrder
  );

  const frequentProducts = frequentCodes
    .map((code) => PRODUCT_CATALOG.find((p) => p.code === code))
    .filter((p) => p && !alreadySelectedCodes.includes(p.code) && matchesQuery(p));

  // Small quick-pick tile for "Frequently added".
  const renderTile = (product) => {
    const agg = stockByProduct[product.code];
    return (
      <TouchableOpacity
        key={product.code}
        style={styles.tile}
        onPress={() => handleSelect(product)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={product.name}
      >
        <View style={styles.tileThumb}>
          {product.image ? (
            <Image source={product.image} style={styles.tileImage} resizeMode="contain" />
          ) : (
            <Icon name="boxPackage" size={28} />
          )}
        </View>
        <Text style={styles.tileName} numberOfLines={1}>{product.name}</Text>
        <Text style={[styles.tileQty, agg && styles.tileQtyHas]}>{agg ? `${agg.totalQty} pcs` : 'No stock'}</Text>
      </TouchableOpacity>
    );
  };

  // One full row per product: nothing is cut off, and a product with no stock stays slim.
  const renderRow = (product) => {
    const agg = stockByProduct[product.code];
    const status = agg ? expiryStatus(agg.earliestRow.exp_date) : null;
    return (
      <TouchableOpacity
        key={product.code}
        style={styles.row}
        onPress={() => handleSelect(product)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={product.name}
      >
        <View style={styles.rowThumb}>
          {product.image ? (
            <Image source={product.image} style={styles.rowImage} resizeMode="contain" />
          ) : (
            <Icon name="boxPackage" size={30} />
          )}
        </View>
        <View style={styles.rowInfo}>
          <View style={styles.rowTitleLine}>
            <Text style={styles.rowName}>{product.name}</Text>
            {/* Only a warning gets a pill; a healthy batch needs no label. */}
            {status?.urgent && (
              <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
                <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
              </View>
            )}
          </View>
          {agg ? (
            <Text style={[styles.metaText, status.urgent && styles.metaTextUrgent]}>
              <Text style={styles.stockStrong}>{agg.totalQty} pcs</Text> in stock ·{' '}
              {agg.earliestRow.exp_date
                ? `Exp ${new Date(agg.earliestRow.exp_date).toLocaleDateString()}`
                : 'No expiry set'}
            </Text>
          ) : (
            <Text style={styles.noStockText}>No stock yet</Text>
          )}
        </View>
        <Icon name="arrowRight" size={16} color="#94a3b8" />
      </TouchableOpacity>
    );
  };

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton
          backButtonText="Add New Batches"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
        />

        <SecondaryHeader height={76}>
          <View style={styles.titleRow}>
            <View style={styles.titleTextCol}>
              <Text style={styles.pageTitle} numberOfLines={1}>Select a Product</Text>
              <Text style={styles.pageSubtitle}>Pick the product you are adding</Text>
            </View>
            <LiveStatusPill pillStyle={styles.onlinePill} dotStyle={styles.onlineDot} textStyle={styles.onlineText} />
          </View>
        </SecondaryHeader>

        <View style={styles.searchWrap}>
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
            style={styles.sortButton}
            onPress={handleFilterPress}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Sort products"
          >
            <Icon name="filter" size={20} color="#FFFFFF" />
            {sortOrder !== 'nameAsc' && <View style={styles.sortDot} />}
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {frequentProducts.length > 0 && (
              <>
                <SectionHeader icon="clock" size="md" label="Frequently added" style={styles.labelFirst} />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.tileScroll}
                  contentContainerStyle={styles.tileRow}
                >
                  {frequentProducts.map(renderTile)}
                </ScrollView>
              </>
            )}

            <SectionHeader
              icon="grid"
              size="md"
              label={`${query ? 'Results' : 'All products'} (${pickableProducts.length})`}
              style={frequentProducts.length > 0 ? styles.labelSpaced : styles.labelFirst}
            />
            {pickableProducts.length > 0 ? (
              <View style={styles.list}>{pickableProducts.map(renderRow)}</View>
            ) : (
              <Text style={styles.emptyText}>No products match your search.</Text>
            )}

            <View style={{ height: 24 }} />
          </ScrollView>
        )}
      </View>

      <FilterSheet
        visible={isFilterSheetVisible}
        onClose={() => setIsFilterSheetVisible(false)}
        title="Sort Products"
        options={SORT_OPTIONS}
        selectedKey={sortOrder}
        onSelect={setSortOrder}
      />
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
  titleTextCol: { flexShrink: 1, flex: 1 },
  pageTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  pageSubtitle: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' },
  onlineText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.success,
  },
  // Solid background + a thin line, so cards scrolling up under it are cleanly cut.
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    backgroundColor: COLORS.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
  },
  searchField: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#D5DAE3',
    backgroundColor: '#FFFFFF',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 0,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textPrimary,
  },
  sortButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#F59E0B',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 48,
  },
  labelFirst: { marginTop: SPACING.md, marginBottom: 0 },
  labelSpaced: { marginTop: SPACING.lg, marginBottom: 0 },
  tileScroll: { marginHorizontal: -SPACING.lg, marginTop: SPACING.sm },
  tileRow: { paddingHorizontal: SPACING.lg, gap: SPACING.sm },
  tile: {
    width: 92,
    alignItems: 'center',
    gap: 2,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
  },
  tileThumb: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  tileImage: { width: '100%', height: '100%' },
  tileName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  tileQty: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  tileQtyHas: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.success,
  },
  list: { gap: SPACING.sm, marginTop: SPACING.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
  },
  rowThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  rowImage: { width: '100%', height: '100%' },
  rowInfo: { flex: 1, gap: 3 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  rowName: {
    flexShrink: 1,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  noStockText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  stockStrong: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.success,
  },
  statusPill: { borderRadius: 20, paddingHorizontal: SPACING.sm, paddingVertical: 2 },
  statusText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  metaText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  metaTextUrgent: {
    color: COLORS.error,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  emptyText: {
    marginTop: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
});
