// src/components/common/PhotoProofCard.js
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import Icon from './Icon';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

// Photo Proof card matching Receive Stock: the captured photo with an expand badge that
// opens the full-size viewer, then a "From … to …" line. The viewer is owned by the screen.
export default function PhotoProofCard({ photoUri, onView, fromLabel, toName }) {
  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.imageWrap}
        onPress={onView}
        activeOpacity={0.85}
        accessibilityLabel="View full-size photo"
        accessibilityRole="button"
      >
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.empty}>
            <Icon name="camera" size={28} color={COLORS.textSecondary} />
          </View>
        )}
        <View style={styles.expandBadge}>
          <Icon name="expand" size={14} color={COLORS.textWhite} />
        </View>
      </TouchableOpacity>

      {(fromLabel || toName) && (
        <View style={styles.recipientRow}>
          <Text style={styles.recipientLabel}>{fromLabel}</Text>
          <Text style={styles.recipientName}>{toName}</Text>
        </View>
      )}
    </View>
  );
}

PhotoProofCard.propTypes = {
  photoUri: PropTypes.string,
  onView: PropTypes.func.isRequired,
  fromLabel: PropTypes.string,
  toName: PropTypes.string,
};

PhotoProofCard.defaultProps = {
  photoUri: null,
  fromLabel: undefined,
  toName: undefined,
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    backgroundColor: COLORS.textWhite,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  imageWrap: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: COLORS.background,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandBadge: {
    position: 'absolute',
    bottom: SPACING.sm,
    right: SPACING.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.textPrimary + '80',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipientRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  recipientLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  recipientName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textPrimary,
  },
});
