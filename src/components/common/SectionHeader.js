// src/components/common/SectionHeader.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import Icon from './Icon';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * SectionHeader - small icon + uppercase label pair used above content
 * cards across detail screens.
 *
 * Replaces inline copies in:
 *   - StockLogDetailScreen (Manager)
 *   - SalesRepLogDetailScreen (SR)
 */
export default function SectionHeader({ icon, label, style = {}, size = 'sm' }) {
  const large = size === 'md';
  return (
    <View style={[styles.row, style]}>
      {!!icon && <Icon name={icon} size={large ? 18 : 14} color={large ? COLORS.textSecondary : COLORS.textTertiary} />}
      <Text style={[styles.label, large && styles.labelLarge]}>{label}</Text>
    </View>
  );
}

SectionHeader.propTypes = {
  icon: PropTypes.string,
  label: PropTypes.string.isRequired,
  style: PropTypes.object,
  // 'sm' (default) is the compact label; 'md' is a larger, easier-to-read one.
  size: PropTypes.oneOf(['sm', 'md']),
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textTertiary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  labelLarge: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    letterSpacing: 0.6,
  },
});
