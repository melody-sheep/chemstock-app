// src/components/common/Stepper.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * Stepper - Custom connected step indicator
 * - Line with dots on both ends (30px width for line + dots)
 * - Line color = GRAY (#C0C0C0), weight: 2px
 * - Active dot = PURE GREEN (no white dot)
 * - Inactive dot = HOLLOW GRAY
 * - Left aligned with SPACING.lg margin
 */
export default function Stepper({ 
  currentStep = 1, 
  step1Label = 'Enter your activation key',
  step2Label = 'Set up your account'
}) {
  const isStep1Active = currentStep === 1;
  const isStep2Active = currentStep === 2;

  return (
    <View style={styles.container}>
      {/* Label - Left aligned, semibold, full width */}
      <Text style={styles.labelText}>
        Step {currentStep} of 2: {currentStep === 1 ? step1Label : step2Label}
      </Text>
      
      {/* Step Indicators - Line with dots on both ends, 30px total width */}
      <View style={styles.stepIndicators}>
        {/* Step 1 Dot - PURE GREEN when active */}
        <View style={[
          styles.dot,
          isStep1Active ? styles.dotActive : styles.dotInactive
        ]} />
        
        {/* Connecting Line - 2px weight, GRAY */}
        <View style={styles.line} />
        
        {/* Step 2 Dot - Hollow when inactive */}
        <View style={[
          styles.dot,
          isStep2Active ? styles.dotActive : styles.dotInactive
        ]} />
      </View>
    </View>
  );
}

Stepper.propTypes = {
  currentStep: PropTypes.oneOf([1, 2]),
  step1Label: PropTypes.string,
  step2Label: PropTypes.string,
};

Stepper.defaultProps = {
  currentStep: 1,
  step1Label: 'Enter your activation key',
  step2Label: 'Set up your account',
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.xs,
  },
  labelText: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textPrimary,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  stepIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 30, // 30px total width for line + dots
    height: 16,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    zIndex: 2,
  },
  dotActive: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.success, // PURE GREEN - NO WHITE DOT
  },
  dotInactive: {
    borderColor: '#C0C0C0',
    backgroundColor: 'transparent',
  },
  line: {
    flex: 1,
    height: 2, // 2px weight
    backgroundColor: '#C0C0C0', // GRAY - uncolored
    marginHorizontal: -1, // Pull line under dots
    zIndex: 1,
  },
});