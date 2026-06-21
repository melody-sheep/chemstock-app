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
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import Header from '../../components/common/Header';
import Icon from '../../components/common/Icon';
import Input from '../../components/common/Input';
import SuccessFrame from '../../components/common/SuccessFrame';
import Stepper from '../../components/common/Stepper';
import WarningSection from '../../components/common/WarningSection';
import useActivation from '../../hooks/useActivation';

const { width: screenWidth } = Dimensions.get('window');

export default function ManagerActivationScreen() {
  console.log('📱 [ManagerActivationScreen] Screen mounted');
  
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  
  const {
    activationKey,
    error,
    isValidCode,
    isLoading,
    branchInfo,
    setActivationKey,
    submit,
  } = useActivation();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [showSuccessFrame, setShowSuccessFrame] = useState(false);
  const [branchCount, setBranchCount] = useState(0);
  const [localError, setLocalError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isValidCode && branchInfo && branchInfo.names && branchInfo.names.length > 0) {
      const count = branchInfo.names.length;
      setBranchCount(count);
      setShowSuccessFrame(true);
      setLocalError('');
    }
  }, [isValidCode, branchInfo]);

  useEffect(() => {
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 500);
  }, []);
  
  const handleSuccessFrameFade = () => {
    setShowSuccessFrame(false);
  };
  
  const handleActivationInputChange = (text) => {
    setActivationKey(text);
    setLocalError('');
  };
  
  const handleValidateCode = async () => {
    setLocalError('');
    
    if (!activationKey || !activationKey.trim()) {
      setLocalError('Please enter an activation code');
      return;
    }
    
    if (activationKey.trim().length < 4) {
      setLocalError('Activation code must be at least 4 characters');
      return;
    }
    
    const result = await submit();
    
    if (result && branchInfo && branchInfo.names && branchInfo.names.length > 0) {
      setShowSuccessFrame(true);
    } else if (!result && error) {
      setLocalError(error);
    }
  };
  
  const handleContinue = () => {
    if (!isValidCode || !branchInfo) {
      setLocalError('Please validate your activation code first');
      Alert.alert('Validation Required', 'Please enter and validate your activation code before continuing.');
      return;
    }
    setCurrentStep(2);
  };
  
  const handleBackToStep1 = () => {
    setCurrentStep(1);
  };
  
  const handleBackToLogin = () => {
    navigation.goBack();
  };

  // ============================================
  // STEP 1: Manager Activation
  // ============================================
  if (currentStep === 1) {
    const isButtonEnabled = isValidCode && branchInfo && branchInfo.names && branchInfo.names.length > 0;
    const hasBranches = branchInfo && branchInfo.names && branchInfo.names.length > 0;
    
    return (
      <>
        <StatusBar style="light" translucent backgroundColor="transparent" />
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.container}>
            {/* HEADER 1 */}
            <Header
              showBackButton={true}
              backButtonText="Back to Login"
              showOnlineStatus={true}
              height={56}
              backgroundColor="#03045E"
              textColor="#FFFFFF"
              onBackPress={handleBackToLogin}
            />
            
            {/* HEADER 2 */}
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
            
            {/* SUCCESS FRAME - Overlay */}
            <SuccessFrame 
              visible={showSuccessFrame}
              branchCount={branchCount}
              onFadeComplete={handleSuccessFrameFade}
            />
            
            {/* SCROLLVIEW - flex:1 takes remaining space */}
            <ScrollView 
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* STEPPER */}
              <View style={styles.stepperWrapper}>
                <Stepper currentStep={1} />
              </View>
              
              {/* INPUT SECTION */}
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
                  onSubmitEditing={handleValidateCode}
                  inputRef={inputRef}
                  rightIcon={
                    <TouchableOpacity onPress={handleValidateCode} disabled={isLoading}>
                      <Icon name="send" size={20} color={COLORS.primary} />
                    </TouchableOpacity>
                  }
                  onRightIconPress={handleValidateCode}
                />
                
                {isLoading && (
                  <Text style={styles.loadingText}>Validating activation code...</Text>
                )}
              </View>
              
              {/* BRANCH LIST */}
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
                      <Icon name="building" size={16} color="#757575" />
                      <Text style={styles.emptyBranchText}>
                        List of branches will appear here
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              
              <View style={styles.scrollBottomPadding} />
            </ScrollView>
            
            {/* BOTTOM - FIXED POSITION - NEVER MOVES */}
            <View 
              style={[styles.bottomContainer, { bottom: insets.bottom || 0 }]}
              pointerEvents="box-none"
            >
              <WarningSection />
              
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[
                    styles.continueButton,
                    { 
                      backgroundColor: isButtonEnabled ? '#03045E' : '#555353',
                    }
                  ]}
                  onPress={handleContinue}
                  disabled={!isButtonEnabled}
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
        </TouchableWithoutFeedback>
      </>
    );
  }
  
  // ============================================
  // STEP 2: Account Setup
  // ============================================
  return (
    <>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <SafeAreaView style={styles.safeArea}>
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
        
        <View style={styles.step2Content}>
          <View style={styles.stepperWrapper}>
            <Stepper currentStep={2} />
          </View>
          
          <View style={styles.step2Placeholder}>
            <Icon name="user" size={48} color={COLORS.textTertiary} />
            <Text style={styles.step2Title}>Account Setup</Text>
            <Text style={styles.step2Subtext}>Coming soon...</Text>
          </View>
        </View>
      </SafeAreaView>
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
  safeArea: {
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
  scrollContent: {
    paddingBottom: 10,
  },
  stepperWrapper: {
    marginTop: 16,
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
  branchListContainer: {
    borderWidth: 0.5,
    borderColor: '#757575',
    borderRadius: 12,
    padding: SPACING.md,
    backgroundColor: 'transparent',
  },
  branchListContainerEmpty: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  branchListContainerAdaptive: {
    minHeight: 40,
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
    paddingBottom: Platform.OS === 'ios' ? 10 : 5,
    zIndex: 999,
  },
  buttonContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: 10,
    paddingBottom: 56,
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
  step2Content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  step2Placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
  },
  step2Title: {
    fontSize: 20,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
  },
  step2Subtext: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
});