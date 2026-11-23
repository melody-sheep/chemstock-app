// src/screens/common/StockSectionListScreen.js
// Opened from a stock section's "View all" link on the Manager and Sales Rep
// stock screens. Shows that section's cards as a vertical grid instead of the
// horizontal row, one card per product like the section itself. It lists
// exactly what the section showed (a snapshot taken when the link was tapped),
// so search and expiry filters carry over. It can be re-sorted here, starting
// from the sort picked on the stock screen.
import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, ScrollView, TouchableOpacity, useWindowDimensions, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import Header from '../../components/common/Header';
import StockBatchCard from '../../components/common/StockBatchCard';
import StockBatchListSheet from '../../components/common/StockBatchListSheet';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { groupBatchesByProduct, buildBatchDetailParams } from '../../utils/stockGroups';

// Matches TILE_WIDTH in StockBatchCard.
const TILE_WIDTH = 148;

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

  const isOutOfStock = tone === 'out';
  const sortOptions = isOutOfStock ? OUT_SORT_OPTIONS : SORT_OPTIONS;
  const [sortKey, setSortKey] = useState(() => {
    if (isOutOfStock) return initialSortBy === 'nameAsc' ? 'nameAsc' : 'catalog';
    return !initialSortBy || initialSortBy === 'default' ? 'expiry' : initialSortBy;
  });

  const items = useMemo(() => {
    if (isOutOfStock) {
      return sortKey === 'nameAsc' ? [...rows].sort((a, b) => a.name.localeCompare(b.name)) : rows;
    }
    const groups = groupBatchesByProduct(rows);
    if (sortKey === 'qtyDesc') return groups.sort((a, b) => b.totalQuantity - a.totalQuantity);
    if (sortKey === 'qtyAsc') return groups.sort((a, b) => a.totalQuantity - b.totalQuantity);
    if (sortKey === 'nameAsc') return groups.sort((a, b) => a.product_name.localeCompare(b.product_name));
    return groups.sort(compareExpiry);
  }, [isOutOfStock, rows, sortKey]);

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

        <View style={styles.sortBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
            {sortOptions.map((option) => {
              const isActive = option.key === sortKey;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.sortPill, isActive && styles.sortPillActive]}
                  onPress={() => setSortKey(option.key)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                >
                  <Text style={[styles.sortPillText, isActive && styles.sortPillTextActive]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
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
        />
      </View>

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
  sortBar: { paddingTop: SPACING.md },
  sortRow: { paddingHorizontal: SPACING.lg, gap: SPACING.sm },
  sortPill: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#D5DAE3',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortPillActive: { borderColor: '#0085F9', backgroundColor: '#EAF4FF' },
  sortPillText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: COLORS.textSecondary,
  },
  sortPillTextActive: { color: '#0085F9', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  content: { padding: SPACING.lg, gap: SPACING.sm },
  columnRow: { gap: SPACING.sm },
});
