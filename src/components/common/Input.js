// src/components/common/Input.js
import React, { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import PropTypes from 'prop-types';
import { User, Lock, Eye, EyeSlash } from 'phosphor-react-native';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * Reusable Input Component with icon support
 * Supports username/user icon, password/lock icon, and password visibility toggle
 * 
 * @param {Object} props - Component props
 * @param {string} props.placeholder - Input placeholder text
 * @param {string} props.value - Current input value
 * @param {Function} props.onChangeText - Callback when text changes
 * @param {boolean} props.secureTextEntry - Masks input for passwords
 * @param {'user'|'lock'|null} props.icon - Icon type to display
 * @param {string} props.keyboardType - Keyboard type (default, email, numeric, etc.)
 * @param {string} props.autoCapitalize - Auto-capitalization behavior
 * @param {string} props.returnKeyType - Return key label (next, done, go, etc.)
 * @param {Function} props.onSubmitEditing - Callback when return key pressed
 * @param {boolean} props.blurOnSubmit - Blur input on submit
 * @param {string|null} props.error - Error message to display
 * @param {Object} props.inputRef - Ref for focusing input
 */
export default function Input({
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  icon = null,
  keyboardType = 'default',
  autoCapitalize = 'none',
  returnKeyType = 'next',
  onSubmitEditing = null,
  blurOnSubmit = false,
  error = null,
  inputRef = null,
}) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const renderIcon = () => {
    try {
      if (icon === 'user') {
        return <User size={20} color="#757575" weight="regular" />;
      }
      if (icon === 'lock') {
        return <Lock size={20} color="#757575" weight="regular" />;
      }
      return null;
    } catch (error) {
      console.error('Error rendering icon in Input:', error);
      return null;
    }
  };

  const isPassword = secureTextEntry;
  const showPasswordToggle = isPassword;
  const inputSecureText = isPassword && !isPasswordVisible;

  const handlePasswordToggle = () => {
    try {
      setIsPasswordVisible(!isPasswordVisible);
    } catch (error) {
      console.error('Error toggling password visibility:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.inputWrapper, error ? styles.inputError : null]}>
        {icon && <View style={styles.iconLeft}>{renderIcon()}</View>}
        
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            icon ? styles.inputWithIcon : null,
            showPasswordToggle ? styles.inputWithRightIcon : null,
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
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

// PropTypes for type checking
Input.propTypes = {
  placeholder: PropTypes.string,
  value: PropTypes.string,
  onChangeText: PropTypes.func,
  secureTextEntry: PropTypes.bool,
  icon: PropTypes.oneOf(['user', 'lock', null]),
  keyboardType: PropTypes.string,
  autoCapitalize: PropTypes.string,
  returnKeyType: PropTypes.string,
  onSubmitEditing: PropTypes.func,
  blurOnSubmit: PropTypes.bool,
  error: PropTypes.string,
  inputRef: PropTypes.object,
};

// Default props
Input.defaultProps = {
  placeholder: '',
  value: '',
  secureTextEntry: false,
  icon: null,
  keyboardType: 'default',
  autoCapitalize: 'none',
  returnKeyType: 'next',
  onSubmitEditing: null,
  blurOnSubmit: false,
  error: null,
  inputRef: null,
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
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
  errorText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.error,
    marginTop: 4,
    marginLeft: SPACING.xs,
  },
});