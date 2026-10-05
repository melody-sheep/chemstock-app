// src/components/common/MapLegend.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { glassPanel } from '../../styles/glass';

const DOT_SIZE = 9;

/**
 * MapLegend - glass pill listing what each map marker means. Items are
 * { label, color, shape: 'dot' | 'pin' }. Shared by the Manager, Sales Rep, and
 * Collector delivery maps so the legend looks the same on all three.
 */
export default function MapLegend({ items }) {
  return (
    <View style={[styles.pill, glassPanel]}>
      {items.map((item) => (
        <View key={item.label} style={styles.item}>
          <View
            style={[item.shape === 'pin' ? styles.pin : styles.dot, { backgroundColor: item.color }]}
          />
          <Text style={styles.text}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

MapLegend.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      color: PropTypes.string.isRequired,
      shape: PropTypes.oneOf(['dot', 'pin']),
    })
  ).isRequired,
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs + 2,
    paddingHorizontal: SPACING.md - 2,
    borderRadius: 999,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2 },
  pin: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    transform: [{ rotate: '45deg' }],
    borderBottomLeftRadius: 0,
  },
  text: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
  },
});
