// src/screens/auth/LoginScreen.js
import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Keyboard,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import Alert from '../../utils/appAlert';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import AnimatedTextDot from '../../components/common/AnimatedTextDot';
import KeyboardWrapper from '../../components/common/KeyboardWrapper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import Modal from '../../components/common/Modal';
import ModalHero from '../../components/common/ModalHero';
import GlassPanel from '../../components/common/GlassPanel';
import ColorBlobs from '../../components/common/ColorBlobs';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../hooks/useAuth';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import useConnectionStatus from '../../hooks/useConnectionStatus';
import useKeyboardInset from '../../hooks/useKeyboardInset';
import { getConnectionStatus } from '../../services/connectionStatus';

const { width: screenWidth } = Dimensions.get('window');

const ANIMATION_DATA = [
  { text: 'Welcome Back', bgColor: '#F72E75' },
  { text: 'Good to See You', bgColor: '#FF7800' },
  { text: 'Ready to Track', bgColor: '#07B2F5' },
  { text: 'Securing the Chain', bgColor: '#F2C94C' },
  { text: "Let's Get Started", bgColor: '#4CF294' },
  { text: 'ChemStock is Here', bgColor: '#03045E' },
];

export default function LoginScreen() {
  const navigation = useNavigation();
  const connection = useConnectionStatus();
  // The sheet sits on the keyboard: 0 where the phone resized the screen
  // (Expo Go), the keyboard's height in a built APK.
  const containerRef = useRef(null);
  const { inset: keyboardInset } = useKeyboardInset(containerRef);
  // The Android navigation bar draws over the bottom of the app (edge-to-edge); keep the last button above it.
  // With the keyboard open the sheet already sits on top of it, so no extra space is needed then.
  const insets = useSafeAreaInsets();
  const bottomSafe = keyboardInset > 0 ? 0 : insets.bottom;
  const [isActivationWarningVisible, setIsActivationWarningVisible] = useState(false);

  const {
    username,
    password,
    isLoading,
    usernameError,
    passwordError,
    user,
    setUsername,
    setPassword,
    login,
    clearError,
  } = useAuth();
  
  const passwordInputRef = useRef(null);

  // Handle login success
  useEffect(() => {
    if (user && !isLoading) {
      // Check if manager needs activation
      if (user.role === 'manager') {
        navigation.replace('ManagerDashboard', { 
          name: user.full_name || user.username,
        });
      } else if (user.role === 'sales_rep') {
        navigation.replace('SalesRepDashboard', {
          name: user.full_name || user.username,
        });
      } else if (user.role === 'collector') {
        navigation.replace('CollectorDashboard', {
          name: user.full_name || user.username,
        });
      }
      }
    }, [user, isLoading, navigation]);

  const handleLogin = async () => {
    Keyboard.dismiss();
    clearError();
    const success = await login();
    
    if (!success) {
      if (getConnectionStatus().online) {
        // Only the password is cleared; the username stays so it can be retyped from there.
        setPassword('');
        Alert.alert('Login Failed', 'Invalid username or password. Please try again.');
      } else {
        Alert.alert(
          'No Internet Connection',
          'Signing in needs a connection. Please reconnect and try again.'
        );
      }
    }
  };

  const handleManagerActivationPress = () => {
    setIsActivationWarningVisible(true);
  };

  const handleConfirmManagerActivation = () => {
    setIsActivationWarningVisible(false);
    // For new manager registration (no user yet)
    navigation.navigate('ManagerActivation');
  };

  const handleCancelManagerActivation = () => {
    setIsActivationWarningVisible(false);
  };

  const handleUsernameSubmit = () => {
    if (passwordInputRef.current) {
      passwordInputRef.current.focus();
    }
  };

  const handlePasswordSubmit = () => {
    Keyboard.dismiss();
    handleLogin();
  };

  const handleForgotPassword = () => {
    Alert.alert('Forgot Password', 'Please contact your system administrator to reset your password.');
  };

  const buttonWidth = screenWidth - (SPACING.lg * 2);

  return (
    <>
      <StatusBar style="light" />
      <KeyboardWrapper>
        <View ref={containerRef} collapsable={false} style={styles.container}>
          <LinearGradient
            colors={[COLORS.secondaryLight, COLORS.background]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <ColorBlobs />
          <AnimatedTextDot
            data={ANIMATION_DATA}
            loop={true}
            yOffset={-300}
            textSize={32}
            dotSize={32}
          />

          <View style={[styles.bottomSheetWrapper, { bottom: keyboardInset }]}>
            <GlassPanel
              intensity={40}
              tint="light"
              noiseOpacity={0.08}
              style={styles.bottomSheet}
            >
              <View style={[styles.sheetContent, { paddingBottom: SPACING.lg + bottomSafe }]}>
                <View style={styles.usernameWrapper}>
                  <Input
                    icon="user"
                    placeholder="Username"
                    value={username}
                    onChangeText={setUsername}
                    error={usernameError}
                    autoCapitalize="none"
                    returnKeyType="next"
                    onSubmitEditing={handleUsernameSubmit}
                  />
                </View>

                <Input
                  inputRef={passwordInputRef}
                  icon="lock"
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  error={passwordError}
                  secureTextEntry={true}
                  returnKeyType="done"
                  onSubmitEditing={handlePasswordSubmit}
                />

                <Button
                  title={isLoading ? "Logging in..." : "Login"}
                  onPress={handleLogin}
                  variant="black"
                  width={buttonWidth}
                  height={50}
                  fontSize={16}
                  borderRadius={12}
                  hasShadow={true}
                  style={styles.loginButton}
                  disabled={isLoading || !username.trim() || !password}
                />

                <View style={styles.rowContainer}>
                  <TouchableOpacity
                    style={styles.forgotPasswordContainer}
                    onPress={handleForgotPassword}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                  </TouchableOpacity>

                  <View style={styles.onlineContainer}>
                    <View style={[styles.onlineDot, !connection.online && styles.onlineDotOffline]} />
                    <Text style={styles.onlineText}>{connection.online ? 'Online' : 'Offline'}</Text>
                  </View>
                </View>

                <View style={styles.footerSection}>
                  <View style={styles.footerDivider} />
                  <TouchableOpacity
                    style={styles.managerActivationButton}
                    onPress={handleManagerActivationPress}
                    activeOpacity={0.7}
                  >
                    <Icon name="key" size={14} color={COLORS.primary} />
                    <Text style={styles.managerActivationText}>Manager Activation</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </GlassPanel>
          </View>
        </View>
      </KeyboardWrapper>

      <Modal visible={isActivationWarningVisible} onClose={handleCancelManagerActivation} height={460}>
        <ModalHero
          icon="warning"
          title="Restricted Access"
          description="Manager Activation is restricted to authorized personnel only. Continue only if you're authorized to register a branch."
          infoItems={[
            {
              icon: 'key',
              label: 'An activation code',
              hint: 'Provided by your system administrator',
            },
            {
              icon: 'location',
              label: 'Your branch assignment',
              hint: 'The branch you will manage',
            },
          ]}
        />
        <Button
          title="Continue Setup"
          onPress={handleConfirmManagerActivation}
          variant="black"
          height={50}
          fontSize={16}
          borderRadius={12}
          style={styles.activationModalButton}
        />
        <TouchableOpacity
          onPress={handleCancelManagerActivation}
          style={styles.activationModalCancel}
          activeOpacity={0.7}
        >
          <Text style={styles.activationModalCancelText}>Cancel</Text>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  bottomSheetWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  bottomSheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 0,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
    ...Platform.select({
      web: {
        boxShadow: '0 -5px 8px rgba(0,0,0,0.1)',
      },
    }),
  },
  sheetContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  usernameWrapper: {
    marginTop: 0,
  },
  loginButton: {
    marginTop: 8,
    marginBottom: SPACING.sm,
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  forgotPasswordContainer: {
    paddingVertical: SPACING.xs,
    paddingRight: SPACING.sm,
  },
  forgotPasswordText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    textDecorationLine: 'underline',
  },
  onlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    paddingLeft: SPACING.sm,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
    marginRight: SPACING.xs,
  },
  onlineDotOffline: { backgroundColor: COLORS.error },
  onlineText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textTertiary,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  footerSection: {
    marginTop: SPACING.md,
    alignItems: 'center',
  },
  footerDivider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginBottom: SPACING.md,
    // Full-bleed: cancel the sheet's horizontal padding so the line
    // reaches the left and right edges of the glass, corner to corner.
    marginLeft: -SPACING.lg,
    marginRight: -SPACING.lg,
  },
  managerActivationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignSelf: 'stretch',
  },
  managerActivationText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  activationModalButton: {
    width: '100%',
  },
  activationModalCancel: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    marginTop: SPACING.md,
  },
  activationModalCancelText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
});