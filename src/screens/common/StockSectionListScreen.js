// src/screens/common/StockSectionListScreen.js
// Opened from a stock section's "View all" link on the Manager and Sales Rep
// stock screens. Shows that section's cards as a vertical grid instead of the
// horizontal row, one card per product like the section itself. It lists
// what the section showed (a snapshot taken when the link was tapped), and can
// be searched, filtered by expiry and re-sorted here. The sort starts from the
// one picked on the stock screen.
import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, useWindowDimensions, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import Header from '../../components/common/Header';
import Icon from '../../components/common/Icon';
import Button from '../../components/common/Button';
import CustomModal from '../../components/common/Modal';
import StockBatchCard from '../../components/common/StockBatchCard';
import StockBatchListSheet from '../../components/common/StockBatchListSheet';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import { NEAR_EXPIRY_DAYS } from '../../constants/inventory';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { daysUntil } from '../../utils/formatters';
import { groupBatchesByProduct, buildBatchDetailParams } from '../../utils/stockGroups';

// Matches TILE_WIDTH in StockBatchCard.
const TILE_WIDTH = 148;

const EXPIRY_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'nearExpiry', label: 'Near expiry' },
];
const SORT_OPTIONS = [
  { key: 'expiry', label: 'Soonest expiry' },
  { key: 'qtyDesc', label: 'Most stock' },
  { key: 'qtyAsc', label: 'Least stock' },
  { key: 'nameAsc', label: 'Name A–Z' },
];
// Out-of-stock products have no quantity or expiry, so only the name sort applies.
const OUT_SORT_OPTIONS = [
  { key: 'catalog', label: 'Default' },
  { key: 'nameAsc', label: 'Name A–Z' },
];

const compareExpiry = (a, b) => {
  if (!a.soonestExpDate && !b.soonestExpDate) return 0;
  if (!a.soonestExpDate) return 1;
  if (!b.soonestExpDate) return -1;
  return String(a.soonestExpDate).localeCompare(String(b.soonestExpDate));
};

