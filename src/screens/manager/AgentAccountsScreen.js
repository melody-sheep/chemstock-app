// src/screens/manager/AgentAccountsScreen.js
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Header from '../../components/common/Header';
import { COLORS } from '../../constants/colors';

export default function AgentAccountsScreen() {
  return (
    <>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <View style={styles.container}>
        <Header
          showBackButton={true}
          backButtonText="Back"
          title="Agent Accounts"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
        />
        <View style={styles.content} />
      </View>
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
