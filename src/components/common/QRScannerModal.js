// src/components/common/QRScannerModal.js
import React, { useRef, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Icon from './Icon';
import Button from './Button';
import { logEvent } from '../../utils/logger';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const FRAME_SIZE = 260;
const CORNER_SIZE = 36;
const CORNER_WIDTH = 4;

// In-app QR scanner with a white corner frame, so it matches ChemStock rather than the
// platform scanner UI (which draws its own branding and labels we can't change).
export default function QRScannerModal({ visible, onClose, onScanned }) {
  const [permission, requestPermission] = useCameraPermissions();
  const hasScannedRef = useRef(false);
  const [isTorchOn, setIsTorchOn] = useState(false);

  const handleBarcodeScanned = ({ data, type }) => {
    if (hasScannedRef.current) return;
    hasScannedRef.current = true;
    logEvent('QRScanner', 'scanned', { type });
    onScanned(data);
    onClose();
  };

  const handleShow = () => {
    hasScannedRef.current = false;
    setIsTorchOn(false);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onShow={handleShow} onRequestClose={onClose}>
      <View style={styles.container}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={isTorchOn}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={visible ? handleBarcodeScanned : undefined}
          />
        ) : null}

        <View style={styles.topBar}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close scanner">
            <Icon name="xCircle" size={28} color={COLORS.textWhite} />
          </TouchableOpacity>
          <Text style={styles.title}>Scan QR Code</Text>
          {permission?.granted ? (
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsTorchOn((on) => !on)}
              accessibilityRole="button"
              accessibilityLabel={isTorchOn ? 'Turn flashlight off' : 'Turn flashlight on'}
            >
              <Icon name={isTorchOn ? 'flash' : 'flashOff'} size={24} color={COLORS.textWhite} />
            </TouchableOpacity>
          ) : (
            <View style={styles.closeButton} />
          )}
        </View>

        <View style={styles.centerArea}>
          {permission?.granted ? (
            <View style={styles.frame}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
          ) : (
            <View style={styles.permissionBox}>
              <Text style={styles.permissionText}>ChemStock needs camera access to scan QR codes.</Text>
              <Button title="Allow Camera" variant="fill" accentColor={COLORS.primary} onPress={requestPermission} height={44} />
            </View>
          )}
        </View>

        {permission?.granted && <Text style={styles.hint}>Align the QR code within the frame</Text>}
      </View>
    </Modal>
  );
}

QRScannerModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onScanned: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.textPrimary,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING['3xl'],
    paddingHorizontal: SPACING.md,
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textWhite,
  },
  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: COLORS.textWhite,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderBottomRightRadius: 12,
  },
  hint: {
    paddingBottom: SPACING['3xl'],
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textWhite,
  },
  permissionBox: {
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  permissionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textWhite,
    textAlign: 'center',
  },
});
