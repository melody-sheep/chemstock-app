// src/components/common/Stepper.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * Stepper - Custom connected step indicator, generalized to N steps (was
 * hardcoded to 2 — ManagerActivationScreen only ever calls it with a bare
 * `currentStep`, so widening `labels` to an array and deriving step count
 * from its length is fully backward compatible with that usage).
 * - Line with dots between each step
 * - Line color = GRAY (#C0C0C0), weight: 2px
 * - Active dot = PURE GREEN (no white dot)
 * - Inactive dot = HOLLOW GRAY
 * - Left aligned with SPACING.lg margin
 */
export default function Stepper({
  currentStep = 1,
  labels = ['Enter your activation key', 'Set up your account'],
}) {
  const totalSteps = labels.length;

  return (
    <View style={styles.container}>
      <Text style={styles.labelText}>
        Step {currentStep} of {totalSteps}: {labels[currentStep - 1] || ''}
      </Text>

      <View style={[styles.stepIndicators, { width: totalSteps * 20 }]}>
        {labels.map((_, index) => {
          const step = index + 1;
          const isActive = step === currentStep;
          return (
            <React.Fragment key={step}>
              {index > 0 && <View style={styles.line} />}
              <View style={[styles.dot, isActive ? styles.dotActive : styles.dotInactive]} />
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

Stepper.propTypes = {
  currentStep: PropTypes.number,
  labels: PropTypes.arrayOf(PropTypes.string),
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
