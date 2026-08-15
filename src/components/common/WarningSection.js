// src/components/common/WarningSection.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import Icon from './Icon';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * WarningSection - RED theme warning/notice callout.
 * - `variant="centered"` (default): big icon, stacked title + description,
 *   no background frame. Used on full-width bottom warnings (e.g. activation).
 * - `variant="banner"`: bordered, tinted, left-aligned inline row — a more
 *   compact notice for form flows (e.g. "you're about to register a batch").
 */
export default function WarningSection({
  title = 'Warning',
  description = 'This will set up your device for manager access. Only continue if you\'re authorized to manage this branch.',
  variant = 'centered',
  icon = 'warningTriangle',
}) {
  if (variant === 'banner') {
    return (
      <View style={styles.bannerContainer}>
        <Icon name={icon} size={15} color={COLORS.error} />
        <Text style={styles.bannerText}>
          <Text style={styles.bannerTitle}>{title}: </Text>
          {description}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Icon name={icon} size={26} color={COLORS.error} />
      <Text style={styles.titleText}>{title}</Text>
      <Text style={styles.descriptionText}>{description}</Text>
    </View>
  );
}

WarningSection.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  variant: PropTypes.oneOf(['centered', 'banner']),
  icon: PropTypes.string,
};

WarningSection.defaultProps = {
  title: 'Warning',
  description: 'This will set up your device for manager access. Only continue if you\'re authorized to manage this branch.',
  variant: 'centered',
  icon: 'warningTriangle',
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
  bannerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.error + '10',
    borderWidth: 1,
    borderColor: COLORS.error + '40',
    borderRadius: 8,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  bannerText: {
    flex: 1,
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.error,
    lineHeight: 14,
  },
  bannerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
});