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
}) {
  return (
    <CustomModal visible={visible} onClose={onCancel} height={300}>
      <View style={styles.iconWrap}>
        <Icon name={icon} size={32} color={COLORS.error} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

      <Button title={confirmLabel} variant="black" onPress={onConfirm} style={styles.confirmButton} />
      <Button title={cancelLabel} variant="outline" onPress={onCancel} hasShadow={false} />
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
};

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.lg,
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
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  confirmButton: {
    marginBottom: SPACING.sm,
  },
});
