// src/components/common/SaveableQRCode.js
import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { View, Text, StyleSheet, Alert, Platform } from 'react-native';
import PropTypes from 'prop-types';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
// /legacy: the new default APIs (File/Paths, Asset.create()) need native
// modules Expo Go doesn't ship yet ("...Next"), while /legacy is backed by
// the modules Expo Go has always bundled — same reasoning as elsewhere in
// this app (ReceiveStockPreviewScreen originally, now here).
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import Button from './Button';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * SaveableQRCode - renders a QR code plus a "Save to Gallery" action.
 *
 * expo-media-library's full gallery-write access is blocked under plain
 * Expo Go (Expo removed it from Expo Go's bundled native modules in SDK 48
 * due to Play Store policy — a platform restriction, not something app
 * code can work around). Two fallbacks, in order, when that happens:
 *   1. Android's Storage Access Framework — the user picks a real folder
 *      (e.g. "Pictures") via the native picker and the file is written
 *      straight into it, so it actually shows up in Gallery. Not blocked
 *      in Expo Go since it's a different permission model than
 *      MediaLibrary's broad photo/video access.
 *   2. The native share sheet (expo-sharing) — always available as a last
 *      resort, but only *sends* the image to whatever app is chosen; it
 *      does not itself save a copy anywhere on the device.
 */
