// src/screens/manager/ProductSelectScreen.js
import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SubScreenSecondaryHeader from '../../components/common/SubScreenSecondaryHeader';
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
const TILE_WIDTH = Math.floor((screenWidth - SPACING.md * 2 - SPACING.xs * (GRID_COLUMNS - 1)) / GRID_COLUMNS);

// Multi-select picker for Release Stock Quick Register; Done returns `pickedProducts`.
export default function ProductSelectScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const bottomActionBarHeight = useBottomActionBarHeight();
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

        <SubScreenSecondaryHeader title="Select Products" syncStatus="online" />

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomActionBarHeight + SPACING.md }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Input
            icon="search"
            placeholder="Search product name or code"
            value={searchText}
            onChangeText={setSearchText}
          />

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

        <BottomActionBar>
          <Button
            title={doneLabel}
            variant="black"
            icon="checkmark"
            iconSize={18}
            onPress={handleDone}
            disabled={selectedCodes.length === 0}
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
  content: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    gap: SPACING.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
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
