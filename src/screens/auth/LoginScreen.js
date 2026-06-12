// src/screens/auth/LoginScreen.js
import React, { useState, useRef } from 'react';
import { View, StyleSheet, Dimensions, TouchableWithoutFeedback, Keyboard, Text, TouchableOpacity } from 'react-native';
import AnimatedTextDot from '../../components/common/AnimatedTextDot';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

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
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const passwordInputRef = useRef(null);

  const handleLogin = () => {
    console.log('Login:', { username, password, rememberMe });
    Keyboard.dismiss();
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

  const bottomSheetPadding = SPACING.lg * 2;
  const buttonWidth = screenWidth - bottomSheetPadding;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <AnimatedTextDot
          data={ANIMATION_DATA}
          loop={true}
          yOffset={-300}
          textSize={32}
          dotSize={32}
        />

        <View style={styles.bottomSheet}>
          {/* Top margin for input fields - good UX spacing */}
          <View style={styles.topSpacer} />

          {/* Username Field */}
          <Input
            icon="user"
            placeholder="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            returnKeyType="next"
            onSubmitEditing={handleUsernameSubmit}
          />

          {/* Password Field - minimal gap */}
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

          {/* Remember Me - good touch target size */}
          <TouchableOpacity 
            style={styles.rememberMeRow} 
            onPress={() => setRememberMe(!rememberMe)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
              {rememberMe && <View style={styles.checkboxInner} />}
            </View>
            <Text style={styles.rememberMeText}>Remember Me</Text>
          </TouchableOpacity>

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
          />

          {/* Forgot Password & Online Row */}
          <View style={styles.rowContainer}>
            <TouchableOpacity 
              style={styles.forgotPasswordContainer}
              onPress={() => console.log('Forgot Password')}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            <View style={styles.onlineContainer}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Online</Text>
            </View>
          </View>

          {/* Spacer before alert - prevents accidental touches */}
          <View style={styles.separator} />

          {/* Alert text with icon - non-interactive */}
          <View style={styles.alertRow} pointerEvents="none">
            <Icon name="warningTriangle" size={14} color="#FF0000" />
            <Text style={styles.alertText}>
              Access is restricted to authorized personnel only.
            </Text>
          </View>

          {/* Manager Activation */}
          <TouchableOpacity 
            style={styles.managerActivationContainer}
            onPress={() => console.log('Manager Activation')}
            activeOpacity={0.7}
          >
            <Text style={styles.managerActivationText}>Manager Activation</Text>
          </TouchableOpacity>

          {/* Bottom safe area spacer */}
          <View style={styles.bottomSpacer} />
        </View>
      </View>
    </TouchableWithoutFeedback>
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
    paddingBottom: 0,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: -5,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  topSpacer: {
    height: SPACING.lg, // 24px top margin for good UX
  },
  rememberMeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm, // 8px
    marginBottom: SPACING.md, // 16px
    paddingVertical: SPACING.xs, // 4px - increases touch target
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderColor: '#757575',
    borderRadius: 4,
    marginRight: SPACING.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  checkboxInner: {
    width: 12,
    height: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  rememberMeText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: '#757575',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md, // 16px
    marginBottom: SPACING.sm, // 8px
  },
  forgotPasswordContainer: {
    paddingVertical: SPACING.xs, // 4px - increases touch target
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
  separator: {
    height: SPACING.md, // 16px - prevents accidental touches on alert
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingVertical: SPACING.sm, // 8px - increases touch target
    marginTop: SPACING.xs,
  },
  managerActivationText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: '#FF0000',
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    textDecorationLine: 'underline',
  },
  bottomSpacer: {
    height: SPACING.md, // 16px bottom safe area
  },
});