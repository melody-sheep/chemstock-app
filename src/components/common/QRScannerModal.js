// src/components/common/QRScannerModal.js
import React, { useRef, useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
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
const FRAME_SIZE = 240;

export default function QRScannerModal({ visible, onClose, onScanned }) {
  const [permission, requestPermission] = useCameraPermissions();
  const hasScannedRef = useRef(false);
  // Full physical window size (not the SafeAreaView-shrunk content box) so
  // the frame's position below is computed against the real screen — see
  // the comment above the overlay JSX for why that distinction matters.
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const frameTop = Math.round((windowHeight - FRAME_SIZE) / 2);
  const frameLeft = Math.round((windowWidth - FRAME_SIZE) / 2);

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
      <View style={styles.container}>
        {permission?.granted ? (
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarcodeScanned}
            />
            {/*
              Deliberately NOT flex-centered: a flex layout centers within
              whatever box contains it, and both SafeAreaView's inset-shrunk
              box and this plain View's box can end up shorter/taller than
              the true physical screen depending on platform, so the "center
              of the box" drifts from the "center of the screen" (that's why
              this frame kept landing at the bottom, then the top). Instead
              every piece below is placed with absolute top/left computed
              from useWindowDimensions() — the real screen size — so the
              frame always lands at the actual visual center.
            */}
            <View style={styles.overlay} pointerEvents="none">
              <View style={[styles.mask, { top: 0, left: 0, right: 0, height: frameTop }]} />
              <View style={[styles.mask, { top: frameTop + FRAME_SIZE, left: 0, right: 0, bottom: 0 }]} />
              <View style={[styles.mask, { top: frameTop, left: 0, width: frameLeft, height: FRAME_SIZE }]} />
              <View style={[styles.mask, { top: frameTop, left: frameLeft + FRAME_SIZE, right: 0, height: FRAME_SIZE }]} />

              <View style={[styles.scanFrame, { top: frameTop, left: frameLeft }]}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>

              <Text style={[styles.hintText, { top: frameTop + FRAME_SIZE + SPACING.xl, left: 0, right: 0 }]}>
                Point the camera at a batch QR code
              </Text>
            </View>
            <SafeAreaView style={styles.topBar} pointerEvents="box-none">
              <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityLabel="Close scanner">
                <Icon name="xCircle" size={28} color="#FFFFFF" weight="fill" />
              </TouchableOpacity>
            </SafeAreaView>
          </>
        ) : (
          <SafeAreaView style={styles.permissionWrap}>
            <Icon name="qrCode" size={40} color={COLORS.textSecondary} />
            <Text style={styles.permissionText}>Camera access is required to scan QR codes.</Text>
            <Button title="Grant Camera Access" onPress={requestPermission} style={styles.permissionButton} />
            <Button title="Cancel" variant="outline" onPress={onClose} hasShadow={false} />
          </SafeAreaView>
        )}
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
  container: { flex: 1, backgroundColor: '#000000' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  mask: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  scanFrame: {
    position: 'absolute',
    width: FRAME_SIZE,
    height: FRAME_SIZE,
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: COLORS.secondary,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 16,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 16,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 16,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 16,
  },
  hintText: {
    position: 'absolute',
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: '#FFFFFF',
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    padding: SPACING.md,
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
