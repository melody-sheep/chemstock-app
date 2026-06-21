// src/components/common/WarningSection.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import Icon from './Icon';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * WarningSection - RED theme, no background frame
 * Clean, minimal design
 */
export default function WarningSection({ 
  title = 'Warning',
  description = 'This will set up your device for manager access. Only continue if you\'re authorized to manage this branch.'
}) {
  return (
    <View style={styles.container}>
      <Icon name="warningTriangle" size={26} color={COLORS.error} />
      <Text style={styles.titleText}>{title}</Text>
      <Text style={styles.descriptionText}>{description}</Text>
    </View>
  );
}

WarningSection.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
};

WarningSection.defaultProps = {
  title: 'Warning',
  description: 'This will set up your device for manager access. Only continue if you\'re authorized to manage this branch.',
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: SPACING.lg,
  },
  titleText: {
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.error,
    marginTop: 2,
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  descriptionText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: SPACING.md,
  },
});