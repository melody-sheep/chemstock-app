// src/components/common/DateChip.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import Icon from './Icon';
import { formatDisplayDate } from '../../utils/formatters';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

// Tappable MFG/EXP date control. Unset dates get a warning outline so they read as "tap me".
export default function DateChip({ label, value, onPress, accessibilityLabel }) {
  const isSet = Boolean(value);
  return (
    <TouchableOpacity
      style={[styles.chip, isSet ? styles.chipSet : styles.chipUnset]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
    >
      <View style={styles.iconSegment}>
        <Icon name="calendar" size={12} color={COLORS.primary} />
      </View>
      <Text style={styles.text}>
        {label}: {isSet ? formatDisplayDate(value) : 'Set date'}
      </Text>
    </TouchableOpacity>
  );
}

DateChip.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
  onPress: PropTypes.func.isRequired,
  accessibilityLabel: PropTypes.string,
};

DateChip.defaultProps = {
  value: '',
  accessibilityLabel: undefined,
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    alignSelf: 'flex-start',
    borderRadius: 6,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: COLORS.textWhite,
  },
  chipUnset: {
    borderColor: COLORS.warning,
  },
  chipSet: {
    borderColor: COLORS.borderLight,
  },
  iconSegment: {
    justifyContent: 'center',
    paddingHorizontal: 5,
    backgroundColor: COLORS.primaryLight,
  },
  text: {
    alignSelf: 'center',
    paddingVertical: 3,
    paddingHorizontal: SPACING.xs,
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textPrimary,
  },
});
