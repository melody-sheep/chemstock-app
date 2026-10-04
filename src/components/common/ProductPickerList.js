// src/components/common/ProductPickerList.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import SearchDropdownField from './SearchDropdownField';
import SelectedProductsRow from './SelectedProductsRow';
import RegisteredItemsList from './RegisteredItemsList';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../styles/typography';

// Shows the release's selected products and opens ProductSelectScreen via onOpenPicker.
export default function ProductPickerList({
  items,
  onItemsChange,
  onOpenPicker,
  queueTitle = 'Items To Be Registered',
  queueCardHeader = 'List of Items',
}) {
  const handleRemoveProduct = (code) => {
    onItemsChange(items.filter((item) => item.code !== code));
  };

  const handleSetQty = (code, qty) => {
    onItemsChange(
      items.map((item) => (item.code === code ? { ...item, registeredQty: Math.max(1, qty) } : item))
    );
  };

  const handleDateChange = (code, field, value) => {
    onItemsChange(items.map((item) => (item.code === code ? { ...item, [field]: value } : item)));
  };

  return (
    <>
      <Text style={styles.sectionTitle}>Search Product:</Text>
      <SearchDropdownField
        value=""
        onChangeText={() => {}}
        placeholder="Search product name or code"
        onFieldPress={onOpenPicker}
        onButtonPress={onOpenPicker}
        buttonIcon="caretDown"
      />

      <SelectedProductsRow items={items} onRemove={handleRemoveProduct} />

      <RegisteredItemsList
        items={items}
        onSetQty={handleSetQty}
        onDateChange={handleDateChange}
        onRemove={handleRemoveProduct}
        sectionTitle={queueTitle}
        cardHeaderTitle={queueCardHeader}
      />
    </>
  );
}

ProductPickerList.propTypes = {
  items: PropTypes.array.isRequired,
  onItemsChange: PropTypes.func.isRequired,
  onOpenPicker: PropTypes.func.isRequired,
  queueTitle: PropTypes.string,
  queueCardHeader: PropTypes.string,
};

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
  },
});
