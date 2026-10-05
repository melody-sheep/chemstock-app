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
}) {
  return (
    <CustomModal visible={visible} onClose={onCancel} height={height}>
      <View style={styles.iconWrap}>
        <View style={styles.iconCircle}>
          <Icon name={icon} size={22} color={COLORS.error} />
        </View>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

      <Button
        title={confirmLabel}
        variant="black"
        onPress={onConfirm}
        height={44}
        fontSize={15}
        style={styles.confirmButton}
      />
      <Button
        title={cancelLabel}
        variant="outline"
        onPress={onCancel}
        height={44}
        fontSize={15}
        hasShadow={false}
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
};

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.error + '1A',
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  description: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: SPACING.md,
  },
  confirmButton: {
    marginBottom: SPACING.sm,
  },
});
