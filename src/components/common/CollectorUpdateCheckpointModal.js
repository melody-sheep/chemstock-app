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

  useEffect(() => {
    if (visible) {
      setLabel('');
      getFrequentLandmarks(6).then(setSuggestions);
    }
  }, [visible]);

  const handleConfirm = () => {
    const trimmed = label.trim();
    if (!trimmed || isSubmitting) return;
    onConfirm(trimmed);
  };

  return (
    <CustomModal visible={visible} onClose={onClose} height="auto" maxHeight={520}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Icon name="location" size={20} color={COLORS.primary} weight="fill" />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Update Checkpoint</Text>
          <Text style={styles.subtitle}>Where are you now? Type or pick a nearby landmark.</Text>
        </View>
      </View>

      <View style={styles.inputRow}>
        <Icon name="location" size={18} color={COLORS.textSecondary} />
        <TextInput
          style={styles.input}
          value={label}
          onChangeText={setLabel}
          placeholder="e.g. Iponan Market"
          placeholderTextColor={COLORS.textTertiary}
          returnKeyType="done"
          onSubmitEditing={handleConfirm}
        />
        {!!label && (
          <Pressable onPress={() => setLabel('')} hitSlop={8} accessibilityLabel="Clear landmark">
            <Icon name="xCircle" size={18} color={COLORS.textTertiary} />
          </Pressable>
        )}
      </View>

      {suggestions.length > 0 && (
        <>
          <Text style={styles.recentLabel}>Recent</Text>
          <View style={styles.chips}>
            {suggestions.map((suggestion) => {
              const isSelected = suggestion === label.trim();
              return (
                <Pressable
                  key={suggestion}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() => setLabel(suggestion)}
                >
                  <Icon name="clock" size={12} color={isSelected ? '#FFFFFF' : COLORS.textSecondary} />
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]} numberOfLines={1}>
                    {suggestion}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      <View style={styles.buttonRow}>
        <Button
          title="Cancel"
          variant="outline"
          onPress={onClose}
          hasShadow={false}
          disabled={isSubmitting}
          height={44}
          fontSize={15}
          style={styles.button}
        />
        <Button
          title={isSubmitting ? 'Updating…' : 'Update'}
          variant="black"
          onPress={handleConfirm}
          disabled={!label.trim() || isSubmitting}
          height={44}
          fontSize={15}
          style={styles.button}
        />
      </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  subtitle: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: '#DBE4EE',
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    backgroundColor: '#F8FAFC',
  },
  input: {
    flex: 1,
    height: 44,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: '#272632',
  },
  recentLabel: {
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DBE4EE',
    backgroundColor: '#FFFFFF',
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    flexShrink: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: '#272632',
  },
  chipTextSelected: { color: '#FFFFFF' },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  button: { flex: 1, width: 'auto' },
});
