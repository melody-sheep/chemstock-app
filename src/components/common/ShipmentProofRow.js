// src/components/common/ShipmentProofRow.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import Icon from './Icon';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * ShipmentProofRow - "take/retake photo" action row: a full-height camera
 * panel on the left, a duotone status icon (red X until a photo exists,
 * green check once it does), a label, and an optional "view" thumbnail
 * button once a photo has been captured. Used by both AddNewBatchesScreen
 * (initial capture) and ReceiveStockPreviewScreen (retake before final
 * submit) so the two never drift out of sync.
 */
export default function ShipmentProofRow({
  photoUri,
  onOpenCamera,
  onViewPhoto,
  // One line by default; once a photo is taken it says so (tap to retake).
  label = photoUri ? 'Waybill photo taken' : 'Take waybill photo',
}) {
  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.main}
        onPress={onOpenCamera}
        activeOpacity={0.7}
        accessibilityLabel={photoUri ? 'Retake waybill/invoice photo' : 'Take photo of waybill/invoice'}
        accessibilityRole="button"
      >
        <View style={styles.cameraPanel}>
          <Icon name="camera" size={22} color="#0085F9" />
        </View>
        <Icon
          name={photoUri ? 'checkCircle' : 'xCircle'}
          size={20}
          color={photoUri ? COLORS.success : COLORS.error}
          weight="duotone"
          style={styles.statusIcon}
        />
        <Text style={styles.text} numberOfLines={1}>
          {label}
          {!photoUri && <Text style={styles.requiredAsterisk}> *</Text>}
        </Text>
      </TouchableOpacity>

      {photoUri && onViewPhoto && (
        <TouchableOpacity
          style={styles.viewBox}
          onPress={onViewPhoto}
          activeOpacity={0.7}
          accessibilityLabel="View captured photo"
          accessibilityRole="button"
        >
          <Icon name="document" size={20} color="#0085F9" />
          <Text style={styles.viewText}>view</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

ShipmentProofRow.propTypes = {
  photoUri: PropTypes.string,
  onOpenCamera: PropTypes.func.isRequired,
  onViewPhoto: PropTypes.func,
  label: PropTypes.string,
};

// Blue dotted frame (as on the scan boxes) so it reads as something to press.
const PROOF_BLUE = '#0085F9';
const PROOF_BLUE_TINT = '#EAF4FF';
const ROW_HEIGHT = 56;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  main: {
    flex: 1,
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: PROOF_BLUE,
    borderStyle: 'dotted',
    borderRadius: 8,
    backgroundColor: PROOF_BLUE_TINT,
    overflow: 'hidden',
  },
  cameraPanel: {
    width: 48,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#B9D8FA',
  },
  statusIcon: {
    marginLeft: SPACING.sm,
  },
  text: {
    flex: 1,
    paddingLeft: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: '#272632',
  },
  requiredAsterisk: {
    color: COLORS.error,
  },
  viewBox: {
    width: ROW_HEIGHT,
    height: ROW_HEIGHT,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: PROOF_BLUE,
    borderStyle: 'dotted',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PROOF_BLUE_TINT,
  },
  viewText: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: PROOF_BLUE,
  },
});
