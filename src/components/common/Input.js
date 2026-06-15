// src/components/common/Input.js
import React, { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Text,
} from 'react-native';
import PropTypes from 'prop-types';
import { User, Lock, Eye, EyeSlash, Key } from 'phosphor-react-native';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * Reusable Input Component with icon support
 * Supports username/user icon, password/lock icon, key icon, eye/eyeSlash, and password visibility toggle
 * 
 * @param {Object} props - Component props
 * @param {string} props.placeholder - Input placeholder text
 * @param {string} props.value - Current input value
 * @param {Function} props.onChangeText - Callback when text changes
 * @param {boolean} props.secureTextEntry - Masks input for passwords
 * @param {'user'|'lock'|'key'|'eye'|'eyeSlash'|null} props.icon - Icon type to display on left
 * @param {React.ReactNode} props.rightIcon - Custom right icon component
 * @param {Function} props.onRightIconPress - Callback when right icon is pressed
 * @param {string} props.keyboardType - Keyboard type (default, email, numeric, etc.)
 * @param {string} props.autoCapitalize - Auto-capitalization behavior
 * @param {string} props.returnKeyType - Return key label (next, done, go, etc.)
 * @param {Function} props.onSubmitEditing - Callback when return key pressed
 * @param {boolean} props.blurOnSubmit - Blur input on submit
 * @param {string|null} props.error - Error message to display
 * @param {Object} props.inputRef - Ref for focusing input
 * @param {string} props.label - Optional label text to display above input
 * @param {boolean} props.required - Whether field is required (shows red asterisk)
 * @param {Function} props.onTogglePasswordVisibility - Callback when password visibility toggled
 */
export default function Input({
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  icon = null,
  rightIcon = null,
  onRightIconPress = null,
  keyboardType = 'default',
  autoCapitalize = 'none',
  returnKeyType = 'next',
  onSubmitEditing = null,
  blurOnSubmit = false,
  error = null,
  inputRef = null,
  label = null,
  required = false,
  onTogglePasswordVisibility = null,
}) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const isPassword = secureTextEntry;
  const showPasswordToggle = isPassword && !rightIcon;
  const inputSecureText = isPassword && !isPasswordVisible;

  const renderIcon = () => {
    try {
      if (icon === 'user') {
        return <User size={20} color="#757575" weight="regular" />;
      }
      if (icon === 'lock') {
        return <Lock size={20} color="#757575" weight="regular" />;
      }
      if (icon === 'key') {
        return <Key size={20} color="#757575" weight="regular" />;
      }
      if (icon === 'eye') {
        return <Eye size={20} color="#757575" weight="regular" />;
      }
      if (icon === 'eyeSlash') {
        return <EyeSlash size={20} color="#757575" weight="regular" />;
      }
      return null;
    } catch (error) {
      console.error('Error rendering icon in Input:', error);
      return null;
    }
  };

  const handlePasswordToggle = () => {
    try {
      setIsPasswordVisible(!isPasswordVisible);
      if (onTogglePasswordVisibility) {
        onTogglePasswordVisibility(!isPasswordVisible);
      }
    } catch (error) {
      console.error('Error toggling password visibility:', error);
    }
  };

  const handleRightIconPress = () => {
    try {
      if (onRightIconPress) {
        onRightIconPress();
      }
    } catch (error) {
      console.error('Error pressing right icon:', error);
    }
  };

  return (
    <View style={styles.container}>
      {label && (
        <View style={styles.labelContainer}>
          <Text style={styles.labelText}>{label}</Text>
          {required && <Text style={styles.requiredAsterisk}> *</Text>}
        </View>
      )}
      <View style={[styles.inputWrapper, error ? styles.inputError : null]}>
        {icon && <View style={styles.iconLeft}>{renderIcon()}</View>}
        
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            icon ? styles.inputWithIcon : null,
            (showPasswordToggle || rightIcon) ? styles.inputWithRightIcon : null,
          ]}
          placeholder={placeholder}
          placeholderTextColor="#757575"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={inputSecureText}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={blurOnSubmit}
          accessibilityLabel={placeholder}
          accessibilityHint={`Enter your ${placeholder?.toLowerCase() || 'text'}`}
        />
        
        {showPasswordToggle && (
          <TouchableOpacity
            style={styles.iconRight}
            onPress={handlePasswordToggle}
            accessibilityLabel={isPasswordVisible ? "Hide password" : "Show password"}
            accessibilityRole="button"
          >
            {isPasswordVisible ? (
              <Eye size={20} color="#757575" weight="regular" />
            ) : (
              <EyeSlash size={20} color="#757575" weight="regular" />
            )}
          </TouchableOpacity>
        )}

        {rightIcon && (
          <TouchableOpacity
            style={styles.iconRight}
            onPress={handleRightIconPress}
            accessibilityLabel="Submit"
            accessibilityRole="button"
          >
            {rightIcon}
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <View style={styles.errorRow}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

// PropTypes for type checking
Input.propTypes = {
  placeholder: PropTypes.string,
  value: PropTypes.string,
  onChangeText: PropTypes.func,
  secureTextEntry: PropTypes.bool,
  icon: PropTypes.oneOf(['user', 'lock', 'key', 'eye', 'eyeSlash', null]),
  rightIcon: PropTypes.node,
  onRightIconPress: PropTypes.func,
  keyboardType: PropTypes.string,
  autoCapitalize: PropTypes.string,
  returnKeyType: PropTypes.string,
  onSubmitEditing: PropTypes.func,
  blurOnSubmit: PropTypes.bool,
  error: PropTypes.string,
  inputRef: PropTypes.object,
  label: PropTypes.string,
  required: PropTypes.bool,
  onTogglePasswordVisibility: PropTypes.func,
};

// Default props
Input.defaultProps = {
  placeholder: '',
  value: '',
  secureTextEntry: false,
  icon: null,
  rightIcon: null,
  onRightIconPress: null,
  keyboardType: 'default',
  autoCapitalize: 'none',
  returnKeyType: 'next',
  onSubmitEditing: null,
  blurOnSubmit: false,
  error: null,
  inputRef: null,
  label: null,
  required: false,
  onTogglePasswordVisibility: null,
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  labelContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  labelText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textPrimary,
  },
  requiredAsterisk: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.error,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#757575',
    borderRadius: 12,
    backgroundColor: '#F7FEFF',
    height: 44,
  },
  input: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: '#757575',
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    paddingHorizontal: SPACING.md,
  },
  inputWithIcon: {
    paddingLeft: SPACING.xs,
  },
  inputWithRightIcon: {
    paddingRight: 0,
  },
  iconLeft: {
    paddingLeft: SPACING.md,
    paddingRight: SPACING.xs,
  },
  iconRight: {
    paddingRight: SPACING.md,
    paddingLeft: SPACING.sm,
  },
  inputError: {
    borderColor: COLORS.error,
    borderWidth: 1,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginLeft: SPACING.xs,
  },
  errorText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.error,
  },
});