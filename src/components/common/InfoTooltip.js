// src/components/common/InfoTooltip.js
import React, { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../styles/typography';
import { SPACING } from '../../styles/spacing';

/**
 * InfoTooltip - small red "?" badge. Tapping it shows a short explanatory
 * message in a lightweight centered popup, dismissed by tapping outside it
 * or the "Got it" button. Built on React Native's own Modal (not a
 * ScrollView/gap-based layout) specifically to avoid the Android stacking
 * issues BranchSelector hit earlier tonight.
 */
export default function InfoTooltip({ message, size = 16 }) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setVisible(true)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="More info"
      >
        <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={[styles.badgeText, { fontSize: size * 0.65 }]}>?</Text>
        </View>
      </Pressable>

      <Modal visible={visible} transparent animationType="none" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <Pressable style={styles.card} onPress={() => {}}>
            <Text style={styles.message}>{message}</Text>
            <Pressable style={styles.closeButton} onPress={() => setVisible(false)} hitSlop={8}>
              <Text style={styles.closeButtonText}>Got it</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

InfoTooltip.propTypes = {
  message: PropTypes.string.isRequired,
  size: PropTypes.number,
};

const styles = StyleSheet.create({
  badge: {
    backgroundColor: COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    padding: SPACING.lg,
    maxWidth: 320,
    width: '100%',
  },
  message: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textPrimary,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  closeButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  closeButtonText: {
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
});
