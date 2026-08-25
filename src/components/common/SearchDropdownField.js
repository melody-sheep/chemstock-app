// src/components/common/SearchDropdownField.js
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import Input from './Input';
import Icon from './Icon';
import { COLORS } from '../../constants/colors';

/**
 * SearchDropdownField - a search Input fused edge-to-edge with a solid
 * trailing icon button, rendered as one seamless rounded frame (same
 * overflow:hidden technique as the "List of Items" card header, rather than
 * hand-matching two separate elements' corner radii). Used by
 * AddNewBatchesScreen (search + browse-all) and ProductBrowserScreen
 * (search + sort) so the two never drift apart in styling again.
 */
export default function SearchDropdownField({
  value,
  onChangeText,
  placeholder = 'Search products',
  onButtonPress,
  buttonIcon = 'caretDown',
  showButtonDot = false,
}) {
  return (
    <View style={styles.frame}>
      <View style={styles.inputWrap}>
        <Input
          icon="search"
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          style={styles.fieldInFrame}
        />
      </View>
      <TouchableOpacity
        style={styles.button}
        onPress={onButtonPress}
        activeOpacity={0.85}
        accessibilityLabel={placeholder}
        accessibilityRole="button"
      >
        <Icon name={buttonIcon} size={18} color="#FFFFFF" weight="bold" />
        {showButtonDot && <View style={styles.buttonDot} />}
      </TouchableOpacity>
    </View>
  );
}

SearchDropdownField.propTypes = {
  value: PropTypes.string.isRequired,
  onChangeText: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  onButtonPress: PropTypes.func.isRequired,
  buttonIcon: PropTypes.string,
  showButtonDot: PropTypes.bool,
};

const styles = StyleSheet.create({
  frame: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#757575',
    overflow: 'hidden',
  },
  inputWrap: {
    flex: 1,
  },
  fieldInFrame: {
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
  },
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  buttonDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
  },
});
