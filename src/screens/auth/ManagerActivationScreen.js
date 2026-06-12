// src/screens/auth/ManagerActivationScreen.js
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/common/Header';
import { COLORS } from '../../constants/colors';

export default function ManagerActivationScreen() {
  return (
    <>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <SafeAreaView style={styles.container}>
        <Header
          showBackButton={true}
          backButtonText="Back to Login"
          showOnlineStatus={true}
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
        />
        {/* Add an empty View to ensure there's content */}
        <View style={styles.content} />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
  },
});