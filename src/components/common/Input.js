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
import { User, Lock, Eye, EyeSlash, Key, MagnifyingGlass } from 'phosphor-react-native';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * Reusable Input Component with icon support
 */
export default function Input({
  placeholder = '',
  value = '',
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
  onFocus = null,
  onBlur = null,
  style = null,
}) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
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
      if (icon === 'search') {
        return <MagnifyingGlass size={20} color="#757575" weight="regular" />;
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

  const handleLeftIconPress = () => {
    try {
      if (inputRef && inputRef.current) {
        inputRef.current.focus();
        console.log('📱 [Input] Left icon tapped - focusing input');
      }
    } catch (error) {
      console.error('Error focusing input from left icon:', error);
    }
  };

  const handleFocus = (e) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  const errorMessage = typeof error === 'string' ? error : error?.message || null;

  return (
    <View style={styles.container}>
      {label && (
        <View style={styles.labelContainer}>
          <Text style={styles.labelText}>
            {label}
            {required && <Text style={styles.requiredAsterisk}> *</Text>}
          </Text>
        </View>
      )}
      
      <View style={[styles.inputWrapper, errorMessage ? styles.inputError : null, isFocused && styles.inputFocused, style]}>
        {icon && (
          <TouchableOpacity
            style={styles.iconLeft}
            onPress={handleLeftIconPress}
            activeOpacity={0.6}
            accessibilityLabel={`Focus ${placeholder}`}
            accessibilityRole="button"
          >
            {renderIcon()}
          </TouchableOpacity>
        )}
        
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            icon ? styles.inputWithIcon : null,
            (showPasswordToggle || rightIcon) ? styles.inputWithRightIcon : null,
            Platform.select({
              web: {
                outlineStyle: 'none',
              },
            }),
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
          onFocus={handleFocus}
          onBlur={handleBlur}
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
      
      {errorMessage && (
        <View style={styles.errorRow}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}
    </View>
  );
}

Input.propTypes = {
  placeholder: PropTypes.string,
  value: PropTypes.string,
  onChangeText: PropTypes.func,
  secureTextEntry: PropTypes.bool,
  icon: PropTypes.oneOf(['user', 'lock', 'key', 'eye', 'eyeSlash', 'search', null]),
  rightIcon: PropTypes.node,
  onRightIconPress: PropTypes.func,
  keyboardType: PropTypes.string,
  autoCapitalize: PropTypes.string,
  returnKeyType: PropTypes.string,
  onSubmitEditing: PropTypes.func,
  blurOnSubmit: PropTypes.bool,
  error: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  inputRef: PropTypes.object,
  label: PropTypes.string,
  required: PropTypes.bool,
  onTogglePasswordVisibility: PropTypes.func,
  onFocus: PropTypes.func,
  onBlur: PropTypes.func,
  style: PropTypes.object,
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
  inputFocused: {
    borderColor: COLORS.primary,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: '#757575',
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    paddingHorizontal: SPACING.md,
    textAlignVertical: 'center',
    includeFontPadding: false,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
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
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconRight: {
    paddingRight: SPACING.md,
    paddingLeft: SPACING.sm,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
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