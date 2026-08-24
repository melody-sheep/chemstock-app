// src/components/common/QuantityStepper.js
import React, { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import PropTypes from 'prop-types';
import Icon from './Icon';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * QuantityStepper - minus/plus buttons framing an editable quantity field,
 * so the count can be typed directly instead of only stepped one at a
 * time. Keeps its own local text state so the field can go blank mid-edit;
 * on blur/submit it commits a clamped integer back via onChange. The frame
 * (border + larger tap targets) makes the whole control read as one
 * cohesive, easy-to-hit unit instead of three loose pieces.
 */
export default function QuantityStepper({ value, onChange, min = 1, label }) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  const commit = (nextValue) => {
    const clamped = Math.max(min, Number.isFinite(nextValue) ? nextValue : min);
    setText(String(clamped));
    if (clamped !== value) onChange(clamped);
  };

  const handleChangeText = (raw) => setText(raw.replace(/[^0-9]/g, ''));
  const handleBlur = () => commit(parseInt(text, 10));
  const handleStep = (delta) => commit(value + delta);

  return (
    <View style={styles.frame}>
      <TouchableOpacity
        style={styles.stepperBtn}
        onPress={() => handleStep(-1)}
        accessibilityLabel={`Decrease ${label || 'quantity'}`}
        accessibilityRole="button"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Icon name="minus" size={14} color={COLORS.primary} weight="bold" />
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        value={text}
        onChangeText={handleChangeText}
        onBlur={handleBlur}
        onSubmitEditing={handleBlur}
        keyboardType="number-pad"
        returnKeyType="done"
        selectTextOnFocus
        accessibilityLabel={`${label || 'Quantity'} input`}
      />

      <TouchableOpacity
        style={styles.stepperBtn}
        onPress={() => handleStep(1)}
        accessibilityLabel={`Increase ${label || 'quantity'}`}
        accessibilityRole="button"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Icon name="plus" size={14} color={COLORS.primary} weight="bold" />
      </TouchableOpacity>
    </View>
  );
}

QuantityStepper.propTypes = {
  value: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
  min: PropTypes.number,
  label: PropTypes.string,
};

const styles = StyleSheet.create({
  frame: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  stepperBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  input: {
    minWidth: 34,
    textAlign: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
});
