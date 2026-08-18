// src/components/common/QRScannerModal.js
import React, { useRef, useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PropTypes from 'prop-types';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Icon from './Icon';
import Button from './Button';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * QRScannerModal - full-screen camera in QR-scanning mode.
 * Fires onScanned(data) once per open (guarded by a ref, not state, so the
 * native camera event firing several times per second before the modal
 * closes can't queue up multiple callbacks).
 *
 * NOTE: this only decodes the QR — it does not yet check the scanned value
 * against receiving_batches.qr_code. That validation (and whatever should
 * happen on a real match) is a deliberate follow-up, not done here.
 */
export default function QRScannerModal({ visible, onClose, onScanned }) {
  const [permission, requestPermission] = useCameraPermissions();
  const hasScannedRef = useRef(false);

  useEffect(() => {
    if (visible) hasScannedRef.current = false;
  }, [visible]);

  const handleBarcodeScanned = (result) => {
    if (hasScannedRef.current) return;
    hasScannedRef.current = true;
    onScanned(result.data);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {permission?.granted ? (
          <>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarcodeScanned}
            />
            <View style={styles.overlay} pointerEvents="none">
              <View style={styles.scanFrame} />
              <Text style={styles.hintText}>Point the camera at a batch QR code</Text>
            </View>
            <View style={styles.topBar}>
              <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityLabel="Close scanner">
                <Icon name="xCircle" size={28} color="#FFFFFF" weight="fill" />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.permissionWrap}>
            <Icon name="qrCode" size={40} color={COLORS.textSecondary} />
            <Text style={styles.permissionText}>Camera access is required to scan QR codes.</Text>
            <Button title="Grant Camera Access" onPress={requestPermission} style={styles.permissionButton} />
            <Button title="Cancel" variant="outline" onPress={onClose} hasShadow={false} />
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

QRScannerModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onScanned: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  camera: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: 220,
    height: 220,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    borderRadius: 16,
  },
  hintText: {
    marginTop: SPACING.lg,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: '#FFFFFF',
  },
  topBar: {
    position: 'absolute',
    top: SPACING.md,
    left: SPACING.md,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: SPACING.md,
    backgroundColor: COLORS.background,
  },
  permissionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  permissionButton: { marginTop: SPACING.sm },
});
