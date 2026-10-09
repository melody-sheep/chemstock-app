// src/screens/manager/AgentAccountsScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Header from '../../components/common/Header';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import LogListItem from '../../components/common/LogListItem';
import BranchSelector from '../../components/common/BranchSelector';
import authService from '../../services/authService';
import agentService from '../../services/agentService';
import profileService from '../../services/profileService';
import requestService from '../../services/requestService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const ROLE_OPTIONS = [
  { value: 'sales_rep', label: 'Sales Rep' },
  { value: 'collector', label: 'Collector' },
];

export default function AgentAccountsScreen() {
  const [manager, setManager] = useState(null);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
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
    setPhoneNumber('');
    setPassword('');
    setConfirmPassword('');
    setRole('sales_rep');
  };

  const handleCreate = async () => {
    if (!fullName.trim() || !username.trim() || !phoneNumber.trim() || !password) {
      Alert.alert('Missing Info', 'Please fill in all fields.');
      return;
    }
    if (phoneNumber.trim().length < 7) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid phone number.');
      return;
    }
    if (password.length < 4) {
      Alert.alert('Weak Password', 'Password must be at least 4 characters.');
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
      Alert.alert('Failed', result.message);
      return;
    }

    // Best-effort — the account itself is already created at this point, so
    // a phone-number save failure here shouldn't be reported as account
    // creation failing. The agent can still set it later via Edit Profile.
    const phoneResult = await profileService.updateAgentPhoneNumber({
      agentId: result.data.id,
      phoneNumber: phoneNumber.trim(),
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
          showBackButton={true}
          backButtonText="Back"
          title="Agent Accounts"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
        />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionTitle}>Create Agent Account</Text>

          <View style={styles.roleToggleRow}>
            {ROLE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.roleChip, role === opt.value && styles.roleChipActive]}
                onPress={() => setRole(opt.value)}
                activeOpacity={0.7}
              >
                <Text style={[styles.roleChipText, role === opt.value && styles.roleChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {branches.length > 1 && (
            <View style={styles.branchSection}>
              <Text style={styles.sectionLabel}>Assign to which branch?</Text>
              <BranchSelector
                branches={branches}
                selectedId={selectedBranchId}
                onSelect={setSelectedBranchId}
                edgePadding={0}
              />
            </View>
          )}

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
          <Input
            label="Phone Number"
            required
            placeholder="Enter phone number"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
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
          <Input
            label="Confirm Password"
            required
            placeholder="Confirm password"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            autoCapitalize="none"
          />

          <Button
            title={isSubmitting ? 'Creating...' : 'Create Account'}
            onPress={handleCreate}
            disabled={isSubmitting || (branches.length > 1 && !selectedBranchId)}
            style={styles.submitButton}
          />

          {createdAccounts.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, styles.createdTitle]}>Created This Session</Text>
              <View style={styles.createdList}>
                {createdAccounts.map((item) => (
                  <LogListItem key={item.key} icon={item.icon} iconColor={COLORS.primary} text={item.text} />
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 48 },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  createdTitle: { marginTop: SPACING.xl },
  branchSection: { marginBottom: SPACING.md },
  sectionLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  roleToggleRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  roleChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  roleChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  roleChipText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textPrimary,
  },
  roleChipTextActive: { color: '#FFFFFF' },
  submitButton: { marginTop: SPACING.sm },
  createdList: { gap: SPACING.sm },
});
