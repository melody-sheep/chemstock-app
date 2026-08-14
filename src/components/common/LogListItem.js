// src/components/common/LogListItem.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import Icon from './Icon';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * LogListItem - Single row for "Recent Logs" style activity lists.
 * Circular duotone icon badge + description text.
 */
export default function LogListItem({
  icon,
  iconColor = '#03045E',
  text,
  style = {},
}) {
  console.log(`📋 [LogListItem] Rendering "${text}" with icon="${icon}"`);
  return (
    <View style={[styles.row, style]}>
      <View style={[styles.iconBadge, { backgroundColor: `${iconColor}15` }]}>
        <Icon name={icon} size={16} color={iconColor} weight="duotone" />
      </View>
      <Text style={styles.text} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

LogListItem.propTypes = {
  icon: PropTypes.string.isRequired,
  iconColor: PropTypes.string,
  text: PropTypes.string.isRequired,
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
