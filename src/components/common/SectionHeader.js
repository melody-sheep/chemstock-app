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
export default function SectionHeader({ icon, label, style = {} }) {
  return (
    <View style={[styles.row, style]}>
      {!!icon && <Icon name={icon} size={14} color={COLORS.textTertiary} />}
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

SectionHeader.propTypes = {
  icon: PropTypes.string,
  label: PropTypes.string.isRequired,
  style: PropTypes.object,
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
});
