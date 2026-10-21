// src/screens/manager/AgentAccountsScreen.js
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Alert from '../../utils/appAlert';
import { StatusBar } from 'expo-status-bar';
import { BlurTargetView } from 'expo-blur';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import LiveStatusPill from '../../components/common/LiveStatusPill';
import PasswordStrengthHint, { MIN_AGENT_PASSWORD_LENGTH } from '../../components/common/PasswordStrengthHint';
import BottomActionBar, { useBottomActionBarHeight } from '../../components/common/BottomActionBar';
import Icon from '../../components/common/Icon';
import Input from '../../components/common/Input';
import PhilippinePhoneInput, { isValidPhNationalNumber, toPhE164 } from '../../components/common/PhilippinePhoneInput';
import Button from '../../components/common/Button';
import LogListItem from '../../components/common/LogListItem';
import BranchSelector from '../../components/common/BranchSelector';
import SectionHeader from '../../components/common/SectionHeader';
import authService from '../../services/authService';
import agentService from '../../services/agentService';
import requireOnline from '../../utils/requireOnline';
import profileService from '../../services/profileService';
import requestService from '../../services/requestService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import friendlyError from '../../utils/friendlyError';
import KeyboardAwareScrollView from '../../components/common/KeyboardAwareScrollView';

const ROLE_OPTIONS = [
  { value: 'sales_rep', label: 'Sales Rep' },
  { value: 'collector', label: 'Collector' },
];

