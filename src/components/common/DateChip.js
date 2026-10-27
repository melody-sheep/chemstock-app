// src/components/common/DateChip.js
import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import Icon from './Icon';
import { formatDisplayDate } from '../../utils/formatters';
import { TYPOGRAPHY } from '../../styles/typography';

// Tappable MFG / EXP date control, square-cornered. Each date has its own
// colour so they can't be mixed up: MFG blue, EXP pinkish red. Not set yet:
// a light tint with a dashed border and "Tap to set". Set: solid colour, white
// text, a check mark and the date — "filled in" reads at a glance.
const TONES = {
  MFG: { solid: '#1E6FE0', tint: '#EAF2FF', border: '#7FA8F0', text: '#1450AA' },
  EXP: { solid: '#D6336C', tint: '#FFEBF1', border: '#EE7FA1', text: '#A61E4D' },
};

export default function DateChip({ label, value, onPress, accessibilityLabel }) {
  const isSet = Boolean(value);
  const tone = TONES[String(label).toUpperCase()] || TONES.MFG;
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        isSet
          ? { backgroundColor: tone.solid, borderColor: tone.solid }
          : { backgroundColor: tone.tint, borderColor: tone.border, borderStyle: 'dashed' },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
    >
      <Icon
        name={isSet ? 'checkmark' : 'calendar'}
        size={13}
        color={isSet ? '#FFFFFF' : tone.text}
        weight={isSet ? 'bold' : 'regular'}
      />
      <Text style={[styles.label, { color: isSet ? '#FFFFFF' : tone.text }]}>{label}</Text>
      <Text style={[styles.value, { color: isSet ? "#FFFFFF" : tone.text }]} numberOfLines={1}>
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
  // One fixed size for both, so MFG and EXP always line up.
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    width: 144,
    height: 30,
    borderRadius: 0,
    borderWidth: 1.5,
    paddingHorizontal: 6,
  },
  label: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  value: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
});
