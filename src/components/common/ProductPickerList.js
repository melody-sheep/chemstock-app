// src/components/common/ProductPickerList.js
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import Input from './Input';
import Icon from './Icon';
import SelectedProductsRow from './SelectedProductsRow';
import RegisteredItemsList from './RegisteredItemsList';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const PLACEHOLDER_IMAGE = require('../../../assets/image/empty_box1.png');

/**
 * ProductPickerList - search + select products from PRODUCT_CATALOG, adjust
 * quantity/mfg/exp per selection. Extracted from AddNewBatchesScreen's
 * inline search/chips/stepper block once a second screen (Quick Register
 * Release) needed the identical picking UX — AddNewBatchesScreen itself is
 * left untouched (working flow, not worth the regression risk to save one
 * file).
 *
 * Controlled: caller owns `items` state and receives updates via
 * `onItemsChange`, same shape AddNewBatchesScreen already produces —
 * `{ ...catalogEntry(code,name,image), registeredQty, mfgDate, expDate }`.
 */
export default function ProductPickerList({
  items,
  onItemsChange,
  queueTitle = 'Items To Be Registered',
  queueCardHeader = 'List of Items',
}) {
  const [searchText, setSearchText] = React.useState('');
  const [showSuggestions, setShowSuggestions] = React.useState(false);

  const selectedCodes = items.map((item) => item.code);
  const availableProducts = PRODUCT_CATALOG.filter((p) => !selectedCodes.includes(p.code));
  const query = searchText.trim().toLowerCase();
  const suggestions = query
    ? availableProducts.filter((p) => p.name.toLowerCase().includes(query) || p.code.toLowerCase().includes(query))
    : (showSuggestions ? availableProducts : []);

  const handleSelectProduct = (product) => {
    onItemsChange([...items, { ...product, registeredQty: 1, mfgDate: '', expDate: '' }]);
    setSearchText('');
    setShowSuggestions(false);
  };

  const handleRemoveProduct = (code) => {
    onItemsChange(items.filter((item) => item.code !== code));
  };

  const handleAdjustQty = (code, delta) => {
    onItemsChange(
      items.map((item) =>
        item.code === code ? { ...item, registeredQty: Math.max(1, item.registeredQty + delta) } : item
      )
    );
  };

  const handleDateChange = (code, field, value) => {
    onItemsChange(items.map((item) => (item.code === code ? { ...item, [field]: value } : item)));
  };

  return (
    <>
      <Text style={styles.sectionTitle}>Search Product:</Text>
      <Input
        icon="search"
        placeholder="Search product name or code"
        value={searchText}
        onChangeText={setSearchText}
        rightIcon={<Icon name="caretDown" size={18} color={COLORS.primary} weight="bold" />}
        onRightIconPress={() => setShowSuggestions((v) => !v)}
      />

      {suggestions.length > 0 && (
        <View style={styles.suggestionsBox}>
          {suggestions.map((product) => (
            <TouchableOpacity
              key={product.code}
              style={styles.suggestionRow}
              onPress={() => handleSelectProduct(product)}
              activeOpacity={0.7}
            >
              <Image source={product.image || PLACEHOLDER_IMAGE} style={styles.suggestionThumb} resizeMode="cover" />
              <Text style={styles.suggestionText}>{product.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <SelectedProductsRow items={items} onRemove={handleRemoveProduct} />

      <RegisteredItemsList
        items={items}
        onAdjustQty={handleAdjustQty}
        onDateChange={handleDateChange}
        sectionTitle={queueTitle}
        cardHeaderTitle={queueCardHeader}
      />
    </>
  );
}

ProductPickerList.propTypes = {
  items: PropTypes.array.isRequired,
  onItemsChange: PropTypes.func.isRequired,
  queueTitle: PropTypes.string,
  queueCardHeader: PropTypes.string,
};

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  suggestionsBox: {
    marginTop: -SPACING.sm,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  suggestionThumb: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  suggestionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: '#272632',
  },
});
