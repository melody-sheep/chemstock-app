// src/components/common/StockSectionHeader.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
export default function StockSectionHeader({ dotColor, label, tooltip, style, count = null }) {
  // With a count: a small coloured bar, an uppercase label and the number.
  const withCount = count !== null;
  return (
    <View style={[styles.row, style]}>
      <View style={withCount ? [styles.bar, { backgroundColor: dotColor }] : [styles.dot, { backgroundColor: dotColor }]} />
      <Text style={withCount ? styles.labelCompact : styles.label}>{withCount ? `${label} (${count})` : label}</Text>
      <InfoTooltip message={tooltip} size={withCount ? 16 : 10} color={withCount ? '#9AA3B2' : null} />
    </View>
  );
}

StockSectionHeader.propTypes = {
  dotColor: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  tooltip: PropTypes.string.isRequired,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  count: PropTypes.number,
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  bar: { width: 4, height: 18, borderRadius: 2 },
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
