// src/components/common/LogListItem.js
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import Icon from './Icon';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * LogListItem - Single row for "Recent Logs" style activity lists.
 * Circular duotone icon badge + description text. Pass `onPress` to make
 * the row tappable (e.g. jump to a transaction's detail view); omitted,
 * it renders identically to before but inert, for read-only lists.
 */
export default function LogListItem({
  icon,
  iconColor = '#03045E',
  text,
  onPress = null,
  style = {},
}) {
  console.log(`📋 [LogListItem] Rendering "${text}" with icon="${icon}"`);
  return (
    <TouchableOpacity
      style={[styles.row, style]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <View style={[styles.iconBadge, { backgroundColor: `${iconColor}15` }]}>
        <Icon name={icon} size={16} color={iconColor} weight="duotone" />
      </View>
      <Text style={styles.text} numberOfLines={1}>
        {text}
      </Text>
    </TouchableOpacity>
  );
}

LogListItem.propTypes = {
  icon: PropTypes.string.isRequired,
  iconColor: PropTypes.string,
  text: PropTypes.string.isRequired,
  onPress: PropTypes.func,
  style: PropTypes.object,
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: '#272632',
  },
});
