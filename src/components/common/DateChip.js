// src/components/common/DateChip.js
import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import Icon from './Icon';
import { formatDisplayDate } from '../../utils/formatters';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../styles/typography';

// Tappable MFG/EXP date control. The old version only told set apart from
// unset by a thin border color — easy to miss and easy to misread as
// already-set when it wasn't. Unset now gets a solid amber fill with a
// "Tap to set" call to action; set gets a solid green fill with a
// checkmark and the actual date rendered large/bold enough to read at a
// glance instead of a tiny 11px line.
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
      <Icon
        name={isSet ? 'checkmark' : 'calendar'}
        size={13}
        color={isSet ? COLORS.success : '#B26400'}
        weight={isSet ? 'bold' : 'regular'}
      />
      <Text style={[styles.label, isSet ? styles.labelSet : styles.labelUnset]}>{label}</Text>
      <Text style={[styles.value, isSet ? styles.valueSet : styles.valueUnset]}>
        {isSet ? formatDisplayDate(value) : 'Tap to set'}
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
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    borderRadius: 8,
    borderWidth: 1.5,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  chipUnset: {
    backgroundColor: '#FFF4E0',
    borderColor: '#FFC56A',
  },
  chipSet: {
    backgroundColor: '#E8F8EE',
    borderColor: COLORS.success,
  },
  label: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  labelUnset: {
    color: '#B26400',
  },
  labelSet: {
    color: '#1E7A3A',
  },
  value: {
    fontSize: 12.5,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  valueUnset: {
    color: '#B26400',
  },
  valueSet: {
    color: '#1E7A3A',
  },
});
