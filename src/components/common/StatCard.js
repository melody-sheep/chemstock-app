// src/components/common/StatCard.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import Icon from './Icon';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * StatCard - Quick-stat tile: duotone icon, bold value, label.
 * Flat card with a colored left accent stroke (no shadow, no full border).
 * Used in dashboard "Quick Stats" rows across roles.
 */
export default function StatCard({
  icon,
  iconColor = '#03045E',
  accentColor = '#03045E',
  backgroundColor = '#FFFFFF',
  borderLeftColor = '#03045E',
  value,
  label,
  style = {},
}) {
  return (
    <View style={[styles.card, { backgroundColor, borderLeftColor }, style]}>
      <Icon name={icon} size={28} color={iconColor} weight="duotone" style={styles.icon} />
      <Text style={[styles.value, { color: accentColor }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

StatCard.propTypes = {
  icon: PropTypes.string.isRequired,
  iconColor: PropTypes.string,
  accentColor: PropTypes.string,
  backgroundColor: PropTypes.string,
  borderLeftColor: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  label: PropTypes.string.isRequired,
  style: PropTypes.object,
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 10,
    borderLeftWidth: 2,
    padding: SPACING.md,
  },
  icon: {
    marginBottom: SPACING.sm,
  },
  value: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: '#757575',
    marginTop: 2,
  },
});
