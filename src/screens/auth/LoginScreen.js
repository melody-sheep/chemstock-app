// src/screens/auth/LoginScreen.js
/**
 * Login Screen Component
 * 
 * Handles user authentication with username/password.
 * Features:
 * - Animated greeting text with color cycling
 * - Static bottom sheet with login form
 * - Username and password inputs with icon support
 * - Keyboard dismiss on outside tap
 * - Accessibility support
 * 
 * @module screens/auth/LoginScreen
 */
import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
  Keyboard,
  Text,
  TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import AnimatedTextDot from '../../components/common/AnimatedTextDot';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const { width: screenWidth } = Dimensions.get('window');

// Animation data for the animated text component
const ANIMATION_DATA = [
  { text: 'Welcome Back', bgColor: '#F72E75' },
  { text: 'Good to See You', bgColor: '#FF7800' },
  { text: 'Ready to Track', bgColor: '#07B2F5' },
  { text: 'Securing the Chain', bgColor: '#F2C94C' },
  { text: "Let's Get Started", bgColor: '#4CF294' },
  { text: 'ChemStock is Here', bgColor: '#03045E' },
];

export default function LoginScreen() {
  // State management
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const passwordInputRef = useRef(null);

  /**
   * Handles login button press
   * Validates credentials and authenticates user
   */
  const handleLogin = () => {
    try {
      // TODO: Implement actual authentication logic
      console.log('Login attempt:', { username, password: '***' });
      Keyboard.dismiss();
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  /**
   * Moves focus from username to password field
   * Called when user presses "Next" on username keyboard
   */
  const handleUsernameSubmit = () => {
    try {
      if (passwordInputRef.current) {
        passwordInputRef.current.focus();
      }
    } catch (error) {
      console.error('Error focusing password field:', error);
    }
  };

  /**
   * Handles password field submission
   * Called when user presses "Done" on password keyboard
   */
  const handlePasswordSubmit = () => {
    try {
      Keyboard.dismiss();
      handleLogin();
    } catch (error) {
      console.error('Error submitting password:', error);
    }
  };

  const bottomSheetPadding = SPACING.lg * 2;
  const buttonWidth = screenWidth - bottomSheetPadding;

  return (
    <>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.container}>
          {/* Animated greeting section */}
          <AnimatedTextDot
            data={ANIMATION_DATA}
            loop={true}
            yOffset={-300}
            textSize={32}
            dotSize={32}
          />

          {/* Login form bottom sheet */}
          <View style={styles.bottomSheet}>
            {/* Username Field with top margin */}
            <View style={styles.usernameWrapper}>
              <Input
                icon="user"
                placeholder="Username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={handleUsernameSubmit}
              />
            </View>

            {/* Password Field */}
            <Input
              inputRef={passwordInputRef}
              icon="lock"
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={true}
              returnKeyType="done"
              onSubmitEditing={handlePasswordSubmit}
            />

            {/* Login Button */}
            <Button
              title="Login"
              onPress={handleLogin}
              variant="black"
              width={buttonWidth}
              height={50}
              fontSize={16}
              fontFamily="600"
              borderRadius={12}
              hasShadow={true}
              style={styles.loginButton}
            />

            {/* Forgot Password & Online Status Row */}
            <View style={styles.rowContainer}>
              <TouchableOpacity
                style={styles.forgotPasswordContainer}
                onPress={() => console.log('Forgot Password pressed')}
                activeOpacity={0.7}
                accessibilityLabel="Forgot password"
                accessibilityRole="button"
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>

              <View style={styles.onlineContainer}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>Online</Text>
              </View>
            </View>

            {/* Security Notice Alert */}
            <View style={styles.alertRow} pointerEvents="none" accessibilityRole="text">
              <Icon name="warningTriangle" size={14} color="#FF0000" />
              <Text style={styles.alertText}>
                Access is restricted to authorized personnel only.
              </Text>
            </View>

            {/* Manager Activation Link */}
            <TouchableOpacity
              style={styles.managerActivationContainer}
              onPress={() => console.log('Manager Activation pressed')}
              activeOpacity={0.7}
              accessibilityLabel="Manager activation"
              accessibilityRole="button"
            >
              <Text style={styles.managerActivationText}>Manager Activation</Text>
            </TouchableOpacity>
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
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#F7FEFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 0,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: -5,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
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
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  alertText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: '#FF0000',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginLeft: SPACING.xs,
    textAlign: 'center',
  },
  managerActivationContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    marginTop: SPACING.xs,
  },
  managerActivationText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: '#FF0000',
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    textDecorationLine: 'underline',
  },
});