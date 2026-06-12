// src/screens/auth/ManagerActivationScreen.js
import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import Icon from '../../components/common/Icon';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

export default function ManagerActivationScreen() {
  return (
    <>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <SafeAreaView style={styles.container}>
        {/* Primary Frame - Header */}
        <Header
          showBackButton={true}
          backButtonText="Back to Login"
          showOnlineStatus={true}
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
        />
        
        {/* Secondary Frame - Compact Card */}
        <Card marginTop={0} marginHorizontal={0} paddingVertical={SPACING.md}>
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
              <Icon name="key" size={24} color="#272632" />
            </View>
          </View>
        </Card>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
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
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
    marginBottom: 4,
    lineHeight: 24,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: '#555353',
    lineHeight: 18,
    marginTop: 0,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
});