export default function AgentAccountsScreen() {
  const bottomActionBarHeight = useBottomActionBarHeight();
  const blurTarget = useRef(null);
  const [manager, setManager] = useState(null);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [phoneError, setPhoneError] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('sales_rep');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdAccounts, setCreatedAccounts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(null);

  useEffect(() => {
    authService.getCurrentUser().then(async (currentManager) => {
      setManager(currentManager);
      const managerBranches = await requestService.getAgentBranches(currentManager?.branchIds || []);
      setBranches(managerBranches);
      // Single-branch managers never see the picker — just assign that one
      // branch automatically. Multi-branch managers must explicitly choose,
      // same pattern as Release Stock's branch picker.
      setSelectedBranchId((prev) => prev || (managerBranches.length === 1 ? managerBranches[0].id : prev));
    });
  }, []);

  const resetForm = () => {
    setFullName('');
    setUsername('');
    setPhoneDigits('');
    setPhoneError(null);
    setPassword('');
    setConfirmPassword('');
    setRole('sales_rep');
  };

  const handlePhoneChange = (digits) => {
    setPhoneDigits(digits);
    if (phoneError) setPhoneError(null);
  };

  const handleCreate = async () => {
    if (!fullName.trim() || !username.trim() || !password) {
      Alert.alert('Missing Info', 'Please fill in all fields.');
      return;
    }
    if (!isValidPhNationalNumber(phoneDigits)) {
      setPhoneError(
        phoneDigits.length === 0
          ? 'Phone number is required'
          : phoneDigits.length < 10
            ? `Enter all 10 digits (${phoneDigits.length}/10 so far)`
            : 'PH mobile numbers start with 9, e.g. 917 123 4567'
      );
      return;
    }
    if (password.length < MIN_AGENT_PASSWORD_LENGTH) {
      Alert.alert('Weak Password', `Password must be at least ${MIN_AGENT_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }
    if (branches.length > 1 && !selectedBranchId) {
      Alert.alert('Missing Info', 'Please select which branch this account belongs to.');
      return;
    }

    if (!requireOnline('Creating an account')) return;
    setIsSubmitting(true);
    const result = await agentService.createAgentAccount({
      username: username.trim(),
      fullName: fullName.trim(),
      password,
      role,
      branchIds: selectedBranchId ? [selectedBranchId] : manager?.branchIds || [],
    });

    if (!result.success) {
      setIsSubmitting(false);
      Alert.alert('Failed', friendlyError(result.message));
      return;
    }

    // Best-effort — the account itself is already created at this point, so
    // a phone-number save failure here shouldn't be reported as account
    // creation failing. The agent can still set it later via Edit Profile.
    const phoneResult = await profileService.updateAgentPhoneNumber({
      agentId: result.data.id,
      phoneNumber: toPhE164(phoneDigits),
    });
    setIsSubmitting(false);
    if (!phoneResult.success) {
      console.error('[ERROR] [AgentAccountsScreen] Failed to save phone number for new agent:', phoneResult.message);
    }

    const roleLabel = role === 'sales_rep' ? 'Sales Rep' : 'Collector';
    setCreatedAccounts((prev) => [
      {
        key: result.data.id,
        icon: role === 'sales_rep' ? 'person' : 'trayDown',
        text: `${result.data.full_name} — ${roleLabel} (${result.data.username})`,
      },
      ...prev,
    ]);
    Alert.alert('Account Created', `${fullName.trim()} can now log in with username "${username.trim()}".`);
    resetForm();
  };

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton
          title="Agent Accounts"
          titleAlign="left"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
        />
        <SecondaryHeader height={76}>
          <View style={styles.titleRow}>
            <View style={styles.titleTextCol}>
              <Text style={styles.pageTitle} numberOfLines={1}>Create Agent Account</Text>
              <Text style={styles.pageSubtitle}>Set up a new Sales Rep or Collector</Text>
            </View>
            <LiveStatusPill pillStyle={styles.onlinePill} dotStyle={styles.onlineDot} textStyle={styles.onlineText} />
          </View>
        </SecondaryHeader>
        <BlurTargetView ref={blurTarget} style={styles.contentTarget}>
        <KeyboardAwareScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomActionBarHeight + SPACING.lg }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <SectionHeader icon="idCard" size="md" label="Agent type" style={styles.labelFirst} />
          <View style={styles.roleToggleRow}>
            {ROLE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.roleChip, role === opt.value && styles.roleChipActive]}
                onPress={() => setRole(opt.value)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected: role === opt.value }}
              >
                <Text
                  style={[styles.roleChipText, role === opt.value && styles.roleChipTextActive]}
                  numberOfLines={1}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {branches.length > 1 && (
            <>
              <SectionHeader icon="building" size="md" label="Assign to branch" style={styles.labelSpaced} />
              <View style={styles.branchSection}>
                <BranchSelector
                  branches={branches}
                  selectedId={selectedBranchId}
                  onSelect={setSelectedBranchId}
                  edgePadding={0}
                  scrollable
                  scrollBleed={SPACING.lg}
                />
              </View>
            </>
          )}

          <SectionHeader icon="person" size="md" label="Details" style={styles.labelSpaced} />

          <Input
            label="Full Name"
            required
            placeholder="Enter full name"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
          />
          <Input
            label="Username"
            required
            placeholder="Enter username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
          <PhilippinePhoneInput
            label="Phone Number"
            required
            value={phoneDigits}
            onChangeText={handlePhoneChange}
            error={phoneError}
          />
          <Input
            label="Password"
            required
            placeholder="Create a password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
          />
          <PasswordStrengthHint password={password} />
          <Input
            label="Confirm Password"
            required
            placeholder="Confirm password"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            autoCapitalize="none"
          />

          <View style={styles.noticeBox}>
            <View style={styles.noticeIconWrap}>
              <Icon name="lock" size={16} color="#B26400" weight="fill" />
            </View>
            <Text style={styles.noticeText}>
              <Text style={styles.noticeTextBold}>Recommended: </Text>
              have the agent change this password themselves after their first login, from
              Settings → Change Password.
            </Text>
          </View>

          {createdAccounts.length > 0 && (
            <>
              <SectionHeader icon="checkCircle" label="Created This Session" style={styles.createdHeader} />
              <View style={styles.createdList}>
                {createdAccounts.map((item) => (
                  <LogListItem key={item.key} icon={item.icon} iconColor={COLORS.primary} text={item.text} />
                ))}
              </View>
            </>
          )}
        </KeyboardAwareScrollView>
        </BlurTargetView>

        <BottomActionBar variant="glass" blurTarget={blurTarget}>
          <Button
            title={isSubmitting ? 'Creating...' : 'Create Account'}
            onPress={handleCreate}
            disabled={isSubmitting || (branches.length > 1 && !selectedBranchId)}
            height={48}
            fontSize={16}
            borderRadius={24}
          />
        </BottomActionBar>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  contentTarget: { flex: 1 },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
  },
  titleTextCol: { flexShrink: 1, flex: 1 },
  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' },
  onlineText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.success,
  },
  labelFirst: { marginTop: SPACING.sm, marginBottom: 0 },
  labelSpaced: { marginTop: SPACING.lg, marginBottom: 0 },
  pageTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  pageSubtitle: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  createdHeader: { marginTop: SPACING.xl },
  branchSection: { marginTop: SPACING.sm, marginBottom: SPACING.xs },
  roleToggleRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  roleChip: {
    flex: 1,
    height: 44,
    paddingHorizontal: SPACING.sm,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#D5DAE3',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleChipActive: {
    backgroundColor: '#EAF4FF',
    borderColor: '#0085F9',
  },
  roleChipText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
  },
  roleChipTextActive: {
    color: '#0085F9',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFF4E0',
    borderWidth: 1,
    borderColor: '#FFE1A8',
    borderRadius: 12,
    padding: 12,
    marginTop: SPACING.sm,
  },
  noticeIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#FFE8BF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: '#7A4A00',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 3,
  },
  noticeTextBold: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    color: '#7A4A00',
  },
  submitButton: { marginTop: SPACING.md },
  createdList: { gap: SPACING.sm },
});
