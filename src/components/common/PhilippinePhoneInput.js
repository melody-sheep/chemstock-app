// src/components/common/PhilippinePhoneInput.js
import React, { useState } from 'react';
import { View, Text, TextInput, Platform, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const NATIONAL_NUMBER_LENGTH = 10;

// "9171234567" -> "917 123 4567" — grouped for readability while typing,
// same idea as a credit-card input, never changes what's actually stored.
function formatNationalNumber(digits) {
  const d = (digits || '').slice(0, NATIONAL_NUMBER_LENGTH);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 10)].filter(Boolean).join(' ');
}

/**
 * A Philippine mobile number is always +63 followed by a 10-digit national
 * number starting with 9 (the local "09XXXXXXXXX" format minus its leading
 * 0). `value`/`onChangeText` here only ever deal with that bare 10-digit
 * national number — the +63 prefix is fixed UI chrome, never part of the
 * editable text, so a caller just does `'+63' + value` to get the full
 * E.164 number for storage.
 */
export default function PhilippinePhoneInput({
  value = '',
  onChangeText,
  label = 'Phone Number',
  required = false,
  error = null,
  style = null,
}) {
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = (text) => {
    // The +63 prefix already replaces the local format's leading 0 (as in
    // "0917 123 4567"), so a typed/pasted leading 0 is dropped immediately
    // rather than eating into the 10 real digits or being treated as part
    // of the number.
    const digitsOnly = text.replace(/\D/g, '').replace(/^0+/, '').slice(0, NATIONAL_NUMBER_LENGTH);
    onChangeText(digitsOnly);
  };

  const errorMessage = typeof error === 'string' ? error : error?.message || null;
  const remaining = NATIONAL_NUMBER_LENGTH - (value || '').length;

  return (
    <View style={styles.container}>
      {!!label && (
        <View style={styles.labelContainer}>
          <Text style={styles.labelText}>
            {label}
            {required && <Text style={styles.requiredAsterisk}> *</Text>}
          </Text>
        </View>
      )}

      <View
        style={[
          styles.inputWrapper,
          errorMessage ? styles.inputError : null,
          isFocused && styles.inputFocused,
          style,
        ]}
      >
        <View style={styles.prefixWrap}>
          <Text style={styles.prefixText}>🇵🇭 +63</Text>
        </View>
        <View style={styles.divider} />
        <TextInput
          style={styles.input}
          placeholder="917 123 4567"
          placeholderTextColor="#94a3b8"
          value={formatNationalNumber(value)}
          onChangeText={handleChange}
          keyboardType="number-pad"
          maxLength={12}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          accessibilityLabel={label}
        />
        <Text style={[styles.counterText, remaining === 0 && styles.counterTextDone]}>
          {(value || '').length}/{NATIONAL_NUMBER_LENGTH}
        </Text>
      </View>

      {!!errorMessage && (
        <View style={styles.errorRow}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}
    </View>
  );
}

/** "9171234567" (exactly 10 digits, starts with 9) — the only shape a real PH mobile number can take. */
export function isValidPhNationalNumber(digits) {
  return /^9\d{9}$/.test(digits || '');
}

/** Bare 10-digit national number -> full +63 E.164 string for storage/display elsewhere. */
export function toPhE164(digits) {
  return `+63${digits || ''}`;
}

/**
 * Whatever is already stored for a phone number -> the bare 10-digit
 * national number this input edits. Tolerates every shape this app has
 * ever stored: proper "+639171234567", a stray local "09171234567" from
 * before this component existed, or already-bare "9171234567" — strips a
 * leading 63 (country code) or 0 (local trunk prefix) if present, then
 * takes the last 10 digits as a last-resort fallback for anything odd.
 */
export function fromPhE164(phoneNumber) {
  const digits = (phoneNumber || '').replace(/\D/g, '');
  return digits.replace(/^63/, '').replace(/^0+/, '').slice(-NATIONAL_NUMBER_LENGTH);
}

/**
 * Any stored phone value (same tolerant shapes as fromPhE164, bare digits
 * included) -> "+63 917 123 4567" for read-only display.
 */
export function formatPhDisplay(phoneNumber) {
  const national = formatNationalNumber(fromPhE164(phoneNumber));
  return national ? `+63 ${national}` : '';
}

PhilippinePhoneInput.propTypes = {
  value: PropTypes.string,
  onChangeText: PropTypes.func.isRequired,
  label: PropTypes.string,
  required: PropTypes.bool,
  error: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
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
    backgroundColor: 'rgba(255,255,255,0.72)',
    height: 44,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    borderWidth: 1,
  },
  inputError: {
    borderColor: COLORS.error,
    borderWidth: 1,
  },
  prefixWrap: {
    paddingLeft: SPACING.md,
    paddingRight: SPACING.sm,
    justifyContent: 'center',
  },
  prefixText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textPrimary,
  },
  divider: {
    width: 1,
    height: 22,
    backgroundColor: '#E0E0E0',
  },
  input: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: '#272632',
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    paddingHorizontal: SPACING.sm,
    textAlignVertical: 'center',
    includeFontPadding: false,
    ...Platform.select({
      web: { outlineStyle: 'none' },
    }),
  },
  counterText: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: '#94a3b8',
    paddingRight: SPACING.md,
  },
  counterTextDone: {
    color: COLORS.success,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
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
