// src/components/common/PasswordStrengthHint.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

export const MIN_AGENT_PASSWORD_LENGTH = 6;

// Advisory only: the screen's own validation decides what is accepted. Shorter than the
// minimum is "Too short"; beyond that the label follows length and variety.
export function passwordStrength(password) {
  if (!password) return null;
  if (password.length < MIN_AGENT_PASSWORD_LENGTH) {
    return { level: 0, label: 'Too short', color: COLORS.error, hint: `Use at least ${MIN_AGENT_PASSWORD_LENGTH} characters.` };
  }
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (score <= 1) return { level: 1, label: 'Weak', color: COLORS.error, hint: 'Add more characters, numbers or symbols.' };
  if (score <= 3) return { level: 2, label: 'Fair', color: '#D98200', hint: 'Add a number, symbol or capital letter to make it stronger.' };
  return { level: 3, label: 'Strong', color: COLORS.success, hint: 'Good password.' };
}

export default function PasswordStrengthHint({ password }) {
  const strength = passwordStrength(password);
  if (!strength) {
    return <Text style={styles.idleHint}>At least {MIN_AGENT_PASSWORD_LENGTH} characters.</Text>;
  }
  return (
    <View style={styles.wrap}>
      <View style={styles.bars}>
        {[1, 2, 3].map((n) => (
          <View key={n} style={[styles.bar, { backgroundColor: strength.level >= n ? strength.color : '#E3E6EC' }]} />
        ))}
        <Text style={[styles.label, { color: strength.color }]}>{strength.label}</Text>
      </View>
      <Text style={styles.hint}>{strength.hint}</Text>
    </View>
  );
}

PasswordStrengthHint.propTypes = { password: PropTypes.string };

const styles = StyleSheet.create({
  wrap: { marginTop: -SPACING.xs, marginBottom: SPACING.sm, gap: 4 },
  bars: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bar: { flex: 1, height: 5, borderRadius: 3, maxWidth: 56 },
  label: { marginLeft: 4, fontSize: TYPOGRAPHY.fontSize.sm, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  hint: { fontSize: TYPOGRAPHY.fontSize.xs, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.regular },
  idleHint: { marginTop: -SPACING.xs, marginBottom: SPACING.sm, fontSize: TYPOGRAPHY.fontSize.xs, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.regular },
});