const SaveableQRCode = forwardRef(function SaveableQRCode(
  { value, size = 200, showValueText = true, style = {} },
  ref
) {
  const qrRef = useRef(null);
  const brandedCardRef = useRef(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Captures the hidden branded card below (CHEMSTOCK header, title, QR,
  // batch code, footer) instead of the bare QR — this is what every
  // Save/Share path shares now, so the file that lands on someone's phone
  // or in a chat always identifies itself, same copy as handlePrint's HTML.
  const getBrandedCardAsset = async () => {
    if (!brandedCardRef.current) {
      throw new Error('QR not ready');
    }
    const fileUri = await captureRef(brandedCardRef, { format: 'png', quality: 1 });
    const safeName = value.replace(/[^a-zA-Z0-9-_]/g, '_');
    return { fileUri, safeName };
  };

  // Bare-QR-only asset — still needed for handlePrint's embedded <img>,
  // which builds its own full-page branded layout in HTML/CSS directly.
  const getQrAsset = () => new Promise((resolve, reject) => {
    if (!qrRef.current) {
      reject(new Error('QR not ready'));
      return;
    }

    qrRef.current.toDataURL(async (dataURL) => {
      try {
        const base64 = dataURL.includes(',') ? dataURL.split(',')[1] : dataURL;
        const safeName = value.replace(/[^a-zA-Z0-9-_]/g, '_');
        const fileUri = FileSystem.cacheDirectory + `chemstock-qr-${safeName}.png`;
        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        resolve({ fileUri, base64, safeName });
      } catch (error) {
        reject(error);
      }
    });
  });

  const handleSaveToGallery = async () => {
    try {
      setIsSaving(true);
      const { fileUri, safeName } = await getBrandedCardAsset();

      try {
        // Scoped to write-only + photo — the unscoped call requests
        // photo+video+audio by default, and Expo Go's shared manifest
        // doesn't declare audio access, which rejects the whole request.
        const { status } = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
        if (status !== 'granted') {
          throw new Error('Photo permission not granted');
        }
        await MediaLibrary.createAssetAsync(fileUri);
        Alert.alert('Saved', 'QR code saved to your photos.');
        return;
      } catch (mediaLibraryError) {
        // Expected under Expo Go — MediaLibrary's full gallery-write
        // access isn't available there.
        console.warn('[WARN] [SaveableQRCode] MediaLibrary save failed:', mediaLibraryError);
      }

      if (Platform.OS === 'android') {
        try {
          const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (permissions.granted) {
            const base64 = await FileSystem.readAsStringAsync(fileUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            const safUri = await FileSystem.StorageAccessFramework.createFileAsync(
              permissions.directoryUri,
              `chemstock-qr-${safeName}`,
              'image/png'
            );
            await FileSystem.writeAsStringAsync(safUri, base64, {
              encoding: FileSystem.EncodingType.Base64,
            });
            Alert.alert('Saved', 'QR code saved to the folder you selected.');
            return;
          }
        } catch (safError) {
          console.warn('[WARN] [SaveableQRCode] Storage Access Framework save failed, falling back to share:', safError);
        }
      }

      // Last resort — sends the file to whatever app the user picks
      // rather than saving it directly, so tell them that up front.
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        throw new Error('No save method available on this device');
      }
      Alert.alert(
        'Direct Save Unavailable',
        'Pick an app below to send the QR code to (e.g. Files) — it will not be saved automatically.',
        [{ text: 'Continue', onPress: () => Sharing.shareAsync(fileUri, { mimeType: 'image/png', dialogTitle: 'Save QR Code' }) }]
      );
    } catch (error) {
      console.error('[ERROR] [SaveableQRCode] Save to gallery failed:', error);
      Alert.alert('Failed to Save', 'Could not save the QR code to your photos.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = async () => {
    try {
      setIsPrinting(true);
      const { base64 } = await getQrAsset();
      const printHtml = `
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              @page { size: letter; margin: 0.6in; }
              * { box-sizing: border-box; }
              body {
                margin: 0;
                background: #ffffff;
                color: #0f172a;
                font-family: -apple-system, Helvetica, Arial, sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                padding-top: 48px;
              }
              .brand {
                font-size: 13px;
                font-weight: 700;
                letter-spacing: 3px;
                text-transform: uppercase;
                color: #03045e;
              }
              .title {
                margin-top: 8px;
                font-size: 26px;
                font-weight: 700;
              }
              .qr {
                margin-top: 28px;
                padding: 20px;
                border: 1px solid #e2e8f0;
                border-radius: 16px;
              }
              .qr img {
                width: 300px;
                height: 300px;
                display: block;
              }
              .label {
                margin-top: 28px;
                font-size: 11px;
                font-weight: 600;
                letter-spacing: 1.5px;
                text-transform: uppercase;
                color: #64748b;
              }
              .code {
                margin-top: 6px;
                font-family: Menlo, Consolas, monospace;
                font-size: 18px;
                font-weight: 700;
                word-break: break-all;
                text-align: center;
              }
              .footer {
                margin-top: 36px;
                padding-top: 16px;
                border-top: 1px solid #e2e8f0;
                width: 100%;
                max-width: 420px;
                text-align: center;
                font-size: 12px;
                color: #64748b;
              }
            </style>
          </head>
          <body>
            <div class="brand">ChemStock</div>
            <div class="title">Batch QR Code</div>
            <div class="qr"><img src="data:image/png;base64,${base64}" alt="QR code" /></div>
            <div class="label">Batch code</div>
            <div class="code">${value}</div>
            <div class="footer">Scan with the ChemStock app to track this batch.</div>
          </body>
        </html>
      `;

      await Print.printAsync({ html: printHtml });
    } catch (error) {
      console.warn('[WARN] [SaveableQRCode] Print failed, falling back to share:', error);
      try {
        const { fileUri } = await getBrandedCardAsset();
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, { mimeType: 'image/png', dialogTitle: 'QR Code' });
          return;
        }
      } catch (shareError) {
        console.error('[ERROR] [SaveableQRCode] Share fallback failed:', shareError);
      }
      Alert.alert('Print Unavailable', 'This device could not open the print dialog. You can still save or share the QR code manually.');
    } finally {
      setIsPrinting(false);
    }
  };

  // Shares the QR as an actual PNG image via the native share sheet, not a
  // text message — the react-native-qrcode-svg ref this needs only exists
  // inside this component, so screens that render their own "Share" button
  // alongside <SaveableQRCode> call this through a ref instead of
  // reimplementing the toDataURL/file-write dance themselves.
  const handleShareAsImage = async () => {
    const { fileUri } = await getBrandedCardAsset();
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      throw new Error('Sharing is not available on this device.');
    }
    await Sharing.shareAsync(fileUri, { mimeType: 'image/png', dialogTitle: 'Share QR Code' });
  };

  useImperativeHandle(ref, () => ({ shareAsImage: handleShareAsImage }));

  return (
    <View style={[styles.card, style]}>
      {/* Off-screen (opacity 0, absolutely positioned so it doesn't affect
          layout) — captured by getBrandedCardAsset() for Save/Share.
          collapsable={false} is required on Android or view-shot can
          capture a blank/flattened view. */}
      <View style={styles.offscreenWrap} pointerEvents="none">
        <View ref={brandedCardRef} collapsable={false} style={styles.brandedCard}>
          <Text style={styles.brandedBrand}>CHEMSTOCK</Text>
          <Text style={styles.brandedTitle}>Batch QR Code</Text>
          <View style={styles.brandedQrTile}>
            <QRCode value={value} size={180} />
          </View>
          <Text style={styles.brandedLabel}>Batch code</Text>
          <Text style={styles.brandedCode}>{value}</Text>
          <View style={styles.brandedFooterWrap}>
            <Text style={styles.brandedFooter}>Scan with the ChemStock app to track this batch.</Text>
          </View>
        </View>
      </View>

      <View style={styles.qrTile}>
        <QRCode value={value} size={size} getRef={(c) => (qrRef.current = c)} />
      </View>
      {showValueText && (
        <View style={styles.codeBlock}>
          <Text style={styles.codeLabel}>Batch code</Text>
          <Text style={styles.codeText}>{value}</Text>
        </View>
      )}
      <View style={styles.actions}>
        <Button
          title={isSaving ? 'Saving…' : 'Save to Gallery'}
          variant="fill"
          accentColor={COLORS.success}
          icon="trayDown"
          iconSize={18}
          onPress={handleSaveToGallery}
          loading={isSaving}
          disabled={isSaving || isPrinting}
          height={48}
          fontSize={15}
          style={styles.fullWidth}
        />
        <Button
          title={isPrinting ? 'Printing…' : 'Print QR Code'}
          variant="outline"
          accentColor={COLORS.primary}
          icon="document"
          iconSize={18}
          onPress={handlePrint}
          loading={isPrinting}
          disabled={isPrinting || isSaving}
          height={48}
          fontSize={15}
          style={styles.fullWidth}
        />
      </View>
    </View>
  );
});

export default SaveableQRCode;

SaveableQRCode.propTypes = {
  value: PropTypes.string.isRequired,
  size: PropTypes.number,
  showValueText: PropTypes.bool,
  style: PropTypes.object,
};

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: 16,
    backgroundColor: COLORS.textWhite,
  },
  qrTile: {
    padding: SPACING.md,
    borderRadius: 12,
    backgroundColor: COLORS.background,
  },
  codeBlock: {
    alignItems: 'center',
    gap: 4,
  },
  codeLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textTertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  codeText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  actions: {
    width: '100%',
    gap: SPACING.sm,
  },
  fullWidth: {
    width: '100%',
  },
  offscreenWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    opacity: 0,
  },
  brandedCard: {
    width: 320,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  brandedBrand: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 3,
    color: '#03045E',
  },
  brandedTitle: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
  },
  brandedQrTile: {
    marginTop: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
  },
  brandedLabel: {
    marginTop: 28,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#64748B',
  },
  brandedCode: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  brandedFooterWrap: {
    marginTop: 36,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    width: '100%',
    alignItems: 'center',
  },
  brandedFooter: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
});
