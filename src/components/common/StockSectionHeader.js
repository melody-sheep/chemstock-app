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
export default function StockSectionHeader({ dotColor, label, tooltip, style }) {
  return (
    <View style={[styles.row, style]}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={styles.label}>{label}</Text>
      <InfoTooltip message={tooltip} size={12} />
    </View>
  );
}

StockSectionHeader.propTypes = {
  dotColor: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  tooltip: PropTypes.string.isRequired,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
});
