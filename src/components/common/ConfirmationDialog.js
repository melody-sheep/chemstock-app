// src/components/common/ConfirmationDialog.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import CustomModal from './Modal';
import Button from './Button';
import Icon from './Icon';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * ConfirmationDialog - "are you sure?" bottom-sheet for actions that need a
 * warning-style confirm step (icon + title + description) before proceeding.
 * A plain Alert.alert can't render a custom icon/colors, so this exists for
 * flows that want the same warning look WarningSection uses, on demand
 * instead of sitting permanently in the layout.
 */
export default function ConfirmationDialog({
  visible,
  onCancel,
  onConfirm,
  icon = 'warningTriangle',
  title = 'Notice',
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  height = 'auto',
  variant = 'sheet',
  destructive = false,
}) {
  return (
    <CustomModal visible={visible} onClose={onCancel} height={height} variant={variant}>
      {variant === 'sheet' && <View style={styles.handle} />}
      <View style={styles.iconWrap}>
        <View style={styles.iconRing}>
          <View style={styles.iconCircle}>
            <Icon name={icon} size={28} color={COLORS.error} />
          </View>
        </View>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

      <Button
        title={confirmLabel}
        variant={destructive ? 'fill' : 'black'}
        accentColor={destructive ? COLORS.error : undefined}
        onPress={onConfirm}
        height={52}
        fontSize={16}
        borderRadius={26}
        style={[styles.confirmButton, styles.fullWidthButton]}
      />
      <Button
        title={cancelLabel}
        variant="outline"
        onPress={onCancel}
        height={52}
        fontSize={16}
        borderRadius={26}
        hasShadow={false}
        style={styles.fullWidthButton}
      />
    </CustomModal>
  );
}

ConfirmationDialog.propTypes = {
  visible: PropTypes.bool.isRequired,
  onCancel: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  icon: PropTypes.string,
  title: PropTypes.string,
  description: PropTypes.string.isRequired,
  confirmLabel: PropTypes.string,
  cancelLabel: PropTypes.string,
  height: PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf(['auto'])]),
  variant: PropTypes.oneOf(['sheet', 'center']),
  destructive: PropTypes.bool,
};

const styles = StyleSheet.create({
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#DADDE3', marginTop: -8, marginBottom: SPACING.md },
  iconWrap: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  // Soft ring around the icon, like the app's message dialogs.
  iconRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.error + '14',
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.error + '26',
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  description: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.sm,
  },
  confirmButton: {
    marginBottom: SPACING.sm,
  },
  // Button's own default width is a hardcoded screen-width calculation,
  // which assumes it's always sitting in a full-width bottom sheet — that
  // breaks the 'center' variant's narrower, fixed-max-width dialog box,
  // where it made both buttons wider than the box itself (overlapping it
  // and each other). Filling the parent's actual width instead works
  // correctly in both variants.
  fullWidthButton: {
    width: '100%',
  },
});
