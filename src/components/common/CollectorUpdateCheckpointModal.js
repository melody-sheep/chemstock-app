// src/components/common/CollectorUpdateCheckpointModal.js
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import CustomModal from './Modal';
import Button from './Button';
import Icon from './Icon';
import { getFrequentLandmarks } from '../../utils/landmarkUsage';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * Event-triggered checkpoint update — the Collector's "Go to Next Stop"
 * modal. No geocoding/landmark-search API (this app avoids third-party map
 * APIs entirely, per the same reasoning as MapLocationPickerModal) — just a
 * free-text label plus an on-device "recently used" suggestion list.
 */
export default function CollectorUpdateCheckpointModal({ visible, onClose, onConfirm, isSubmitting = false }) {
  const [label, setLabel] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (visible) {
      setLabel('');
      setShowSuggestions(false);
      getFrequentLandmarks(6).then(setSuggestions);
    }
  }, [visible]);

  const handleConfirm = () => {
    const trimmed = label.trim();
    if (!trimmed || isSubmitting) return;
    onConfirm(trimmed);
  };

  return (
    <CustomModal visible={visible} onClose={onClose} height={showSuggestions ? 420 : 300}>
      <View style={styles.iconWrap}>
        <Icon name="location" size={32} color={COLORS.primary} weight="fill" />
      </View>
      <Text style={styles.title}>Update Checkpoint?</Text>
      <Text style={styles.subtitle}>Select or type your closest area landmark:</Text>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={label}
          onChangeText={setLabel}
          placeholder="e.g. Iponan Market"
          placeholderTextColor={COLORS.textTertiary}
        />
        {suggestions.length > 0 && (
          <Pressable
            style={styles.chevronButton}
            onPress={() => setShowSuggestions((prev) => !prev)}
            accessibilityLabel="Show recent landmarks"
          >
            <Icon name="caretDown" size={18} color={COLORS.textSecondary} />
          </Pressable>
        )}
      </View>

      {showSuggestions && (
        <View style={styles.suggestionsList}>
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion}
              style={styles.suggestionRow}
              onPress={() => {
                setLabel(suggestion);
                setShowSuggestions(false);
              }}
            >
              <Icon name="clock" size={14} color={COLORS.textSecondary} />
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <Button
        title={isSubmitting ? 'Updating…' : 'Update'}
        variant="black"
        onPress={handleConfirm}
        disabled={!label.trim() || isSubmitting}
        style={styles.confirmButton}
      />
      <Button title="Cancel" variant="outline" onPress={onClose} hasShadow={false} disabled={isSubmitting} />
    </CustomModal>
  );
}

CollectorUpdateCheckpointModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  isSubmitting: PropTypes.bool,
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
    color: '#272632',
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: '#DBE4EE',
    borderRadius: 12,
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.md,
  },
  input: {
    flex: 1,
    height: 46,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: '#272632',
  },
  chevronButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionsList: {
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 12,
    marginTop: -SPACING.sm,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  suggestionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: '#272632',
  },
  confirmButton: {
    marginBottom: SPACING.sm,
  },
});
