// src/screens/auth/ManagerActivationScreen.js
import React, { useRef, useState } from 'react';
import { View, StyleSheet, Text, Alert, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import Header from '../../components/common/Header';
import Icon from '../../components/common/Icon';
import Input from '../../components/common/Input';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import activationService from '../../services/activationService';
import { isRLSError } from '../../services/supabaseClient';

export default function ManagerActivationScreen() {
  console.log('========================================');
  console.log('📱 [ManagerActivationScreen] Screen mounted');
  
  const route = useRoute();
  const navigation = useNavigation();
  
  // Local state
  const [activationInput, setActivationInput] = useState('');
  const [localError, setLocalError] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [codeValidated, setCodeValidated] = useState(false);
  const [branchInfo, setBranchInfo] = useState(null);
  
  const activationInputRef = useRef(null);

  const handleValidateCode = async () => {
    console.log('========================================');
    console.log('🔍 [UI] handleValidateCode called');
    console.log('🔍 [UI] Raw activationInput:', activationInput);
    console.log('🔍 [UI] activationInput type:', typeof activationInput);
    console.log('🔍 [UI] activationInput length:', activationInput?.length);
    
    // Reset errors but KEEP codeValidated
    setLocalError('');
    
    // Validate input
    if (!activationInput || !activationInput.trim()) {
      console.log('❌ [UI] Empty activation code');
      setLocalError('Please enter an activation code');
      setCodeValidated(false);
      setBranchInfo(null);
      return;
    }
    
    const trimmedKey = activationInput.trim();
    console.log('🔍 [UI] trimmedKey:', trimmedKey);
    console.log('🔍 [UI] trimmedKey length:', trimmedKey.length);
    
    if (trimmedKey.length < 4) {
      console.log('❌ [UI] Key too short (min 4 chars)');
      setLocalError('Activation code must be at least 4 characters');
      setCodeValidated(false);
      setBranchInfo(null);
      return;
    }
    
    console.log('✅ [UI] Input validation passed');
    console.log('📡 [UI] Calling activationService.validateKey with:', trimmedKey);
    
    setIsValidating(true);
    setLocalError('');
    
    try {
      const result = await activationService.validateKey(trimmedKey);
      
      console.log('📊 [UI] Validation result:', result);
      console.log('📊 [UI] Success:', result.success);
      console.log('📊 [UI] Message:', result.message);
      console.log('📊 [UI] Error code:', result.errorCode);
      
      if (result.success && result.data) {
        const branchNames = result.data.branchNames || [];
        const branchLocations = result.data.branchLocations || [];
        
        // ============================================
        // ✅ ACCESS GRANTED - UI DETAILED LOG
        // ============================================
        console.log('========================================');
        console.log('✅ [UI] ======================================');
        console.log('✅ [UI] ACCESS GRANTED!');
        console.log('✅ [UI] ======================================');
        console.log('👤 [UI] Manager Name:', result.data.managerName);
        console.log('📧 [UI] Manager Email:', result.data.managerEmail);
        console.log('🔑 [UI] Activation Code:', result.data.code);
        console.log('🏢 [UI] Branches Assigned:');
        branchNames.forEach((name, index) => {
          console.log(`   ${index + 1}. ${name} ${branchLocations[index] ? `(${branchLocations[index]})` : ''}`);
        });
        console.log('📊 [UI] Total Branches:', branchNames.length);
        console.log('📅 [UI] Expires At:', result.data.expiresAt);
        console.log('✅ [UI] Status: VALIDATED');
        console.log('✅ [UI] ======================================');
        console.log('========================================');
        
        // Set all states together
        setBranchInfo({
          names: branchNames,
          locations: branchLocations,
          managerName: result.data.managerName,
          managerEmail: result.data.managerEmail,
          activationId: result.data.activationId
        });
        setCodeValidated(true);
        setLocalError('');
        
        console.log('✅ [UI] States updated - codeValidated: true');
        
        // Build branch list for alert
        const branchList = branchNames.map((name, i) => 
          `  ${i + 1}. ${name}${branchLocations[i] ? ` (${branchLocations[i]})` : ''}`
        ).join('\n');
        
        console.log('✅ [UI] Showing success alert');
        
        // Show success message with all branches
        Alert.alert(
          '✅ Access Granted!',
          `Welcome ${result.data.managerName}!\n\n📋 Your Branches (${branchNames.length}):\n${branchList}\n\nYou can now continue to account setup.`,
          [{ text: 'OK' }]
        );
      } else {
        console.log('❌ [UI] Validation failed:', result.message);
        console.log('❌ [UI] Error code:', result.errorCode);
        
        // Set appropriate error message based on error code
        let errorMessage = result.message || 'Invalid activation code';
        
        if (result.errorCode === 'RLS_ERROR') {
          errorMessage = 'Permission denied. Please check your activation code or contact support.';
        } else if (result.errorCode === 'NOT_FOUND') {
          errorMessage = 'Invalid activation code. Please check and try again.';
        } else if (result.errorCode === 'ALREADY_USED') {
          errorMessage = 'This activation code has already been used.';
        } else if (result.errorCode === 'EXPIRED') {
          errorMessage = 'Activation code has expired. Please request a new one.';
        }
        
        setLocalError(errorMessage);
        setCodeValidated(false);
        setBranchInfo(null);
      }
      
    } catch (error) {
      console.error('❌ [UI] Validation error:', error);
      console.error('❌ [UI] Error message:', error.message);
      console.error('❌ [UI] Error stack:', error.stack);
      
      let errorMessage = 'Failed to validate code. Please try again.';
      
      if (isRLSError(error)) {
        console.log('🔒 [UI] RLS error detected');
        errorMessage = 'Permission denied. Please check your activation code or contact support.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setLocalError(errorMessage);
      setCodeValidated(false);
      setBranchInfo(null);
      
      Alert.alert('Error', errorMessage);
      
    } finally {
      setIsValidating(false);
      console.log('✅ [UI] Validation completed');
      console.log('📊 [UI] Final codeValidated:', codeValidated);
    }
  };

  const handleContinue = () => {
    console.log('🔍 [UI] handleContinue called');
    console.log('📊 [UI] codeValidated:', codeValidated);
    console.log('📊 [UI] branchInfo:', branchInfo);
    
    if (!codeValidated || !branchInfo) {
      console.log('❌ [UI] Code not validated or no branch info');
      setLocalError('Please validate your activation code first');
      return;
    }
    
    // ============================================
    // ✅ CONTINUE TO SETUP - DETAILED LOG
    // ============================================
    console.log('========================================');
    console.log('🚀 [UI] ======================================');
    console.log('🚀 [UI] PROCEEDING TO ACCOUNT SETUP');
    console.log('🚀 [UI] ======================================');
    console.log('👤 [UI] Manager Name:', branchInfo.managerName);
    console.log('📧 [UI] Manager Email:', branchInfo.managerEmail);
    console.log('🏢 [UI] Branches:');
    branchInfo.names.forEach((name, index) => {
      console.log(`   ${index + 1}. ${name} ${branchInfo.locations[index] ? `(${branchInfo.locations[index]})` : ''}`);
    });
    console.log('📊 [UI] Total Branches:', branchInfo.names.length);
    console.log('🚀 [UI] ======================================');
    console.log('========================================');
    
    const branchList = branchInfo.names.map((name) => `  ✓ ${name}`).join('\n');
    
    console.log('✅ [UI] Showing success alert for continuation');
    console.log('📊 [UI] Branches:', branchList);
    
    Alert.alert(
      '🎉 Success!',
      `Code validated for:\n${branchList}\n\nYou can now create your manager account.`,
      [
        { 
          text: 'OK', 
          onPress: () => {
            console.log('👉 [UI] Navigating to Dashboard or Account Setup');
            // TODO: Navigate to dashboard or account creation
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
                <View style={styles.branchListHeader}>
                  <Icon name="checkmark" size={20} color={COLORS.success} />
                  <Text style={styles.branchListTitle}>
                    ✓ Access granted for ({branchInfo.names.length} branch{ branchInfo.names.length > 1 ? 'es' : '' }):
                  </Text>
                </View>
                {branchInfo.names.map((name, index) => (
                  <View key={index} style={styles.branchItem}>
                    <Icon name="checkmark" size={16} color={COLORS.success} />
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
  branchListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  branchListTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.success,
  },
  branchItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
    paddingLeft: SPACING.sm,
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