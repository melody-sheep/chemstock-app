// src/components/common/ActionCard.js
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import PropTypes from 'prop-types';
import Icon from './Icon';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * ActionCard - Grid tile for dashboard "Main Operation" style menus.
 * Duotone icon (top-left) + title. Meant to be laid out in a 2-column grid
 * by the parent screen.
 */
export default function ActionCard({
  icon,
  iconColor = '#03045E',
  title,
  onPress = null,
  style = {},
}) {
  return (
    <TouchableOpacity
      style={[styles.card, style]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={title}
      accessibilityRole="button"
    >
      <Icon name={icon} size={28} color={iconColor} weight="duotone" style={styles.icon} />
      <Text style={styles.title}>{title}</Text>
    </TouchableOpacity>
  );
}

ActionCard.propTypes = {
  icon: PropTypes.string.isRequired,
  iconColor: PropTypes.string,
  title: PropTypes.string.isRequired,
  onPress: PropTypes.func,
  style: PropTypes.object,
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
    padding: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      },
    }),
  },
  icon: {
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: '#272632',
  },
});
