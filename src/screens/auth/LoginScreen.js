// src/screens/auth/LoginScreen.js
import React, { useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
  Keyboard,
  Text,
  TouchableOpacity,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import AnimatedTextDot from '../../components/common/AnimatedTextDot';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import { useAuth } from '../../hooks/useAuth';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import useKeyboard from '../../hooks/useKeyboard';

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
  const { isKeyboardVisible, keyboardHeight } = useKeyboard();
  
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
      Alert.alert('Login Failed', 'Invalid username or password. Please try again.');
    }
  };

  const handleManagerActivation = () => {
    // For new manager registration (no user yet)
    navigation.navigate('ManagerActivation');
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

  // Calculate bottom sheet position
  // When keyboard is visible, move the bottom sheet up by keyboard height
  const bottomSheetBottom = isKeyboardVisible ? keyboardHeight : 0;

  return (
    <>
      <StatusBar style="light" />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.container}>
          <AnimatedTextDot
            data={ANIMATION_DATA}
            loop={true}
            yOffset={-300}
            textSize={32}
            dotSize={32}
          />

          {/* Bottom Sheet with dynamic position */}
          <View 
            style={[
              styles.bottomSheet,
              { bottom: bottomSheetBottom }
            ]}
          >
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
              disabled={isLoading}
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
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>Online</Text>
              </View>
            </View>

            <View style={styles.alertRow} pointerEvents="none">
              <Icon name="warningTriangle" size={13} color={COLORS.error} />
              <Text style={styles.alertText}>
                Access is restricted to authorized personnel only.
              </Text>
            </View>

            <View style={styles.footerSection}>
              <View style={styles.footerDivider} />
              <TouchableOpacity
                style={styles.managerActivationButton}
                onPress={handleManagerActivation}
                activeOpacity={0.7}
              >
                <Icon name="key" size={14} color={COLORS.primary} />
                <Text style={styles.managerActivationText}>Manager Activation</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#F7FEFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 0,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: -5,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
    ...Platform.select({
      web: {
        boxShadow: '0 -5px 8px rgba(0,0,0,0.1)',
      },
    }),
  },
  usernameWrapper: {
    marginTop: SPACING.lg,
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
    backgroundColor: '#4CAF50',
    marginRight: SPACING.xs,
  },
  onlineText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: '#757575',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
    borderRadius: 20,
    backgroundColor: COLORS.error + '10',
  },
  alertText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.error,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    textAlign: 'center',
  },
  footerSection: {
    marginTop: SPACING.md,
    alignItems: 'center',
  },
  footerDivider: {
    height: 1,
    alignSelf: 'stretch',
    backgroundColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  managerActivationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  managerActivationText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
});