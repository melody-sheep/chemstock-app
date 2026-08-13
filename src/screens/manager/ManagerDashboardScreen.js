// src/screens/manager/ManagerDashboardScreen.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../styles/typography';

export default function ManagerDashboardScreen() {
  const route = useRoute();
  const name = route.params?.name || 'Manager';

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Welcome {name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  text: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textPrimary,
  },
});
