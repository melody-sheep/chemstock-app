// src/components/common/SelectedProductsRow.js
import React from 'react';
import { Text, ScrollView, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import ProductChip from './ProductChip';
import SectionHeader from './SectionHeader';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * SelectedProductsRow - section title + horizontal strip of ProductChips
 * (or a muted empty message). Owns none of the item data itself; the caller
 * still owns `items` and receives removals via `onRemove(code)`.
 */
export default function SelectedProductsRow({ items, onRemove, title = 'Selected Products', labelHeader = false }) {
  return (
    <>
      {labelHeader ? (
        <SectionHeader icon="checkCircle" size="md" label={title} style={{ marginTop: SPACING.md, marginBottom: 0 }} />
      ) : (
        <Text style={styles.sectionTitle}>{title}</Text>
      )}
      {items.length === 0 ? (
        <Text style={styles.mutedText}>No products selected yet.</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.rowOuter}
          contentContainerStyle={styles.row}
        >
          {items.map((item, index) => (
            <ProductChip
              key={item.code}
              index={index}
              name={item.name}
              image={item.image}
              onRemove={() => onRemove(item.code)}
            />
          ))}
        </ScrollView>
      )}
    </>
  );
}

SelectedProductsRow.propTypes = {
  items: PropTypes.array.isRequired,
  onRemove: PropTypes.func.isRequired,
  title: PropTypes.string,
  labelHeader: PropTypes.bool,
};

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  mutedText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  rowOuter: {
    marginTop: -SPACING.md,
  },
  row: {
    gap: SPACING.sm,
    paddingTop: 12,
    paddingRight: SPACING.sm,
  },
});
