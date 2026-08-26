// src/screens/auth/ManagerActivationScreen.js
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
  Keyboard,
  Animated,
  findNodeHandle,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import Header from '../../components/common/Header';
import Icon from '../../components/common/Icon';
import Input from '../../components/common/Input';
import SuccessFrame from '../../components/common/SuccessFrame';
import Stepper from '../../components/common/Stepper';
import useActivation from '../../hooks/useActivation';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// ============================================
// ULTRA COMPACT PASSWORD CHECKLIST - 2 COLUMNS
// ============================================
const PasswordChecklist = ({ password }) => {
  const checks = [
    { id: 'length', label: '8+ chars', test: (p) => p.length >= 8 },
    { id: 'uppercase', label: 'A-Z', test: (p) => /[A-Z]/.test(p) },
    { id: 'lowercase', label: 'a-z', test: (p) => /[a-z]/.test(p) },
    { id: 'number', label: '0-9', test: (p) => /[0-9]/.test(p) },
    { id: 'special', label: 'Special', test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
  ];
  
  const metCount = checks.filter(c => c.test(password)).length;
  const totalChecks = checks.length;

  if (password.length === 0) {
    return null;
  }
  
  const strengthPercent = Math.min((metCount / totalChecks) * 100, 100);
  
  let strengthColor = '#E0E0E0';
  let strengthLabel = 'Weak';
  let strengthLabelColor = '#F44336';
  
  if (metCount <= 2) {
    strengthColor = '#F44336';
    strengthLabel = 'Weak';
    strengthLabelColor = '#F44336';
  } else if (metCount <= 3) {
    strengthColor = '#FF9800';
    strengthLabel = 'Medium';
    strengthLabelColor = '#FF9800';
  } else {
    strengthColor = '#4CAF50';
    strengthLabel = 'Strong';
    strengthLabelColor = '#4CAF50';
  }
  
  return (
    <View style={styles.checklistContainer}>
      <View style={styles.strengthBarSection}>
        <View style={styles.strengthBarBackground}>
          <View 
            style={[
              styles.strengthBarFill,
              { 
                width: `${strengthPercent}%`,
                backgroundColor: strengthColor,
              }
            ]} 
          />
        </View>
        <Text style={[styles.strengthLabel, { color: strengthLabelColor }]}>
          {strengthLabel}
        </Text>
      </View>
      
      <View style={styles.checklistGrid}>
        {checks.map((check, index) => {
          const met = check.test(password);
          return (
            <View key={index} style={styles.checkItem}>
              <View style={styles.checkIconContainer}>
                {met ? (
                  <Icon name="checkmark" size={10} color={COLORS.success} />
                ) : (
                  <View style={styles.emptyCircle} />
                )}
              </View>
              <Text style={[
                styles.checkLabel,
                met && styles.checkLabelMet
              ]}>
                {check.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

/**
 * ManagerActivationScreen - MVVM Pattern
 */
export default function ManagerActivationScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  
  // ============================================
  // REFS
  // ============================================
  const scrollViewRef = useRef(null);
  const passwordInputRef = useRef(null);
  const confirmPasswordInputRef = useRef(null);
  const confirmPasswordContainerRef = useRef(null);
  
  // ============================================
  // ANIMATION VALUES
  // ============================================
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  
  // ============================================
  // HOOKS
  // ============================================
  const {
    activationKey,
    error,
    isValidCode,
    isLoading,
    branchInfo,
    setActivationKey,
    submit,
    completeSetup,
  } = useActivation();
  
  // ============================================
  // STATE
  // ============================================
  const [currentStep, setCurrentStep] = useState(1);
  const [showSuccessFrame, setShowSuccessFrame] = useState(false);
  const [branchCount, setBranchCount] = useState(0);
  const [localError, setLocalError] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const inputRef = useRef(null);
  
  const [managerUsername, setManagerUsername] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step2Errors, setStep2Errors] = useState({
    username: '',
    password: '',
    confirmPassword: '',
  });
  
  // ============================================
  // EFFECTS
  // ============================================
  useEffect(() => {
    try {
      if (isValidCode && branchInfo && branchInfo.names && branchInfo.names.length > 0) {
        const count = branchInfo.names.length;
        setBranchCount(count);
        setShowSuccessFrame(true);
        setLocalError('');
        console.log(`[INFO] [ManagerActivationScreen] Validation success: ${count} branches found`);
      }
    } catch (err) {
      console.error('[ERROR] [ManagerActivationScreen] Error in validation effect:', err);
      setLocalError('An unexpected error occurred while validating.');
    }
  }, [isValidCode, branchInfo]);

  useEffect(() => {
    try {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 500);
    } catch (err) {
      console.error('[ERROR] [ManagerActivationScreen] Error focusing input:', err);
    }
  }, []);
  
  // ============================================
  // ANIMATION HELPERS
  // ============================================
  const animateStepTransition = (direction) => {
    if (isTransitioning) {
      return;
    }

    setIsTransitioning(true);

    try {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: direction === 'forward' ? -30 : 30,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (direction === 'forward') {
          setCurrentStep(2);
        } else {
          setCurrentStep(1);
        }

        fadeAnim.setValue(0);
        slideAnim.setValue(direction === 'forward' ? 30 : -30);

        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setIsTransitioning(false);
        });
      });
    } catch (err) {
      console.error('[ERROR] [ManagerActivationScreen] Animation error:', err);
      setIsTransitioning(false);
    }
  };
  
  // ============================================
  // SCROLL HELPERS - USING measureLayout FOR ACCURACY
  // ============================================
  const scrollToPasswordInput = () => {
    try {
      setTimeout(() => {
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({
            y: 200,
            animated: true,
          });
        }
      }, 400);
    } catch (err) {
      console.error('[ERROR] [ManagerActivationScreen] Scroll error:', err);
    }
  };

  const scrollToConfirmPasswordInput = () => {
    try {
      setTimeout(() => {
        if (scrollViewRef.current) {
          // Fallback: scroll to 55% of screen height
          const scrollAmount = screenHeight * 0.55;
          scrollViewRef.current.scrollTo({
            y: scrollAmount,
            animated: true,
          });
        }
      }, 500);
    } catch (err) {
      console.error('[ERROR] [ManagerActivationScreen] Scroll error:', err);
    }
  };
  
  // ============================================
  // HANDLERS - Step 1
  // ============================================
  const handleSuccessFrameFade = () => {
    setShowSuccessFrame(false);
  };

  const handleActivationInputChange = (text) => {
    setActivationKey(text);
    setLocalError('');
  };

  const handleActivationKeySubmit = async () => {
    Keyboard.dismiss();

    setTimeout(async () => {
      await handleValidateCode();
    }, 300);
  };

  const handleValidateCode = async () => {
    setLocalError('');

    try {
      if (!activationKey || !activationKey.trim()) {
        console.warn('[WARN] [ManagerActivationScreen] Empty activation code');
        setLocalError('Please enter an activation code');
        return;
      }

      if (activationKey.trim().length < 4) {
        console.warn('[WARN] [ManagerActivationScreen] Activation code too short');
        setLocalError('Activation code must be at least 4 characters');
        return;
      }

      const result = await submit();

      if (result && branchInfo && branchInfo.names && branchInfo.names.length > 0) {
        setShowSuccessFrame(true);
      } else if (!result && error) {
        console.error('[ERROR] [ManagerActivationScreen] Validation failed:', error);
        setLocalError(error);
      }
    } catch (err) {
      console.error('[ERROR] [ManagerActivationScreen] Validation error:', err);
      setLocalError('An unexpected error occurred. Please try again.');
    }
  };

  const handleContinue = () => {
    try {
      if (!isValidCode || !branchInfo) {
        console.warn('[WARN] [ManagerActivationScreen] Cannot continue - validation required');
        setLocalError('Please validate your activation code first');
        Alert.alert('Validation Required', 'Please enter and validate your activation code before continuing.');
        return;
      }

      animateStepTransition('forward');
    } catch (err) {
      console.error('[ERROR] [ManagerActivationScreen] Continue error:', err);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };

  const handleBackToStep1 = () => {
    try {
      setManagerUsername('');
      setManagerPassword('');
      setConfirmPassword('');
      setStep2Errors({ username: '', password: '', confirmPassword: '' });
      animateStepTransition('backward');
    } catch (err) {
      console.error('[ERROR] [ManagerActivationScreen] Back error:', err);
    }
  };

  const handleBackToLogin = () => {
    try {
      navigation.goBack();
    } catch (err) {
      console.error('[ERROR] [ManagerActivationScreen] Navigation error:', err);
    }
  };
  
  // ============================================
  // HANDLERS - Step 2
  // ============================================
  const handleUsernameChange = (text) => {
    setManagerUsername(text);
    if (step2Errors.username) {
      setStep2Errors(prev => ({ ...prev, username: '' }));
    }
  };

  const handlePasswordChange = (text) => {
    setManagerPassword(text);
    if (step2Errors.password) {
      setStep2Errors(prev => ({ ...prev, password: '' }));
    }
    if (confirmPassword && text === confirmPassword) {
      setStep2Errors(prev => ({ ...prev, confirmPassword: '' }));
    }
  };

  const handlePasswordFocus = () => {
    scrollToPasswordInput();
  };

  const handleConfirmPasswordFocus = () => {
    scrollToConfirmPasswordInput();
  };

  const handleConfirmPasswordChange = (text) => {
    setConfirmPassword(text);
    if (managerPassword && text !== managerPassword) {
      setStep2Errors(prev => ({ ...prev, confirmPassword: 'Passwords do not match' }));
    } else {
      setStep2Errors(prev => ({ ...prev, confirmPassword: '' }));
    }
  };

  const handleCompleteSetup = async () => {
  try {
    let hasError = false;
    const errors = { username: '', password: '', confirmPassword: '' };

    if (!managerUsername || !managerUsername.trim()) {
      errors.username = 'Please enter your full name';
      hasError = true;
    } else if (managerUsername.trim().length < 2) {
      errors.username = 'Name must be at least 2 characters';
      hasError = true;
    }

    if (!managerPassword) {
      errors.password = 'Please create a password';
      hasError = true;
    } else if (managerPassword.length < 8) {
      errors.password = 'Password must be at least 8 characters';
      hasError = true;
    } else if (!/[A-Z]/.test(managerPassword) && !/[a-z]/.test(managerPassword)) {
      errors.password = 'Password must contain uppercase and lowercase letters';
      hasError = true;
    } else if (!/[0-9]/.test(managerPassword)) {
      errors.password = 'Password must contain at least one number';
      hasError = true;
    } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(managerPassword)) {
      errors.password = 'Password must contain at least one special character';
      hasError = true;
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
      hasError = true;
    } else if (managerPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
      hasError = true;
    }

    if (hasError) {
      setStep2Errors(errors);
      return;
    }

    setStep2Errors({ username: '', password: '', confirmPassword: '' });

    const result = await completeSetup(managerUsername.trim(), managerPassword);

    if (!result.success) {
      Alert.alert('Setup Failed', result.message || 'Please try again.');
      return;
    }

    if (result.hasSession) {
      navigation.replace('ManagerDashboard', {
        name: result.profile.fullName || result.profile.username || managerUsername,
      });
    } else {
      Alert.alert(
        'Account Created',
        'Please check your email to confirm your account, then log in.',
        [{ text: 'OK', onPress: () => navigation.replace('Login') }]
      );
    }
  } catch (err) {
    console.error('[ERROR] [ManagerActivationScreen] Setup error:', err);
    Alert.alert('Error', 'An unexpected error occurred during setup. Please try again.');
  }
};

  // ============================================
  // COMPUTED PROPERTIES
  // ============================================
  const isFormValid = 
    managerUsername && managerUsername.trim().length >= 2 &&
    managerPassword && managerPassword.length >= 8 &&
    confirmPassword &&
    managerPassword === confirmPassword &&
    !step2Errors.username &&
    !step2Errors.password &&
    !step2Errors.confirmPassword;
  
  const bottomContainerHeight = 180 + (insets.bottom || 0);
  // ✅ FIX: Significantly increased padding for keyboard
  const scrollViewPaddingBottom = bottomContainerHeight + 120;
  
  // ============================================
  // RENDER - Step 1
  // ============================================
  if (currentStep === 1) {
    const isButtonEnabled = isValidCode && branchInfo && branchInfo.names && branchInfo.names.length > 0;
    const hasBranches = branchInfo && branchInfo.names && branchInfo.names.length > 0;
    const buttonWidth = screenWidth - (SPACING.lg * 2);
    
    return (
      <>
        <StatusBar style="light" />
        <View style={styles.container}>
          <Header
            showBackButton={true}
            backButtonText="Back to Login"
            showOnlineStatus={true}
            height={56}
            backgroundColor="#03045E"
            textColor="#FFFFFF"
            onBackPress={handleBackToLogin}
          />
          
          <View style={styles.header2Container}>
            <View style={styles.header2Row}>
              <Text style={styles.header2Title}>Manager Account Setup</Text>
              <View style={styles.header2Icon}>
                <Icon name="key" size={18} color={COLORS.primary} />
              </View>
            </View>
            <Text style={styles.header2Subtitle}>
              Enter the activation key from the developer to register your branch(es).
            </Text>
          </View>
          
          <SuccessFrame 
            visible={showSuccessFrame}
            branchCount={branchCount}
            onFadeComplete={handleSuccessFrameFade}
          />
          
          <Animated.ScrollView 
            style={[
              styles.scrollView,
              {
                opacity: fadeAnim,
                transform: [{ translateX: slideAnim }],
              }
            ]}
            contentContainerStyle={styles.scrollContentStep1}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.stepperWrapper}>
              <Stepper currentStep={1} />
            </View>
            
            <View style={styles.inputSection}>
              <Input
                label="Activation Code"
                required={true}
                placeholder="Enter activation code"
                icon="key"
                value={activationKey}
                onChangeText={handleActivationInputChange}
                error={localError || error}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleActivationKeySubmit}
                inputRef={inputRef}
                rightIcon={
                  <TouchableOpacity onPress={handleValidateCode} disabled={isLoading}>
                    <Icon 
                      name="send" 
                      size={20} 
                      color={isLoading ? '#B0B0B0' : COLORS.primary}
                      stroke={isLoading ? '#B0B0B0' : COLORS.primary}
                      strokeWidth={1}
                    />
                  </TouchableOpacity>
                }
                onRightIconPress={handleValidateCode}
              />
              
              {isLoading && (
                <Text style={styles.loadingText}>Validating activation code...</Text>
              )}
            </View>
            
            <View style={styles.branchContainer}>
              <Text style={styles.branchTitle}>Location &amp; Branch Lock</Text>
              <Text style={styles.branchSubtext}>
                Your branch access will be automatically verified based on the activation key
              </Text>
              
              <View style={[
                styles.branchListContainer,
                hasBranches ? styles.branchListContainerAdaptive : styles.branchListContainerEmpty
              ]}>
                {hasBranches ? (
                  branchInfo.names.map((name, index) => (
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
                  ))
                ) : (
                  <View style={styles.emptyBranchContainer}>
                    <Icon 
                      name="building" 
                      size={16} 
                      color="#757575"
                      stroke="#757575"
                      strokeWidth={0.5}
                    />
                    <Text style={styles.emptyBranchText}>
                      List of branches will appear here
                    </Text>
                  </View>
                )}
              </View>
            </View>
            
            <View style={styles.scrollBottomPadding} />
          </Animated.ScrollView>
          
          <View 
            style={[styles.bottomContainer, { bottom: 10 + (insets.bottom || 0) }]}
            pointerEvents="box-none"
          >
            <View style={styles.bottomWarningWrapper}>
              <Icon name="warningTriangle" size={28} color={COLORS.error} />
              <Text style={styles.bottomWarningTitle}>Warning</Text>
              <Text style={[styles.bottomWarningText, { width: buttonWidth }]}>
                This will set up your device for manager access. Only continue if you're authorized to manage this branch.
              </Text>
            </View>
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[
                  styles.continueButton,
                  { 
                    backgroundColor: isButtonEnabled ? '#03045E' : '#555353',
                  }
                ]}
                onPress={handleContinue}
                disabled={!isButtonEnabled || isTransitioning}
                activeOpacity={0.8}
              >
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonText}>Continue to Account Setup</Text>
                  <Icon name="arrowRight" size={20} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </>
    );
  }
  
  // ============================================
  // RENDER - Step 2 (NO KeyboardWrapper - fixed bottom stays in place)
  // ============================================
  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton={true}
          backButtonText="Back to Step 1"
          showOnlineStatus={true}
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          onBackPress={handleBackToStep1}
        />
        
        <View style={styles.header2Container}>
          <View style={styles.header2Row}>
            <Text style={styles.header2Title}>Manager Account Setup</Text>
            <View style={styles.header2Icon}>
              <Icon name="key" size={18} color={COLORS.primary} />
            </View>
          </View>
          <Text style={styles.header2Subtitle}>
            Set up your manager credentials to complete the registration
          </Text>
        </View>
        
        <Animated.ScrollView 
          ref={scrollViewRef}
          style={[
            styles.scrollView,
            {
              opacity: fadeAnim,
              transform: [{ translateX: slideAnim }],
            }
          ]}
          contentContainerStyle={[
            styles.scrollContentStep2,
            { paddingBottom: scrollViewPaddingBottom }
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={true}
        >
          <View style={styles.stepperWrapper}>
            <Stepper currentStep={2} />
          </View>
          
          <View style={styles.inputSection}>
            <Input
              label="Manager Username"
              required={true}
              placeholder="Enter your full name"
              value={managerUsername}
              onChangeText={handleUsernameChange}
              error={step2Errors.username}
              autoCapitalize="words"
              returnKeyType="next"
            />
            
            <Input
              label="Manager Password"
              required={true}
              placeholder="Create a password"
              secureTextEntry={true}
              value={managerPassword}
              onChangeText={handlePasswordChange}
              error={step2Errors.password}
              autoCapitalize="none"
              returnKeyType="next"
              inputRef={passwordInputRef}
              onFocus={handlePasswordFocus}
            />
            
            <PasswordChecklist password={managerPassword} />
            
            <View ref={confirmPasswordContainerRef}>
              <Input
                label="Confirm Password,"
                required={true}
                placeholder="Confirm your password"
                secureTextEntry={true}
                value={confirmPassword}
                onChangeText={handleConfirmPasswordChange}
                error={step2Errors.confirmPassword}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleCompleteSetup}
                inputRef={confirmPasswordInputRef}
                onFocus={handleConfirmPasswordFocus}
              />
            </View>
          </View>
          
          <View style={{ height: 20 }} />
        </Animated.ScrollView>
        
        {/* ✅ FIX: Bottom container stays fixed - NO KeyboardWrapper */}
        <View 
          style={[styles.bottomContainer, { bottom: 10 + (insets.bottom || 0) }]}
          pointerEvents="box-none"
        >
          <View style={styles.bottomWarningWrapper}>
            <Icon name="warningTriangle" size={28} color={COLORS.error} />
            <Text style={styles.bottomWarningTitle}>Security Notice</Text>
            <Text style={[styles.bottomWarningText, { width: screenWidth - (SPACING.lg * 2) }]}>
              Create a strong password (8+ chars, numbers, and symbols). Your full name will be your manager ID.
            </Text>
          </View>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.continueButton,
                { 
                  backgroundColor: isFormValid ? '#03045E' : '#555353',
                }
              ]}
              onPress={handleCompleteSetup}
              disabled={!isFormValid || isTransitioning}
              activeOpacity={0.8}
            >
              <View style={styles.buttonContent}>
                <Text style={styles.buttonText}>Complete Setup</Text>
                <Icon name="arrowRight" size={20} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </>
  );
}

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7FEFF',
  },
  header2Container: {
    backgroundColor: '#F7FEFF',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1,
  },
  header2Row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  header2Title: {
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
    lineHeight: 24,
    flex: 1,
    letterSpacing: 0.3,
  },
  header2Icon: {
    marginLeft: SPACING.sm,
    padding: 2,
  },
  header2Subtitle: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginTop: 4,
    letterSpacing: 0.2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContentStep1: {
    paddingBottom: 20,
  },
  scrollContentStep2: {
    paddingBottom: 200,
  },
  stepperWrapper: {
    marginTop: 16,
    paddingHorizontal: SPACING.lg,
  },
  inputSection: {
    paddingHorizontal: SPACING.lg,
    marginTop: 12,
  },
  loadingText: {
    marginTop: SPACING.xs,
    fontSize: 12,
    color: COLORS.primary,
    textAlign: 'center',
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  branchContainer: {
    marginTop: 12,
    paddingHorizontal: SPACING.lg,
  },
  branchTitle: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  branchSubtext: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    lineHeight: 16,
    marginBottom: 6,
  },
  branchListContainerEmpty: {
    height: 140,
    borderWidth: 0.5,
    borderColor: '#757575',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: SPACING.md,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  branchListContainerAdaptive: {
    minHeight: 40,
    borderWidth: 0.5,
    borderColor: '#757575',
    borderStyle: 'solid',
    borderRadius: 12,
    padding: SPACING.md,
    backgroundColor: COLORS.success + '10',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  branchItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    marginBottom: 4,
    paddingLeft: SPACING.sm,
    width: '100%',
  },
  branchInfoContainer: {
    flex: 1,
  },
  branchNameText: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textPrimary,
  },
  branchLocationText: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  emptyBranchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyBranchText: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: '#757575',
    textAlign: 'center',
  },
  scrollBottomPadding: {
    height: 20,
  },
  bottomContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    paddingBottom: 10,
    zIndex: 999,
  },
  bottomWarningWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: 4,
    paddingBottom: 4,
  },
  bottomWarningTitle: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.error,
    marginTop: 2,
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  bottomWarningText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 0,
  },
  buttonContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: 2,
    paddingBottom: 8,
  },
  continueButton: {
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    width: screenWidth - (SPACING.lg * 2),
    height: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  checklistContainer: {
    marginTop: 2,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  strengthBarSection: {
    marginBottom: 3,
  },
  strengthBarBackground: {
    height: 3,
    backgroundColor: '#E8ECF0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 2,
  },
  strengthBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 9,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    textAlign: 'right',
  },
  checklistGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -2,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '50%',
    paddingHorizontal: 2,
    paddingVertical: 1.5,
  },
  checkIconContainer: {
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  emptyCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#C0C0C0',
    backgroundColor: 'transparent',
  },
  checkLabel: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: '#757575',
  },
  checkLabelMet: {
    color: COLORS.textPrimary,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
});