// src/screens/manager/ReceiveStockPreviewScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, Alert, Share, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import Header from '../../components/common/Header';
import SubScreenSecondaryHeader from '../../components/common/SubScreenSecondaryHeader';
import Button from '../../components/common/Button';
import BottomActionBar, { useBottomActionBarHeight } from '../../components/common/BottomActionBar';
import Icon from '../../components/common/Icon';
import SaveableQRCode from '../../components/common/SaveableQRCode';
import RegisteredItemsList from '../../components/common/RegisteredItemsList';
import ShipmentProofRow from '../../components/common/ShipmentProofRow';
import CameraCaptureModal from '../../components/common/CameraCaptureModal';
import authService from '../../services/authService';
import inventoryService from '../../services/inventoryService';
import useScrolledToEnd from '../../hooks/useScrolledToEnd';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { formatCoordinates, formatDateTime } from '../../utils/formatters';

const { width: screenWidth } = Dimensions.get('window');
const HALF_BUTTON_WIDTH = (screenWidth - SPACING.lg * 2 - SPACING.sm) / 2;

export default function ReceiveStockPreviewScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  // Editable, seeded from what AddNewBatchesScreen already collected — this
  // is still the pre-submit preview, so the manager can correct a mistake
  // (qty, dates, even retake the photo) without navigating all the way back.
  const [items, setItems] = useState(route.params.items);
  const [photoUri, setPhotoUri] = useState(route.params.photoUri);
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [isViewingPhoto, setIsViewingPhoto] = useState(false);

  const [manager, setManager] = useState(null);
  const [isLoadingManager, setIsLoadingManager] = useState(true);
  const [coords, setCoords] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [capturedAt] = useState(() => new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [registeredAt, setRegisteredAt] = useState(null);
  const bottomActionBarHeight = useBottomActionBarHeight();
  const { hasReachedEnd, onScroll, onContentSizeChange, onLayout } = useScrolledToEnd();

  useEffect(() => {
    authService
      .getCurrentUser()
      .then(setManager)
      .catch((error) => {
        console.error('[ERROR] [ReceiveStockPreview] Failed to load manager:', error);
        setManager(null);
      })
      .finally(() => setIsLoadingManager(false));

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('Location permission denied');
          return;
        }
        const position = await Location.getCurrentPositionAsync({});
        setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      } catch (error) {
        console.error('[ERROR] [ReceiveStockPreview] Location error:', error);
        setLocationError('Unable to determine location');
      }
    })();
  }, []);

  const totalUnits = items.reduce((sum, item) => sum + item.registeredQty, 0);
  const hasIncompleteDates = items.some((item) => !item.mfgDate || !item.expDate);
  const deviceLabel = Device.modelName || 'Unknown device';

  const branchStatusText = isLoadingManager
    ? 'Loading branch…'
    : manager?.branchName || 'No branch assigned to your account';

  const handleSetQty = (code, qty) => {
    setItems((prev) =>
      prev.map((item) => (item.code === code ? { ...item, registeredQty: Math.max(1, qty) } : item))
    );
  };

  const handleDateChange = (code, field, value) => {
    setItems((prev) => prev.map((item) => (item.code === code ? { ...item, [field]: value } : item)));
  };

  const handleRemoveItem = (code) => {
    setItems((prev) => prev.filter((item) => item.code !== code));
  };

  const handlePhotoCaptured = (uri) => {
    setPhotoUri(uri);
  };

  const handleOpenCamera = () => {
    setIsViewingPhoto(false);
    setIsCameraVisible(true);
  };

  const handleViewPhoto = () => {
    setIsViewingPhoto(true);
    setIsCameraVisible(true);
  };

  const handleReceiveAndGenerate = async () => {
    if (!manager) return;

    if (items.length === 0) {
      Alert.alert('No Products Left', 'You removed every item — add at least one before registering.');
      return;
    }
    if (hasIncompleteDates) {
      Alert.alert('Set Item Dates', 'Every item needs both a Mfg and Exp date before registering.');
      return;
    }
    if (!photoUri) {
      Alert.alert('Photo Required', 'Take a photo of the waybill/invoice before registering.');
      return;
    }
    if (!coords) {
      Alert.alert(
        locationError ? 'Location Unavailable' : 'Getting Your Location',
        locationError
          ? `${locationError}. Location is required to register a batch — check your device's location settings and try again.`
          : "Still locating your device — this only takes a moment. Try again in a second."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const branchId = manager.branchIds?.[0];
      if (!branchId) {
        throw new Error('No branch is assigned to your account.');
      }

      const storagePath = await inventoryService.uploadShipmentPhoto(photoUri, manager.id);

      const result = await inventoryService.receiveStockBatch({
        branchId,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        deviceModel: Device.modelName,
        deviceOs: `${Device.osName || ''} ${Device.osVersion || ''}`.trim(),
        storagePath,
        items,
      });

      if (!result.success) {
        throw new Error(result.message);
      }

      setQrCode(result.data.qrCode);
      setRegisteredAt(new Date());
    } catch (error) {
      Alert.alert('Failed to Register Stock', error.message || 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDone = () => {
    navigation.navigate('ManagerDashboard', undefined, { pop: true });
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `ChemStock batch registered — ${items.length} item${items.length === 1 ? '' : 's'}, ${totalUnits} units.\nQR Code: ${qrCode}`,
      });
    } catch (error) {
      console.error('[ERROR] [ReceiveStockPreview] Share failed:', error);
    }
  };

  if (qrCode) {
    return (
      <>
        <StatusBar style="light" />
        <View style={styles.container}>
          <Header
            title="Batch Registered"
            height={56}
            backgroundColor="#03045E"
            textColor="#FFFFFF"
            paddingHorizontal={SPACING.md}
          />
          <View style={styles.qrScreen}>
            <Icon
              name="successCircle"
              size={64}
              color={COLORS.success}
              duotoneColor={COLORS.success + '15'}
              weight="duotone"
            />
            <Text style={styles.qrTitle}>Stock Registered Successfully</Text>
            <Text style={styles.qrSubtitle}>Scan this code anytime to track the batch.</Text>

            <SaveableQRCode value={qrCode} size={150} style={styles.qrCard} />

            <View style={styles.receiptCard}>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Branch</Text>
                <Text style={styles.receiptValue} numberOfLines={1}>
                  {manager?.branchName || '—'}
                </Text>
              </View>
              <View style={styles.receiptDivider} />
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Items</Text>
                <Text style={styles.receiptValue}>
                  {items.length} item{items.length === 1 ? '' : 's'}, {totalUnits} units
                </Text>
              </View>
              <View style={styles.receiptDivider} />
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Registered</Text>
                <Text style={styles.receiptValue}>{formatDateTime(registeredAt)}</Text>
              </View>
            </View>

            <View style={styles.actionsRow}>
              <Button
                title="Share"
                variant="outline"
                accentColor={COLORS.accentPurple}
                icon="send"
                iconSize={16}
                onPress={handleShare}
                width={HALF_BUTTON_WIDTH}
                height={40}
                fontSize={14}
              />
              <Button
                title="Done"
                variant="black"
                icon="checkmark"
                iconSize={16}
                onPress={handleDone}
                width={HALF_BUTTON_WIDTH}
                height={40}
                fontSize={14}
              />
            </View>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton={true}
          backButtonText="Add New Batches"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
        />

        <SubScreenSecondaryHeader title="Generate Qr Code" />

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomActionBarHeight + SPACING.md }]}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          onContentSizeChange={onContentSizeChange}
          onLayout={onLayout}
          scrollEventThrottle={16}
        >
          <RegisteredItemsList
            items={items}
            onSetQty={handleSetQty}
            onDateChange={handleDateChange}
            onRemove={handleRemoveItem}
            sectionTitle="Registered Items"
          />

          <Text style={styles.sectionTitle}>Shipment Proof (Handover)</Text>
          <ShipmentProofRow
            photoUri={photoUri}
            onOpenCamera={handleOpenCamera}
            onViewPhoto={photoUri ? handleViewPhoto : undefined}
          />

          <Text style={styles.sectionTitle}>Photo Proof</Text>
          <View style={styles.photoProofCard}>
            <TouchableOpacity
              style={styles.photoProofImageWrap}
              onPress={handleViewPhoto}
              activeOpacity={0.85}
              accessibilityLabel="View full-size waybill/invoice photo"
              accessibilityRole="button"
            >
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photoProofImage} resizeMode="cover" />
              ) : (
                <View style={styles.photoProofEmpty}>
                  <Icon name="camera" size={28} color={COLORS.textSecondary} />
                </View>
              )}
              <View style={styles.expandBadge}>
                <Icon name="expand" size={14} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            <View style={styles.recipientRow}>
              <Text style={styles.recipientLabel}>From Factory to</Text>
              <Text style={styles.recipientName}>
                {manager?.full_name || manager?.username || 'You'}
              </Text>
            </View>

            <View style={styles.metaRow}>
              <Icon name="location" size={16} color={COLORS.error} />
              <Text style={styles.metaText}>
                {coords ? formatCoordinates(coords.latitude, coords.longitude) : locationError || 'Locating…'}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Icon name="building" size={16} color={COLORS.primary} />
              <Text style={styles.metaText}>{branchStatusText}</Text>
            </View>
            <View style={styles.metaRow}>
              <Icon name="package" size={16} color={COLORS.textSecondary} />
              <Text style={styles.metaText}>{deviceLabel}</Text>
            </View>
            <View style={styles.metaRow}>
              <Icon name="calendar" size={16} color={COLORS.textSecondary} />
              <Text style={styles.metaText}>{formatDateTime(capturedAt)}</Text>
            </View>

            <Text style={styles.summaryText}>
              {items.length} item{items.length === 1 ? '' : 's'}, {totalUnits} units
            </Text>
          </View>

        </ScrollView>

        <BottomActionBar>
          <Button
            title={
              isSubmitting
                ? 'Registering…'
                : !hasReachedEnd
                ? 'Scroll Down to Review'
                : !coords
                ? locationError
                  ? 'Location Unavailable'
                  : 'Getting Your Location…'
                : 'Receive and Generate QR'
            }
            variant="black"
            onPress={handleReceiveAndGenerate}
            loading={isSubmitting}
            disabled={
              isSubmitting || !manager || items.length === 0 || hasIncompleteDates || !hasReachedEnd || !coords
            }
          />
        </BottomActionBar>

        <CameraCaptureModal
          visible={isCameraVisible}
          onClose={() => setIsCameraVisible(false)}
          onCapture={handlePhotoCaptured}
          initialUri={isViewingPhoto ? photoUri : null}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 48, gap: SPACING.md },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  photoProofCard: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  photoProofImageWrap: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
  },
  photoProofImage: {
    width: '100%',
    height: '100%',
  },
  photoProofEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandBadge: {
    position: 'absolute',
    bottom: SPACING.sm,
    right: SPACING.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: SPACING.xs,
  },
  recipientLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  recipientName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  metaText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: '#272632',
  },
  summaryText: {
    textAlign: 'center',
    marginTop: SPACING.xs,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: '#272632',
  },
  qrScreen: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    gap: SPACING.xs,
  },
  qrTitle: {
    marginTop: SPACING.xs,
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
    textAlign: 'center',
  },
  qrSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  qrCard: {
    marginBottom: SPACING.sm,
    padding: SPACING.md,
  },
  receiptCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  receiptDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  receiptLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  receiptValue: {
    flexShrink: 1,
    textAlign: 'right',
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: '#272632',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
});