export default function StockSectionListScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { title, tone, variant, branchName, branchId, rows = [], sortBy: initialSortBy } = route.params || {};
  const { width } = useWindowDimensions();
  const [sheetGroup, setSheetGroup] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [expiryFilter, setExpiryFilter] = useState('all');
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);

  const isOutOfStock = tone === 'out';
  // Near expiry only narrows In-Stock and Almost Out; every Expired batch is past it already.
  const showExpiryFilter = tone === 'healthy' || tone === 'low';
  const sortOptions = isOutOfStock ? OUT_SORT_OPTIONS : SORT_OPTIONS;
  const defaultSortKey = isOutOfStock ? 'catalog' : 'expiry';
  const [sortKey, setSortKey] = useState(() => {
    if (isOutOfStock) return initialSortBy === 'nameAsc' ? 'nameAsc' : 'catalog';
    return !initialSortBy || initialSortBy === 'default' ? 'expiry' : initialSortBy;
  });

  const hasActiveFilters = (showExpiryFilter && expiryFilter !== 'all') || sortKey !== defaultSortKey;
  const resetFilters = () => {
    setExpiryFilter('all');
    setSortKey(defaultSortKey);
  };

  const query = searchText.trim().toLowerCase();
  const items = useMemo(() => {
    const matchesQuery = (name, code) =>
      !query || String(name).toLowerCase().includes(query) || String(code).toLowerCase().includes(query);

    if (isOutOfStock) {
      const matching = rows.filter((row) => matchesQuery(row.name, row.code));
      return sortKey === 'nameAsc' ? [...matching].sort((a, b) => a.name.localeCompare(b.name)) : matching;
    }

    const matchesExpiry = (row) => {
      if (!showExpiryFilter || expiryFilter !== 'nearExpiry') return true;
      const daysLeft = daysUntil(row.exp_date);
      return daysLeft !== null && daysLeft <= NEAR_EXPIRY_DAYS;
    };
    const groups = groupBatchesByProduct(
      rows.filter((row) => matchesQuery(row.product_name, row.product_code) && matchesExpiry(row))
    );
    if (sortKey === 'qtyDesc') return groups.sort((a, b) => b.totalQuantity - a.totalQuantity);
    if (sortKey === 'qtyAsc') return groups.sort((a, b) => a.totalQuantity - b.totalQuantity);
    if (sortKey === 'nameAsc') return groups.sort((a, b) => a.product_name.localeCompare(b.product_name));
    return groups.sort(compareExpiry);
  }, [isOutOfStock, rows, query, sortKey, showExpiryFilter, expiryFilter]);

  const columns = Math.max(1, Math.floor((width - SPACING.lg * 2 + SPACING.sm) / (TILE_WIDTH + SPACING.sm)));
  const imageFor = (code) => PRODUCT_CATALOG.find((p) => p.code === code)?.image;

  const openBatch = (row) => navigation.navigate('StockBatchDetail', buildBatchDetailParams(row, { variant, branchName, branchId }));

  const renderItem = ({ item }) =>
    isOutOfStock ? (
      <StockBatchCard productName={item.name} image={imageFor(item.code)} outOfStock tone="out" />
    ) : (
      <StockBatchCard
        tone={tone}
        productName={item.product_name}
        image={imageFor(item.product_code)}
        quantity={item.totalQuantity}
        batchNumber={item.batches[0].batch_number}
        expDate={item.soonestExpDate}
        batchCount={item.batches.length}
        onPress={() => (item.batches.length === 1 ? openBatch(item.batches[0]) : setSheetGroup(item))}
      />
    );

  const renderChips = (options, activeKey, onSelect) => (
    <View style={styles.optionRow}>
      {options.map((option) => {
        const isActive = option.key === activeKey;
        return (
          <TouchableOpacity
            key={option.key}
            style={[styles.optionChip, isActive && styles.optionChipActive]}
            onPress={() => onSelect(option.key)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.optionChipText, isActive && styles.optionChipTextActive]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton
          backButtonText="Stock"
          title={`${title || 'Stock'} (${items.length})`}
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
        />

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
            style={styles.filterButton}
            onPress={() => setIsFilterSheetVisible(true)}
            activeOpacity={0.8}
            accessibilityLabel="Filter and sort"
            accessibilityRole="button"
          >
            <Icon name="filter" size={20} color="#FFFFFF" />
            {hasActiveFilters && <View style={styles.filterActiveDot} />}
          </TouchableOpacity>
        </View>

        <FlatList
          key={columns}
          data={items}
          numColumns={columns}
          keyExtractor={(item) => String(item.key ?? item.code)}
          renderItem={renderItem}
          columnWrapperStyle={columns > 1 ? styles.columnRow : undefined}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={styles.emptyText}>No products match your search or filters.</Text>}
        />
      </View>

      <CustomModal visible={isFilterSheetVisible} onClose={() => setIsFilterSheetVisible(false)} height="auto">
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Filter & sort</Text>
          {hasActiveFilters && (
            <TouchableOpacity onPress={resetFilters} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.sheetReset}>Reset</Text>
            </TouchableOpacity>
          )}
        </View>

        {showExpiryFilter && (
          <>
            <Text style={styles.sheetLabel}>EXPIRY</Text>
            {renderChips(EXPIRY_OPTIONS, expiryFilter, setExpiryFilter)}
          </>
        )}

        <Text style={styles.sheetLabel}>SORT BY</Text>
        {renderChips(sortOptions, sortKey, setSortKey)}

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

      <StockBatchListSheet
        visible={!!sheetGroup}
        onClose={() => setSheetGroup(null)}
        group={sheetGroup}
        tone={tone}
        onSelectBatch={(batch) => {
          setSheetGroup(null);
          openBatch(batch);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
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
  filterButton: {
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
  content: { padding: SPACING.lg, gap: SPACING.sm },
  columnRow: { gap: SPACING.sm },
  emptyText: {
    marginTop: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.xs },
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
});
