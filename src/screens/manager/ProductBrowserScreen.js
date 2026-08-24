// src/screens/manager/ProductBrowserScreen.js
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SubScreenSecondaryHeader from '../../components/common/SubScreenSecondaryHeader';
import Icon from '../../components/common/Icon';
import StockBatchCard from '../../components/common/StockBatchCard';
import FilterSheet from '../../components/common/FilterSheet';
import SearchDropdownField from '../../components/common/SearchDropdownField';
import authService from '../../services/authService';
import inventoryService from '../../services/inventoryService';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
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

/**
 * ProductBrowserScreen - full-screen "pick a product" browser for Add New
 * Batches. Shows the entire catalog in one flat, sortable grid rather than
 * grouped by stock level — a manager browsing to add a batch is looking for
 * a specific product, not triaging stock health (that's what Manager Stocks
 * is for). A "Frequently Added" row surfaces the manager's own most-used
 * products as a quick pick above the full grid.
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
  stock.forEach((row) => {
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

  // "Frequently Added" stays full-color (tint + icon) as a visually distinct
  // shortcut row; the exhaustive "All Products" grid below stays wireframe
  // so it reads as a plain browsable list rather than competing for attention.
  const renderCard = (product, { wireframe = true } = {}) => {
    const agg = stockByProduct[product.code];
    return (
      <TouchableOpacity key={product.code} onPress={() => handleSelect(product)} activeOpacity={0.7}>
        {agg ? (
          <StockBatchCard
            productName={product.name}
            quantity={agg.totalQty}
            batchNumber={agg.earliestRow.batch_number}
            expDate={agg.earliestRow.exp_date}
            thumbTint={wireframe ? null : product.tint}
            wireframe={wireframe}
          />
        ) : (
          <StockBatchCard
            productName={product.name}
            outOfStock
            thumbTint={wireframe ? null : product.tint}
            wireframe={wireframe}
          />
        )}
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

        <SubScreenSecondaryHeader title="Select a Product" />

        <View style={styles.searchFrameWrap}>
          <SearchDropdownField
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search products"
            onButtonPress={handleFilterPress}
            buttonIcon="filter"
            showButtonDot={sortOrder !== 'nameAsc'}
          />
        </View>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {frequentProducts.length > 0 && (
              <>
                <View style={styles.sectionHeaderRow}>
                  <Icon name="clock" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.sectionTitle}>Frequently Added</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
                  {frequentProducts.map((product) => renderCard(product, { wireframe: false }))}
                </ScrollView>
                <View style={styles.sectionSpacing} />
              </>
            )}

            <View style={styles.sectionHeaderRow}>
              <Icon name="grid" size={16} color={COLORS.textSecondary} />
              <Text style={styles.sectionTitle}>All Products</Text>
            </View>
            {pickableProducts.length > 0 ? (
              <View style={styles.grid}>{pickableProducts.map((product) => renderCard(product))}</View>
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
  searchFrameWrap: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
  },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: 48,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  sectionSpacing: { height: SPACING.lg },
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
});
