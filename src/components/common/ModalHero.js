// src/components/common/ModalHero.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import Icon from './Icon';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * ModalHero - the top section of a decision modal.
 * Layout: header row (title left, inline icon right), subtle divider,
 * description, then an optional "you'll need" list card.
 *
 * @param {string} icon - Icon name (rendered inline next to the title)
 * @param {string} iconColor - Icon glyph color (default: amber)
 * @param {string} title - Modal headline
 * @param {string} description - One or two sentence explanation
 * @param {Array<{icon: string, label: string, hint?: string}>} infoItems
 *        Optional "what you'll need" list.
 */
export default function ModalHero({
  icon = 'warning',
  iconColor = '#B45309',
  title = '',
  description = '',
  infoItems = [],
}) {
  return (
    <View style={styles.container}>
      {/* Header row: title left, icon right */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <Icon name={icon} size={20} color={iconColor} />
      </View>

      {/* Subtle divider */}
      <View style={styles.divider} />

      {/* Description */}
      {!!description && <Text style={styles.description}>{description}</Text>}

      {/* Info items card */}
      {infoItems.length > 0 && (
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>You&apos;ll need</Text>
          {infoItems.map((item, index) => (
            <View
              key={index}
              style={[
                styles.infoRow,
                index < infoItems.length - 1 && styles.infoRowDivider,
              ]}
            >
              <View style={styles.infoIconWrap}>
                <Icon name={item.icon} size={16} color={COLORS.primary} />
              </View>
              <View style={styles.infoTextWrap}>
                <Text style={styles.infoLabel}>{item.label}</Text>
                {!!item.hint && <Text style={styles.infoHint}>{item.hint}</Text>}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

ModalHero.propTypes = {
  icon: PropTypes.string,
  iconColor: PropTypes.string,
  title: PropTypes.string,
  description: PropTypes.string,
  infoItems: PropTypes.arrayOf(
    PropTypes.shape({
      icon: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      hint: PropTypes.string,
    })
  ),
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  title: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
  },
  divider: {
    height: 1,
    backgroundColor: '#EEF1F4',
    marginBottom: SPACING.md,
  },
  description: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  infoCard: {
    alignSelf: 'stretch',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  infoCardTitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  infoRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F4',
  },
  infoIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  infoTextWrap: {
    flex: 1,
  },
  infoLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textPrimary,
  },
  infoHint: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});
