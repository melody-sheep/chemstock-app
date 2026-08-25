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
  label = 'Take Photo of\nWaybill/Invoice',
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
          <Icon name="camera" size={22} color={COLORS.primary} />
        </View>
        <Icon
          name={photoUri ? 'checkCircle' : 'xCircle'}
          size={20}
          color={photoUri ? COLORS.success : COLORS.error}
          weight="duotone"
          style={styles.statusIcon}
        />
        <Text style={styles.text}>
          {label} <Text style={styles.requiredAsterisk}>*</Text>
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
          <Icon name="document" size={20} color={COLORS.textSecondary} />
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

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  cameraPanel: {
    width: 48,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E5E5E5',
  },
  statusIcon: {
    marginLeft: SPACING.sm,
  },
  text: {
    flex: 1,
    paddingVertical: SPACING.sm,
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
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  viewText: {
    marginTop: 2,
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
  },
});
