// src/screens/common/ChangePasswordScreen.js
// Shared across all three roles (same precedent as EditProfileScreen),
// reached only from each role's own Settings "Change Password" row.
// Managers are real Supabase Auth users (profileService.changeManagerPassword
// re-authenticates with the current password, then updateUser()); agents
// (sales_rep/collector) have no Supabase session, so
// profileService.changeAgentPassword goes through the change_agent_password
// RPC instead, which verifies the current password server-side.
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Alert from '../../utils/appAlert';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import Header from '../../components/common/Header';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import authService from '../../services/authService';
import profileService from '../../services/profileService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import friendlyError from '../../utils/friendlyError';
import requireOnline from '../../utils/requireOnline';
import KeyboardAwareScrollView from '../../components/common/KeyboardAwareScrollView';

// Mirrors ManagerActivationScreen's handleCompleteSetup password rule
// exactly — this screen is shared by every role, so changing a password
// now requires the same strength account creation already requires of a
// manager, rather than the weaker "4+ chars" an agent account is created
// with (AgentAccountsScreen.js).
const MIN_PASSWORD_LENGTH = 8;
const SPECIAL_CHAR_PATTERN = /[!@#$%^&*(),.?":{}|<>_]/;

// Shown as a live checklist. These are the same rules the submit already enforces.
const REQUIREMENTS = [
  { label: 'At least 8 characters long', test: (pw) => pw.length >= MIN_PASSWORD_LENGTH },
  { label: 'At least one letter and one number', test: (pw) => /[A-Za-z]/.test(pw) && /[0-9]/.test(pw) },
  { label: 'One special character (! @ # $ %)', test: (pw) => SPECIAL_CHAR_PATTERN.test(pw) },
  { label: 'Different from your current one', test: (pw, current) => pw.length > 0 && pw !== current },
];

export default function ChangePasswordScreen() {
  const navigation = useNavigation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPasswordError, setCurrentPasswordError] = useState(null);
  const [newPasswordError, setNewPasswordError] = useState(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleBack = () => navigation.goBack();

  // Display only: how many of the rules the new password already meets.
  const metCount = REQUIREMENTS.filter((req) => req.test(newPassword, currentPassword)).length;
  const strength =
    newPassword.length === 0
      ? null
      : metCount <= 1
      ? { label: 'Weak', color: COLORS.error, filled: 1 }
      : metCount <= 3
      ? { label: 'Almost there', color: '#D98200', filled: 2 }
      : { label: 'Strong', color: COLORS.success, filled: 3 };
  const showMatch = confirmPassword.length > 0 && newPassword.length > 0;
  const passwordsMatch = confirmPassword === newPassword;

  const handleUpdatePassword = async () => {
    if (isSubmitting) return;

    setCurrentPasswordError(null);
    setNewPasswordError(null);
    setConfirmPasswordError(null);

    let hasError = false;
    if (!currentPassword) {
      setCurrentPasswordError('Enter your current password');
      hasError = true;
    }
    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
      setNewPasswordError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      hasError = true;
    } else if (!/[A-Z]/.test(newPassword) && !/[a-z]/.test(newPassword)) {
      setNewPasswordError('Password must contain at least one letter');
      hasError = true;
    } else if (!/[0-9]/.test(newPassword)) {
      setNewPasswordError('Password must contain at least one number');
      hasError = true;
    } else if (!SPECIAL_CHAR_PATTERN.test(newPassword)) {
      setNewPasswordError('Password must contain at least one special character');
      hasError = true;
    } else if (newPassword === currentPassword) {
      setNewPasswordError('New password must be different from your current password');
      hasError = true;
    }
    if (!hasError && confirmPassword !== newPassword) {
      setConfirmPasswordError('Passwords do not match');
      hasError = true;
    }
    if (hasError) return;
    if (!requireOnline('Changing your password')) return;

    setIsSubmitting(true);
    try {
      const user = await authService.getCurrentUser();
      if (!user?.id) {
        Alert.alert('Update Failed', 'Could not determine your account. Please log in again.');
        return;
      }

      const result =
        user.role === 'manager'
          ? await profileService.changeManagerPassword({
              email: user.email,
              currentPassword,
              newPassword,
            })
          : await profileService.changeAgentPassword({
              agentId: user.id,
              currentPassword,
              newPassword,
            });

      if (!result.success) {
        if (result.message === 'Current password is incorrect') {
          setCurrentPasswordError(result.message);
        } else {
          Alert.alert('Update Failed', friendlyError(result.message) || 'Could not change your password.');
        }
        return;
      }

      Alert.alert('Password Updated', 'Your password has been changed successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Update Failed', friendlyError(error.message) || 'Could not change your password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton
          title="Change Password"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
        />

        <KeyboardAwareScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.iconWrap}>
              <Icon name="lock" size={22} color="#D98200" weight="fill" />
            </View>
            <View style={styles.heroTextCol}>
              <Text style={styles.heroTitle}>Update your password</Text>
              <Text style={styles.heroSubtitle}>Choose a strong password you don't use anywhere else.</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Current password</Text>
          <View style={styles.fieldGroup}>
            <Input
              placeholder="Enter current password"
              value={currentPassword}
              onChangeText={(text) => {
                setCurrentPassword(text);
                if (currentPasswordError) setCurrentPasswordError(null);
              }}
              secureTextEntry
              icon="lock"
              error={currentPasswordError}
            />
          </View>

          <Text style={styles.sectionLabel}>New password</Text>
          <View style={styles.fieldGroup}>
            <Input
              placeholder="Enter new password"
              value={newPassword}
              onChangeText={(text) => {
                setNewPassword(text);
                if (newPasswordError) setNewPasswordError(null);
              }}
              secureTextEntry
              icon="key"
              error={newPasswordError}
            />
            <Input
              placeholder="Confirm new password"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (confirmPasswordError) setConfirmPasswordError(null);
              }}
              secureTextEntry
              icon="key"
              error={confirmPasswordError}
            />
          </View>

          {showMatch && (
            <View style={styles.matchRow}>
              <Icon name={passwordsMatch ? 'checkCircle' : 'xCircle'} size={16} color={passwordsMatch ? COLORS.success : COLORS.error} weight="fill" />
              <Text style={[styles.matchText, { color: passwordsMatch ? '#1E7A3A' : COLORS.error }]}>
                {passwordsMatch ? 'Passwords match' : 'Passwords do not match yet'}
              </Text>
            </View>
          )}

          <View style={styles.strengthRow}>
            {[1, 2, 3].map((n) => (
              <View
                key={n}
                style={[styles.strengthBar, { backgroundColor: strength && strength.filled >= n ? strength.color : '#E3E6EC' }]}
              />
            ))}
            <Text style={[styles.strengthLabel, { color: strength ? strength.color : '#9AA3B2' }]}>
              {strength ? strength.label : 'Strength'}
            </Text>
          </View>

          <View style={styles.requirements}>
            {REQUIREMENTS.map((req) => {
              const met = req.test(newPassword, currentPassword);
              return (
                <View key={req.label} style={styles.requirementRow}>
                  <Icon name="checkCircle" size={16} color={met ? COLORS.success : '#C5CBD6'} weight={met ? 'fill' : 'regular'} />
                  <Text style={[styles.requirementText, met && styles.requirementTextMet]}>{req.label}</Text>
                </View>
              );
            })}
          </View>

          <Button
            title="Update Password"
            variant="black"
            onPress={handleUpdatePassword}
            loading={isSubmitting}
            disabled={isSubmitting}
            height={48}
            fontSize={16}
            borderRadius={24}
            style={styles.submitButton}
          />

          <Pressable style={styles.cancelButton} onPress={handleBack} disabled={isSubmitting}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>

          <View style={{ height: 24 }} />
        </KeyboardAwareScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#D982001A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextCol: { flex: 1 },
  heroTitle: {
    fontSize: 17,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  heroSubtitle: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    color: '#6B7280',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  sectionLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
    marginTop: SPACING.md,
  },
  fieldGroup: { marginBottom: -SPACING.xs },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.sm },
  matchText: { fontSize: 13, fontFamily: TYPOGRAPHY.fontFamily.medium },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.md },
  strengthBar: { flex: 1, height: 5, borderRadius: 3, maxWidth: 70 },
  strengthLabel: { marginLeft: 4, fontSize: 13, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  requirements: {
    gap: 8,
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requirementText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  requirementTextMet: {
    color: '#1E7A3A',
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  submitButton: {
    width: '100%',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  cancelText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
  },
});
