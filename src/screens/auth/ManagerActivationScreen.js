// src/screens/auth/ManagerActivationScreen.js
import React, { useRef, useState } from 'react';
import { View, StyleSheet, Text, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import Header from '../../components/common/Header';
import Icon from '../../components/common/Icon';
import Input from '../../components/common/Input';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

export default function ManagerActivationScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  
  // Local state
  const [activationInput, setActivationInput] = useState('');
  const [localError, setLocalError] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [codeValidated, setCodeValidated] = useState(false);
  const [branchInfo, setBranchInfo] = useState(null);
  
  const activationInputRef = useRef(null);
  
  // Import activation service directly
  const activationService = require('../../services/activationService').default;

  const handleValidateCode = async () => {
    // ✅ DEBUG: Log what's being passed
    console.log('🔍 [UI] Raw activationInput:', activationInput);
    console.log('🔍 [UI] activationInput type:', typeof activationInput);
    console.log('🔍 [UI] activationInput length:', activationInput?.length);
    
    if (!activationInput || !activationInput.trim()) {
      setLocalError('Please enter an activation code');
      return;
    }
    
    // Accept any string with minimum 4 characters
    const trimmedKey = activationInput.trim();
    console.log('🔍 [UI] trimmedKey:', trimmedKey);
    console.log('🔍 [UI] trimmedKey length:', trimmedKey.length);
    
    if (trimmedKey.length < 4) {
      setLocalError('Activation code must be at least 4 characters');
      return;
    }
    
    console.log('🔍 [UI] ✅ Validating code:', trimmedKey);
    setIsValidating(true);
    setLocalError('');
    
    try {
      console.log('🔍 [UI] Calling activationService.validateKey with:', trimmedKey);
      const result = await activationService.validateKey(trimmedKey);
      console.log('🔍 [UI] Validation result:', result);
      
      if (result.success && result.data) {
        // Store MULTIPLE branches (array)
        const branchNames = result.data.branchNames || [];
        const branchLocations = result.data.branchLocations || [];
        
        setBranchInfo({
          names: branchNames,
          locations: branchLocations,
          managerName: result.data.managerName,
          managerEmail: result.data.managerEmail
        });
        
        setCodeValidated(true);
        setLocalError('');
        
        // Build branch list for alert
        const branchList = branchNames.map((name, i) => 
          `  ${i + 1}. ${name}${branchLocations[i] ? ` (${branchLocations[i]})` : ''}`
        ).join('\n');
        
        // Show success message with all branches
        Alert.alert(
          '✅ Code Validated!',
          `Activation code is valid!\n\n📋 Branches (${branchNames.length}):\n${branchList}\n\nYou can now continue to account setup.`,
          [{ text: 'OK' }]
        );
      } else {
        setLocalError(result.message || 'Invalid activation code');
        setCodeValidated(false);
        setBranchInfo(null);
      }
    } catch (error) {
      console.error('🔍 [UI] Validation error:', error);
      setLocalError(error.message || 'Failed to validate code');
      setCodeValidated(false);
      setBranchInfo(null);
    } finally {
      setIsValidating(false);
    }
  };

  const handleContinue = () => {
    if (!codeValidated || !branchInfo) {
      setLocalError('Please validate your activation code first');
      return;
    }
    
    const branchList = branchInfo.names.map((name) => `  ✓ ${name}`).join('\n');
    
    Alert.alert(
      '🎉 Success!',
      `Code validated for:\n${branchList}\n\nYou can now create your manager account.`,
      [
        { 
          text: 'OK', 
          onPress: () => {
            // Navigate to dashboard or account creation
            // navigation.navigate('Dashboard');
          }
        }
      ]
    );
  };

  return (
    <>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <SafeAreaView style={styles.safeArea}>
        <Header
          showBackButton={true}
          backButtonText="Back to Login"
          showOnlineStatus={true}
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          onBackPress={() => navigation.goBack()}
        />
        
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Section */}
          <View style={styles.headerSection}>
            <View style={styles.titleRow}>
              <Text style={styles.boldTitle}>Manager Account Setup</Text>
              <Icon name="key" size={24} color={COLORS.primary} />
            </View>
            <Text style={styles.subtitle}>
              Enter the activation key from the developer to register your branch(es).
            </Text>
          </View>

          {/* Input Section */}
          <View style={styles.inputSection}>
            <Input
              label="Activation Code"
              required={true}
              placeholder="Enter activation code"
              icon="key"
              value={activationInput}
              onChangeText={setActivationInput}
              error={localError}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleValidateCode}
              inputRef={activationInputRef}
              rightIcon={
                <Icon name="send" size={20} color={COLORS.primary} />
              }
              onRightIconPress={handleValidateCode}
            />
            
            {isValidating && (
              <Text style={styles.loadingText}>Validating activation code...</Text>
            )}
          </View>

          {/* Jurisdiction Section */}
          <View style={styles.jurisdictionContainer}>
            <View style={styles.jurisdictionHeaderRow}>
              <View style={styles.lockTitleRow}>
                <Text style={styles.jurisdictionTitle}>Location & Branch Lock</Text>
                <Icon name="lock" size={18} color={COLORS.textPrimary} />
              </View>
            </View>

            <Text style={styles.jurisdictionSubtext}>
              Your branch access will be automatically verified based on the activation key
            </Text>

            {/* Display MULTIPLE branches with checkmark */}
            {codeValidated && branchInfo && branchInfo.names.length > 0 && (
              <View style={styles.branchListContainer}>
                <Text style={styles.branchListTitle}>
                  ✓ Access granted for ({branchInfo.names.length} branch{ branchInfo.names.length > 1 ? 'es' : '' }):
                </Text>
                {branchInfo.names.map((name, index) => (
                  <View key={index} style={styles.branchItem}>
                    <Icon name="checkmark" size={18} color={COLORS.success} />
                    <View style={styles.branchInfoContainer}>
                      <Text style={styles.branchNameText}>{name}</Text>
                      {branchInfo.locations && branchInfo.locations[index] && (
                        <Text style={styles.branchLocationText}>
                          {branchInfo.locations[index]}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {localError && !codeValidated ? (
              <View style={styles.errorContainer}>
                <Icon name="warningTriangle" size={18} color={COLORS.error} />
                <Text style={styles.errorText}>{localError}</Text>
              </View>
            ) : null}
          </View>

          {/* Continue Button - Shows after validation */}
          {codeValidated && (
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.continueButton}
                onPress={handleContinue}
              >
                <Text style={styles.continueButtonText}>Continue to Account Setup →</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING.xl,
  },
  headerSection: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    backgroundColor: '#F7FEFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#555353',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  boldTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
    lineHeight: 24,
    flex: 1,
    marginRight: SPACING.md,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  inputSection: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  loadingText: {
    marginTop: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.primary,
    textAlign: 'center',
  },
  jurisdictionContainer: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  jurisdictionHeaderRow: {
    marginBottom: SPACING.xs,
  },
  lockTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  jurisdictionTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textPrimary,
  },
  jurisdictionSubtext: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    lineHeight: 16,
    marginBottom: SPACING.md,
  },
  branchListContainer: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.success + '10',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.success + '30',
  },
  branchListTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.success,
    marginBottom: SPACING.sm,
  },
  branchItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  branchInfoContainer: {
    flex: 1,
  },
  branchNameText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textPrimary,
  },
  branchLocationText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  errorContainer: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.error + '10',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.error + '30',
  },
  errorText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.error,
  },
  buttonContainer: {
    marginTop: SPACING.xl,
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  continueButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textWhite,
  },
});