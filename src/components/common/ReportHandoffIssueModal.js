// src/components/common/ReportHandoffIssueModal.js
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Image } from 'react-native';
import PropTypes from 'prop-types';
import CustomModal from './Modal';
import Button from './Button';
import Icon from './Icon';
import CameraCaptureModal from './CameraCaptureModal';
import KeyboardAwareScrollView from './KeyboardAwareScrollView';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const REASON_OPTIONS = [
  { key: 'damaged_qr', label: 'QR label damaged' },
  { key: 'missing_qr', label: 'QR label missing' },
  { key: 'wrong_items', label: 'Wrong items received' },
  { key: 'not_received', label: 'Did not receive stock' },
  { key: 'other', label: 'Other issue' },
];

/**
 * ReportHandoffIssueModal - SR-side dispute sheet. Picks a structured
 * reason (one of 5), optional photo, optional free-text note. Submission
 * is handled by the caller — this just collects the payload.
 */
export default function ReportHandoffIssueModal({
  visible,
  onCancel,
  onSubmit,
  isSubmitting = false,
}) {
  const [reasonCode, setReasonCode] = useState(null);
  const [note, setNote] = useState('');
  const [photoUri, setPhotoUri] = useState(null);
  const [isCameraVisible, setIsCameraVisible] = useState(false);

  const reset = () => {
    setReasonCode(null);
    setNote('');
    setPhotoUri(null);
    setIsCameraVisible(false);
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  const handleSubmit = async () => {
    if (!reasonCode || isSubmitting) return;
    const reasonLabel = REASON_OPTIONS.find((r) => r.key === reasonCode)?.label || reasonCode;
    const submitted = await onSubmit({
      reasonCode,
      reason: note.trim() || reasonLabel,
      photoUri,
    });
    if (submitted) reset();
  };

  return (
    <>
      <CustomModal visible={visible} onClose={handleCancel} height="auto">
        <KeyboardAwareScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.iconWrap}>
            <View style={styles.iconCircle}>
              <Icon name="sealWarning" size={26} color={COLORS.error} />
            </View>
          </View>

          <Text style={styles.title}>Report an Issue</Text>
          <Text style={styles.description}>
            Pick the reason so your manager can investigate.
          </Text>

          <View style={styles.reasonsList}>
            {REASON_OPTIONS.map((option) => {
              const isSelected = option.key === reasonCode;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.reasonRow, isSelected && styles.reasonRowSelected]}
                  onPress={() => setReasonCode(option.key)}
                  activeOpacity={0.7}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                >
                  <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[styles.reasonText, isSelected && styles.reasonTextSelected]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Photo evidence (optional)</Text>
          {photoUri ? (
            <TouchableOpacity
              style={styles.photoPreviewWrap}
              onPress={() => setIsCameraVisible(true)}
              activeOpacity={0.85}
            >
              <Image source={{ uri: photoUri }} style={styles.photoPreview} />
              <View style={styles.photoBadge}>
                <Icon name="camera" size={14} color="#FFFFFF" />
                <Text style={styles.photoBadgeText}>Retake</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.photoAddWrap}
              onPress={() => setIsCameraVisible(true)}
              activeOpacity={0.85}
            >
              <Icon name="camera" size={22} color={COLORS.textSecondary} />
              <Text style={styles.photoAddText}>Tap to add a photo</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.label}>Note (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Add anything the manager should know…"
            placeholderTextColor={COLORS.textTertiary}
            value={note}
            onChangeText={setNote}
            maxLength={300}
            multiline
            numberOfLines={3}
          />

          <Button
            title={isSubmitting ? 'Submitting…' : 'Submit Report'}
            variant="fill"
            accentColor={COLORS.error}
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting || !reasonCode}
            height={48}
            fontSize={15}
            style={styles.submitButton}
          />
          <TouchableOpacity
            onPress={handleCancel}
            disabled={isSubmitting}
            style={styles.cancelLink}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </KeyboardAwareScrollView>
      </CustomModal>

      <CameraCaptureModal
        visible={isCameraVisible}
        onClose={() => setIsCameraVisible(false)}
        onCapture={setPhotoUri}
      />
    </>
  );
}

ReportHandoffIssueModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onCancel: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  isSubmitting: PropTypes.bool,
};

const styles = StyleSheet.create({
  content: { alignItems: 'center' },
  iconWrap: { marginBottom: SPACING.sm },
  iconCircle: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.error + '1A',
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  description: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  reasonsList: { alignSelf: 'stretch', gap: 6, marginBottom: SPACING.md },
  reasonRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm,
    borderRadius: 8, borderWidth: 1, borderColor: COLORS.borderSubtle,
    backgroundColor: '#FFFFFF',
  },
  reasonRowSelected: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.error + '0D',
  },
  radioOuter: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#C0C0C0',
    alignItems: 'center', justifyContent: 'center',
  },
  radioOuterSelected: { borderColor: COLORS.error },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.error },
  reasonText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: COLORS.textPrimary,
  },
  reasonTextSelected: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
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
  photoAddWrap: {
    alignSelf: 'stretch',
    height: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#C8D2DC',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: SPACING.md,
  },
  photoAddText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: COLORS.textSecondary,
  },
  photoPreviewWrap: {
    alignSelf: 'stretch',
    height: 140,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    backgroundColor: '#F1F5F9',
  },
  photoPreview: { width: '100%', height: '100%' },
  photoBadge: {
    position: 'absolute', bottom: SPACING.sm, right: SPACING.sm,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING.sm, paddingVertical: 4,
    borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.6)',
  },
  photoBadgeText: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: '#FFFFFF',
  },
  input: {
    alignSelf: 'stretch',
    borderWidth: 1, borderColor: COLORS.borderSubtle, borderRadius: 8,
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textPrimary,
    minHeight: 70, textAlignVertical: 'top',
    marginBottom: SPACING.md,
  },
  submitButton: { width: '100%', marginBottom: SPACING.sm },
  cancelLink: { paddingVertical: SPACING.sm },
  cancelText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: COLORS.textSecondary,
  },
});
