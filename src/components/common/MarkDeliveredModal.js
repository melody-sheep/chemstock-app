// src/components/common/MarkDeliveredModal.js
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import PropTypes from 'prop-types';
import CustomModal from './Modal';
import Button from './Button';
import Icon from './Icon';
import BrandedQRCode from './BrandedQRCode';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * MarkDeliveredModal - confirmation sheet the Collector sees when they tap
 * "Mark Delivered" on a delivery. Captures the current GPS preview (already
 * resolved by the caller) and an optional note, then hands both back on
 * confirm. The actual finish_delivery_leg call is the caller's job — this
 * is UI only.
 */
export default function MarkDeliveredModal({
  visible,
  onCancel,
  onConfirm,
  recipientName,
  coords,
  qrCode,
  isSubmitting = false,
  isConfirmed = false,
}) {
  const [note, setNote] = useState('');

  const handleConfirm = () => {
    onConfirm(note.trim() || null);
  };

  const handleCancel = () => {
    setNote('');
    onCancel();
  };

  const handleDone = () => {
    setNote('');
    onCancel();
  };

  return (
    <CustomModal visible={visible} onClose={handleCancel} height="auto">
      <View style={styles.content}>
        {isConfirmed ? (
          <>
            <View style={styles.iconWrap}>
              <View style={styles.iconCircle}>
                <Icon name="sealCheck" size={26} color={COLORS.success} />
              </View>
            </View>

            <Text style={styles.title}>Delivered!</Text>
            <Text style={styles.description}>
              Have {recipientName || 'the Sales Rep'} scan this QR — or the QR on the physical package — to confirm receipt.
            </Text>

            {qrCode ? (
              <View style={styles.qrTile}>
                <BrandedQRCode value={qrCode} size={200} />
              </View>
            ) : (
              <Text style={styles.qrMissingText}>QR code unavailable. The Sales Rep can scan the package label.</Text>
            )}

            {qrCode ? <Text style={styles.qrHint}>Both QRs are the same code.</Text> : null}

            <Button
              title="Done"
              variant="black"
              onPress={handleDone}
              height={48}
              fontSize={15}
              style={styles.confirmButton}
            />
          </>
        ) : (
          <>
            <View style={styles.iconWrap}>
              <View style={styles.iconCircle}>
                <Icon name="sealCheck" size={26} color={COLORS.success} />
              </View>
            </View>

            <Text style={styles.title}>Mark as Delivered?</Text>
            <Text style={styles.description}>
              Confirm you have delivered this stock to {recipientName || 'the Sales Rep'}.
            </Text>

            <View style={styles.gpsBox}>
              <Icon name="location" size={16} color={COLORS.error} />
              <Text style={styles.gpsText}>
                {coords
                  ? `Your location: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`
                  : 'Locating your device…'}
              </Text>
            </View>

            <Text style={styles.label}>Note (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Left with housemate, left at front desk…"
              placeholderTextColor={COLORS.textTertiary}
              value={note}
              onChangeText={setNote}
              maxLength={200}
              multiline
              numberOfLines={2}
            />

            <Button
              title={isSubmitting ? 'Marking…' : 'Confirm Delivered'}
              variant="black"
              onPress={handleConfirm}
              loading={isSubmitting}
              disabled={isSubmitting || !coords}
              height={48}
              fontSize={15}
              style={styles.confirmButton}
            />
            <TouchableOpacity
              onPress={handleCancel}
              disabled={isSubmitting}
              style={styles.cancelLink}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </CustomModal>
  );
}

MarkDeliveredModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onCancel: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  recipientName: PropTypes.string,
  coords: PropTypes.shape({
    latitude: PropTypes.number.isRequired,
    longitude: PropTypes.number.isRequired,
  }),
  qrCode: PropTypes.string,
  isSubmitting: PropTypes.bool,
  isConfirmed: PropTypes.bool,
};

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
  },
  iconWrap: {
    marginBottom: SPACING.sm,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success + '1A',
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  description: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },
  gpsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    alignSelf: 'stretch',
    padding: SPACING.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    backgroundColor: '#F8FAFC',
    marginBottom: SPACING.md,
  },
  gpsText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: COLORS.textSecondary,
  },
  label: {
    alignSelf: 'flex-start',
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textTertiary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
  },
  input: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: 8,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textPrimary,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: SPACING.md,
  },
  confirmButton: {
    width: '100%',
    marginBottom: SPACING.sm,
  },
  cancelLink: {
    paddingVertical: SPACING.sm,
  },
  cancelText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
  },
  qrTile: {
    padding: SPACING.md,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    marginBottom: SPACING.sm,
  },
  qrHint: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textTertiary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  qrMissingText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: COLORS.warning,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
});
