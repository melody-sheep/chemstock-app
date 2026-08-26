// src/components/common/ActionCard.js
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import Icon from './Icon';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * ActionCard - Grid tile for dashboard "Main Operation" style menus.
 * Duotone icon (left) + title (right). Meant to be laid out in a 2-column
 * grid by the parent screen.
 */
export default function ActionCard({
  icon,
  iconColor = '#03045E',
  duotoneColor = null,
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
      <Icon
        name={icon}
        size={28}
        color={iconColor}
        duotoneColor={duotoneColor}
        weight="duotone"
        style={styles.icon}
      />
      <Text style={styles.title}>{title}</Text>
    </TouchableOpacity>
  );
}

ActionCard.propTypes = {
  icon: PropTypes.string.isRequired,
  iconColor: PropTypes.string,
  duotoneColor: PropTypes.string,
  title: PropTypes.string.isRequired,
  onPress: PropTypes.func,
  style: PropTypes.object,
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
    padding: SPACING.sm,
  },
  icon: {
    marginRight: SPACING.sm,
  },
  title: {
    flex: 1,
    flexWrap: 'wrap',
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: '#272632',
  },
});
