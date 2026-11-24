// src/components/common/StockSummaryStrip.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { STOCK_HEALTHY_THRESHOLD } from '../../constants/inventory';
import { isExpired } from '../../utils/expiry';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../styles/typography';
import { SPACING } from '../../styles/spacing';

/**
 * StockSummaryStrip - a quick count of the branch's stock at the top of the
 * Stock screen: how many products are In-Stock, Almost Out and Expired, with
 * the pieces behind each. It always counts the whole branch, so typing in the
 * search box or applying a filter doesn't change it. A product counts once per
 * group, the same way the section headers below count their cards.
 */
const TILES = [
  { key: 'healthy', label: 'In-Stock', barColor: COLORS.success, numberColor: COLORS.success },
  { key: 'low', label: 'Almost Out', barColor: COLORS.warning, numberColor: '#B7791F' },
  { key: 'expired', label: 'Expired', barColor: '#8B1E2D', numberColor: '#8B1E2D' },
];

function classify(row) {
  if (!(row.quantity > 0)) return null;
  if (isExpired(row.exp_date)) return 'expired';
  return row.quantity >= STOCK_HEALTHY_THRESHOLD ? 'healthy' : 'low';
}

export function summarizeStock(rows) {
  const products = { healthy: new Set(), low: new Set(), expired: new Set() };
  const pieces = { healthy: 0, low: 0, expired: 0 };
  rows.forEach((row) => {
    const group = classify(row);
    if (!group) return;
    products[group].add(row.product_code);
    pieces[group] += row.quantity;
  });
  return Object.fromEntries(
    Object.keys(products).map((key) => [key, { products: products[key].size, pieces: pieces[key] }])
  );
}

export default function StockSummaryStrip({ rows, style }) {
  const summary = summarizeStock(rows);
  return (
    <View style={[styles.row, style]}>
      {TILES.map((tile) => {
        const { products, pieces } = summary[tile.key];
        return (
          <View
            key={tile.key}
            style={styles.tile}
            accessible
            accessibilityLabel={`${tile.label}: ${products} ${products === 1 ? 'product' : 'products'}, ${pieces} pieces`}
          >
            <View style={[styles.bar, { backgroundColor: tile.barColor }]} />
            <View style={styles.tileBody}>
              <Text style={styles.label} numberOfLines={1}>{tile.label}</Text>
              <View style={styles.countRow}>
                <Text style={[styles.count, { color: tile.numberColor }]}>{products}</Text>
                <Text style={styles.pieces} numberOfLines={1}>{pieces} pcs</Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

StockSummaryStrip.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.object).isRequired,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  tile: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E3E7EE',
    backgroundColor: '#FFFFFF',
  },
  bar: { width: 4 },
  tileBody: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
  },
  count: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  pieces: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
});
