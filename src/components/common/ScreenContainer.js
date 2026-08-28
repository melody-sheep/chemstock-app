// src/components/common/ScreenContainer.js
import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
// react-native's own SafeAreaView is a documented no-op on Android — only
// ever worked on iOS. This one actually applies the device's real inset.
import { SafeAreaView } from 'react-native-safe-area-context';
import PropTypes from 'prop-types';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';

/**
 * Screen Container Component
 * Wraps screen content with consistent 16px horizontal padding
 */
export default function ScreenContainer({
  children,
  scrollable = false,
  horizontalPadding = SPACING.screenHorizontal,
  verticalPadding = 0,
  backgroundColor = COLORS.background,
}) {
  const containerStyle = [
    styles.container,
    {
      backgroundColor,
      paddingHorizontal: horizontalPadding,
      paddingVertical: verticalPadding,
    },
  ];

  if (scrollable) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={containerStyle}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={containerStyle}>{children}</View>
    </SafeAreaView>
  );
}

ScreenContainer.propTypes = {
  children: PropTypes.node.isRequired,
  scrollable: PropTypes.bool,
  horizontalPadding: PropTypes.number,
  verticalPadding: PropTypes.number,
  backgroundColor: PropTypes.string,
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
});