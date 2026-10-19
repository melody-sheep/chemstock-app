// src/screens/common/ChangePasswordScreen.js
// Shared across all three roles (same precedent as EditProfileScreen),
// reached only from each role's own Settings "Change Password" row.
// Managers are real Supabase Auth users (profileService.changeManagerPassword
// re-authenticates with the current password, then updateUser()); agents
// (sales_rep/collector) have no Supabase session, so
// profileService.changeAgentPassword goes through the change_agent_password
// RPC instead, which verifies the current password server-side.
import React, { useState } from 'react';
import { View, Text, Pressable, Alert, StyleSheet } from 'react-native';
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
import { SHADOWS } from '../../styles/shadows';
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

const REQUIREMENTS = [
  'At least 8 characters long',
  'Contains at least one letter and one number',
  'Includes at least one special character (e.g. ! @ # $ %)',
  'Different from your current password',
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
          <View style={styles.heroCard}>
            <View style={styles.iconWrap}>
              <Icon name="lock" size={24} color={COLORS.primary} weight="fill" />
            </View>
            <Text style={styles.heroTitle}>Update Your Password</Text>
            <Text style={styles.heroSubtitle}>
              Choose a strong password you don't use anywhere else.
            </Text>
          </View>

          <Text style={styles.sectionLabel}>Current Password</Text>
          <View style={styles.groupCard}>
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

          <Text style={styles.sectionLabel}>New Password</Text>
          <View style={styles.groupCard}>
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

          <View style={styles.requirementsCard}>
            <Text style={styles.requirementsTitle}>Password Requirements</Text>
            {REQUIREMENTS.map((req) => (
              <View key={req} style={styles.requirementRow}>
                <Icon name="checkCircle" size={14} color={COLORS.success} />
                <Text style={styles.requirementText}>{req}</Text>
              </View>
            ))}
          </View>

          <Button
            title="Update Password"
            variant="black"
            onPress={handleUpdatePassword}
            loading={isSubmitting}
            disabled={isSubmitting}
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
  heroCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 16,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
    ...SHADOWS.cardSoft,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  heroTitle: {
    fontSize: 16,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: '#94a3b8',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 13,
    color: '#94a3b8',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  groupCard: {
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    marginBottom: SPACING.md,
    padding: 12,
    ...SHADOWS.cardSoft,
  },
  requirementsCard: {
    backgroundColor: '#F7F9FC',
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: SPACING.lg,
  },
  requirementsTitle: {
    fontSize: 12,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    marginBottom: 2,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requirementText: {
    fontSize: 12,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
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
