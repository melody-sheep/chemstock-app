// src/components/common/SaveableQRCode.js
import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import PropTypes from 'prop-types';
import QRCode from 'react-native-qrcode-svg';
// /legacy: the new default APIs (File/Paths, Asset.create()) need native
// modules Expo Go doesn't ship yet ("...Next"), while /legacy is backed by
// the modules Expo Go has always bundled — same reasoning as elsewhere in
// this app (ReceiveStockPreviewScreen originally, now here).
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library/legacy';
import Button from './Button';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * SaveableQRCode - renders a QR code plus a "Save to Gallery" action.
 *
 * KNOWN LIMITATION: Save to Gallery does not work under plain Expo Go —
 * Expo itself blocks full media-library access there ("create a
 * development build" is its own error message, not something app code can
 * work around). This code is believed correct for whenever a real dev
 * build exists, but is genuinely untested beyond that point.
 */
export default function SaveableQRCode({ value, size = 200, showValueText = true, style = {} }) {
  const qrRef = useRef(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveToGallery = () => {
    if (!qrRef.current) return;
    setIsSaving(true);

    qrRef.current.toDataURL(async (dataURL) => {
      try {
        // Scoped to write-only + photo — the unscoped call requests
        // photo+video+audio by default, and Expo Go's shared manifest
        // doesn't declare audio access, which rejects the whole request.
        const { status } = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
        if (status !== 'granted') {
          Alert.alert('Permission Needed', 'Allow photo access to save the QR code.');
          return;
        }

        const base64 = dataURL.includes(',') ? dataURL.split(',')[1] : dataURL;
        const fileUri = FileSystem.cacheDirectory + `chemstock-qr-${value}.png`;
        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        await MediaLibrary.createAssetAsync(fileUri);
        Alert.alert('Saved', 'QR code saved to your photos.');
      } catch (error) {
        console.error('❌ [SaveableQRCode] Save to gallery failed:', error);
        Alert.alert('Failed to Save', 'Could not save the QR code to your photos.');
      } finally {
        setIsSaving(false);
      }
    });
  };

  return (
    <View style={[styles.card, style]}>
      <QRCode value={value} size={size} getRef={(c) => (qrRef.current = c)} />
      {showValueText && <Text style={styles.codeText}>{value}</Text>}
      <Button
        title={isSaving ? 'Saving…' : 'Save to Gallery'}
        variant="outline"
        onPress={handleSaveToGallery}
        loading={isSaving}
        disabled={isSaving}
        style={styles.saveButton}
      />
    </View>
  );
}

SaveableQRCode.propTypes = {
  value: PropTypes.string.isRequired,
  size: PropTypes.number,
  showValueText: PropTypes.bool,
  style: PropTypes.object,
};

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  codeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  saveButton: {
    width: '100%',
  },
});
