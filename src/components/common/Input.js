// src/components/common/Input.js
import React, { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { User, Lock, Eye, EyeSlash } from 'phosphor-react-native';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

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
  inputRef = null, // Pass ref as prop instead of forwardRef
}) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const renderIcon = () => {
    if (icon === 'user') {
      return <User size={20} color="#757575" weight="regular" />;
    }
    if (icon === 'lock') {
      return <Lock size={20} color="#757575" weight="regular" />;
    }
    return null;
  };

  const isPassword = secureTextEntry;
  const showPasswordToggle = isPassword;
  const inputSecureText = isPassword && !isPasswordVisible;

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
        />
        
        {showPasswordToggle && (
          <TouchableOpacity
            style={styles.iconRight}
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
          >
            {isPasswordVisible ? (
              <Eye size={20} color="#757575" weight="regular" />
            ) : (
              <EyeSlash size={20} color="#757575" weight="regular" />
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
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
});