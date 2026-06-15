// src/screens/auth/ManagerActivationScreen.js
import React, { useRef } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import Icon from '../../components/common/Icon';
import Input from '../../components/common/Input';
import { useActivation } from '../../hooks/useActivation';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

export default function ManagerActivationScreen() {
  const {
    activationKey,
    error,
    isValidCode,
    submitted,
    isLoading,
    branches,
    setActivationKey,
    submit,
  } = useActivation();
  
  const activationInputRef = useRef(null);

  const handleSendCode = async () => {
    await submit();
  };

  const handleActivationKeyChange = (text) => {
    setActivationKey(text);
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
        />
        
        <Card 
          marginTop={0} 
          marginHorizontal={0} 
          paddingVertical={SPACING.md}
          borderRadius={0}
        >
          <View style={styles.headerRow}>
            <View style={styles.titleContainer}>
              <Text style={styles.boldTitle}>Manager Account Setup</Text>
              <Text 
                style={styles.subtitle}
                numberOfLines={2}
              >
                Enter the activation key from the developer to register your branch.
              </Text>
            </View>
            <View style={styles.iconContainer}>
              <Icon name="key" size={24} color={COLORS.textPrimary} />
            </View>
          </View>
        </Card>

        <View style={styles.inputSection}>
          <Input
            label="Activation Code"
            required={true}
            placeholder="Enter 4-digit activation code"
            icon={null}
            value={activationKey}
            onChangeText={handleActivationKeyChange}
            error={submitted && error ? error : null}
            keyboardType="numeric"
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={handleSendCode}
            inputRef={activationInputRef}
            rightIcon={
              <Icon name="send" size={20} color="#03045E" />
            }
            onRightIconPress={handleSendCode}
          />
        </View>

        <View style={styles.jurisdictionContainer}>
          <View style={styles.jurisdictionHeaderRow}>
            <View style={styles.titleRow}>
              <Text style={styles.jurisdictionTitle}>Location & Branch Lock</Text>
              <Icon name="lock" size={18} color={COLORS.textPrimary} />
            </View>
          </View>

          <Text style={styles.jurisdictionSubtext}>
            Your branch access will be automatically verified based on the activation key
          </Text>

          {submitted && isValidCode && branches.length > 0 && (
            <View style={styles.branchListContainer}>
              {branches.map((branch) => (
                <View key={branch.id} style={styles.branchItem}>
                  <Icon name="checkmark" size={18} color={COLORS.success} />
                  <Text style={styles.branchNameText}>{branch.name}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 1,
    paddingRight: SPACING.md,
  },
  boldTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
    marginBottom: 4,
    lineHeight: 24,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginTop: 0,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  inputSection: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.screenHorizontal || SPACING.lg,
  },
  jurisdictionContainer: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.screenHorizontal || SPACING.lg,
  },
  jurisdictionHeaderRow: {
    marginBottom: 4,
  },
  titleRow: {
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
    marginBottom: SPACING.sm,
  },
  branchListContainer: {
    marginTop: SPACING.xs,
    gap: SPACING.sm,
  },
  branchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  branchNameText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textPrimary,
  },
});