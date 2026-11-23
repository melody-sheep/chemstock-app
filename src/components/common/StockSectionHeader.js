// src/components/common/StockSectionHeader.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import InfoTooltip from './InfoTooltip';
import { TYPOGRAPHY } from '../../styles/typography';
import { SPACING } from '../../styles/spacing';

/**
 * StockSectionHeader - colored dot + short label, with a small "?" sitting
 * right next to the label (not pushed to the row's far edge) that explains
 * what the section means. Replaces the old "Label (Parenthetical
 * Explanation)" pattern — the explanation now lives in the tooltip. The dot
 * (not an icon) matches the original design intentionally.
 */
export default function StockSectionHeader({ dotColor, label, tooltip, style, count = null, onViewAll = null }) {
  // With a count: a small coloured bar, an uppercase label and the number.
  const withCount = count !== null;
  return (
    <View style={[styles.row, style]}>
      <View style={withCount ? [styles.bar, { backgroundColor: dotColor }] : [styles.dot, { backgroundColor: dotColor }]} />
      <Text style={withCount ? styles.labelCompact : styles.label}>{withCount ? `${label} (${count})` : label}</Text>
      <InfoTooltip message={tooltip} size={withCount ? 16 : 10} color={withCount ? '#9AA3B2' : null} />
      {onViewAll && (
        <TouchableOpacity
          style={styles.viewAll}
          onPress={onViewAll}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={`View all ${label}`}
        >
          <Text style={styles.viewAllText}>View all</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

StockSectionHeader.propTypes = {
  dotColor: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  tooltip: PropTypes.string.isRequired,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  count: PropTypes.number,
  onViewAll: PropTypes.func,
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  bar: { width: 4, height: 18, borderRadius: 2 },
  viewAll: { marginLeft: 'auto' },
  viewAllText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#0085F9',
  },
  labelCompact: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  label: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
});
