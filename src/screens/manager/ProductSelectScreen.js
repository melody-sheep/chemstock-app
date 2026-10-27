// src/screens/manager/ProductSelectScreen.js
import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BlurTargetView } from 'expo-blur';
import { useNavigation, useRoute } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import LiveStatusPill from '../../components/common/LiveStatusPill';
import SectionHeader from '../../components/common/SectionHeader';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import ProductGridTile from '../../components/common/ProductGridTile';
import BottomActionBar, { useBottomActionBarHeight } from '../../components/common/BottomActionBar';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import { logEvent } from '../../utils/logger';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const { width: screenWidth } = Dimensions.get('window');
const GRID_COLUMNS = 4;
const TILE_WIDTH = Math.floor((screenWidth - SPACING.md * 2 - SPACING.sm * (GRID_COLUMNS - 1)) / GRID_COLUMNS);

// Multi-select picker for Release Stock Quick Register; Done returns `pickedProducts`.
export default function ProductSelectScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const bottomActionBarHeight = useBottomActionBarHeight();
  const blurTarget = useRef(null);
  const alreadyAddedCodes = route.params?.alreadyAddedCodes || [];

  const [searchText, setSearchText] = useState('');
  const [selectedCodes, setSelectedCodes] = useState([]);

  const query = searchText.trim().toLowerCase();
  const products = PRODUCT_CATALOG.filter(
    (p) =>
      !alreadyAddedCodes.includes(p.code) &&
      (!query || p.name.toLowerCase().includes(query) || p.code.toLowerCase().includes(query))
  );

  const toggleProduct = (code) => {
    logEvent('ProductSelect', 'toggle', { code, selecting: !selectedCodes.includes(code) });
    setSelectedCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  const handleDone = () => {
    const pickedProducts = PRODUCT_CATALOG.filter((p) => selectedCodes.includes(p.code));
    logEvent('ProductSelect', 'done', { codes: pickedProducts.map((p) => p.code) });
    navigation.navigate('QuickRegisterRelease', { pickedProducts }, { merge: true, pop: true });
  };

  const doneLabel = selectedCodes.length > 0 ? `Done (${selectedCodes.length})` : 'Done';

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

        <SecondaryHeader height={76}>
          <View style={styles.titleRow}>
            <View style={styles.titleTextCol}>
              <Text style={styles.pageTitle} numberOfLines={1}>Select Products</Text>
              <Text style={styles.pageSubtitle}>Tap one or more products to add</Text>
            </View>
            <LiveStatusPill pillStyle={styles.onlinePill} dotStyle={styles.onlineDot} textStyle={styles.onlineText} />
          </View>
        </SecondaryHeader>

        <BlurTargetView ref={blurTarget} style={styles.contentTarget}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomActionBarHeight + SPACING.md + SPACING.lg }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Input
            icon="search"
            placeholder="Search product name or code"
            value={searchText}
            onChangeText={setSearchText}
          />

          <View style={styles.gridLabelRow}>
            <SectionHeader
              icon="package"
              size="md"
              label={query ? `Results (${products.length})` : `All Products (${products.length})`}
              style={styles.gridLabel}
            />
            {selectedCodes.length > 0 && (
              <TouchableOpacity
                onPress={() => setSelectedCodes([])}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Clear selected products"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.clearText}>Clear ({selectedCodes.length})</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.grid}>
            {products.map((product) => (
              <ProductGridTile
                key={product.code}
                product={product}
                selected={selectedCodes.includes(product.code)}
                onPress={() => toggleProduct(product.code)}
                width={TILE_WIDTH}
              />
            ))}
          </View>

          {products.length === 0 && <Text style={styles.emptyText}>No products found.</Text>}
        </ScrollView>
        </BlurTargetView>

        <BottomActionBar variant="glass" blurTarget={blurTarget}>
          {selectedCodes.length === 0 && <Text style={styles.selectHint}>Tap a product to select it.</Text>}
          <Button
            title={doneLabel}
            variant="black"
            icon="checkmark"
            iconSize={18}
            onPress={handleDone}
            disabled={selectedCodes.length === 0}
            height={48}
            fontSize={16}
            borderRadius={24}
          />
        </BottomActionBar>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentTarget: { flex: 1 },
  content: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    gap: SPACING.sm,
  },
  gridLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  gridLabel: { marginTop: SPACING.sm, marginBottom: 0 },
  clearText: {
    marginTop: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#0085F9',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
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
  selectHint: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: SPACING.md,
  },
});
