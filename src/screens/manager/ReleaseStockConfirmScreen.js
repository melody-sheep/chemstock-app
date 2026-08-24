// src/screens/manager/ReleaseStockConfirmScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import Header from '../../components/common/Header';
import SubScreenSecondaryHeader from '../../components/common/SubScreenSecondaryHeader';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import CameraCaptureModal from '../../components/common/CameraCaptureModal';
import SaveableQRCode from '../../components/common/SaveableQRCode';
import authService from '../../services/authService';
import inventoryService from '../../services/inventoryService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

export default function ReleaseStockConfirmScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const {
    recipient,
    targetRecipient,
    branchId,
    movementType,
    mode,
    items,
    registerItems,
    registerPhotoUri,
    originCoords,
    destinationCoords,
    deliveryPhotoUri,
  } = route.params;
  const isQuickRegister = mode === 'quickRegister';
  // Collector releases arrive here from ReleaseStockDeliveryScreen, which
  // already captured the origin GPS point and the handover photo — this
  // screen only needs to fetch/capture those itself for a direct release.
  const isCollectorDelivery = movementType === 'collector';

  const [manager, setManager] = useState(null);
  const [selfCoords, setSelfCoords] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [capturedAt] = useState(() => new Date());
  const [releasePhotoUri, setReleasePhotoUri] = useState(null);
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [qrCode, setQrCode] = useState(null);

  const coords = isCollectorDelivery ? originCoords : selfCoords;
  const photoUri = isCollectorDelivery ? deliveryPhotoUri : releasePhotoUri;

  // Quick Register chains two writes: register the new stock, then release
  // it. If the release half fails after registration already succeeded,
  // that's not a broken data state (the stock IS legitimately received) —
  // but retrying shouldn't re-register it a second time. These two refs
  // remember what already succeeded so a second tap of the same button
  // retries only the release, using the batch that was already created.
  const [hasRegistered, setHasRegistered] = useState(false);
  const [pendingReleaseItems, setPendingReleaseItems] = useState(null);
  const [receivingQrCode, setReceivingQrCode] = useState(null);

  useEffect(() => {
    authService.getCurrentUser().then(setManager);

    if (isCollectorDelivery) return; // origin already captured on the delivery screen

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('Location permission denied');
          return;
        }
        const position = await Location.getCurrentPositionAsync({});
        setSelfCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      } catch (error) {
        console.error('❌ [ReleaseStockConfirm] Location error:', error);
        setLocationError('Unable to determine location');
      }
    })();
  }, [isCollectorDelivery]);

  const deviceLabel = [Device.modelName, Device.osName, Device.osVersion].filter(Boolean).join(' - ');

  const displayItems = isQuickRegister
    ? registerItems.map((item) => ({ key: item.code, name: item.name, qty: item.registeredQty }))
    : items.map((item) => ({ key: item.branchInventoryId, name: item.productName, qty: item.releaseQty }));
  const totalUnits = displayItems.reduce((sum, item) => sum + item.qty, 0);

  const handleConfirmRelease = async () => {
    if (!manager || !photoUri || isSubmitting) return;
    setIsSubmitting(true);

    try {
      let itemsToRelease = items;

      if (isQuickRegister && !hasRegistered) {
        const registerStoragePath = await inventoryService.uploadShipmentPhoto(registerPhotoUri, manager.id);
        const registerResult = await inventoryService.receiveStockBatch({
          branchId,
          latitude: coords?.latitude,
          longitude: coords?.longitude,
          deviceModel: Device.modelName,
          deviceOs: `${Device.osName || ''} ${Device.osVersion || ''}`.trim(),
          storagePath: registerStoragePath,
          items: registerItems,
        });

        if (!registerResult.success) {
          throw new Error(registerResult.message || 'Failed to register the stock before releasing it.');
        }

        const lookup = await inventoryService.getReceivingBatchByQrCode(
          registerResult.data.qrCode,
          manager.branchIds || []
        );
        if (!lookup.success || !lookup.data) {
          throw new Error('Stock was registered, but could not be found to release. Try releasing it via Scan QR instead.');
        }

        itemsToRelease = (lookup.data.branch_inventory || []).map((row) => ({
          branchInventoryId: row.id,
          productCode: row.product_code,
          productName: row.product_name,
          releaseQty: row.quantity,
        }));

        setHasRegistered(true);
        setPendingReleaseItems(itemsToRelease);
        setReceivingQrCode(registerResult.data.qrCode);
      } else if (isQuickRegister && hasRegistered) {
        itemsToRelease = pendingReleaseItems;
      }

      const releaseStoragePath = await inventoryService.uploadShipmentPhoto(photoUri, manager.id);
      const releaseResult = await inventoryService.releaseStockBatch({
        branchId,
        recipientId: recipient.id,
        movementType,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        deviceModel: Device.modelName,
        deviceOs: `${Device.osName || ''} ${Device.osVersion || ''}`.trim(),
        storagePath: releaseStoragePath,
        items: itemsToRelease,
        targetRecipientId: targetRecipient?.id,
        destinationLatitude: destinationCoords?.latitude,
        destinationLongitude: destinationCoords?.longitude,
      });

      if (!releaseResult.success) {
        throw new Error(releaseResult.message);
      }

      setQrCode(releaseResult.data.qrCode);
    } catch (error) {
      Alert.alert('Failed to Release Stock', error.message || 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDone = () => {
    navigation.navigate('ManagerDashboard', undefined, { pop: true });
  };

  if (qrCode) {
    return (
      <>
        <StatusBar style="light" />
        <View style={styles.container}>
          <Header title="Stock Released" height={56} backgroundColor="#03045E" textColor="#FFFFFF" paddingHorizontal={SPACING.md} />
          <View style={styles.qrScreen}>
            <Icon name="checkCircle" size={40} color={COLORS.success} weight="fill" />
            <Text style={styles.qrTitle}>Stock Released Successfully</Text>
            <Text style={styles.qrSubtitle}>
              {displayItems.length} item{displayItems.length === 1 ? '' : 's'}, {totalUnits} units to {recipient.fullName}
              {isCollectorDelivery && targetRecipient ? ` for delivery to ${targetRecipient.fullName}` : ''}
            </Text>
            <SaveableQRCode value={qrCode} size={200} style={styles.qrCard} />
            <Button title="Done" variant="black" onPress={handleDone} style={styles.doneButton} />
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header showBackButton backButtonText="Pick Products" height={56} backgroundColor="#03045E" textColor="#FFFFFF" paddingHorizontal={SPACING.md} />
        <SubScreenSecondaryHeader title="Confirm & Finish" />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {hasRegistered && (
            <View style={styles.recoveryBanner}>
              <Icon name="checkCircle" size={16} color={COLORS.success} weight="fill" />
              <Text style={styles.recoveryText}>
                Stock already registered (QR {receivingQrCode}) — retrying just the release.
              </Text>
            </View>
          )}

          {isCollectorDelivery ? (
            <>
              <Text style={styles.sectionTitle}>Recipients</Text>
              <View style={styles.recipientsCard}>
                <View style={styles.recipientRow}>
                  <View style={styles.recipientAvatar}>
                    <Icon name="person" size={18} color={COLORS.primary} />
                  </View>
                  <View style={styles.recipientTextWrap}>
                    <Text style={styles.recipientName}>
                      {recipient.fullName} <Text style={styles.recipientRole}>(Collector)</Text>
                    </Text>
                    <Text style={styles.recipientHandover}>Handover type: Delivery via Collector</Text>
                  </View>
                </View>
                {targetRecipient && (
                  <View style={styles.recipientRow}>
                    <View style={styles.recipientAvatar}>
                      <Icon name="person" size={18} color={COLORS.primary} />
                    </View>
                    <View style={styles.recipientTextWrap}>
                      <Text style={styles.recipientName}>
                        {targetRecipient.fullName} <Text style={styles.recipientRole}>(Sales Representative)</Text>
                      </Text>
                      <Text style={styles.recipientHandover}>Handover type: Delivery via Collector</Text>
                    </View>
                  </View>
                )}
              </View>

              <Text style={styles.sectionTitle}>Items to Release</Text>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTotal}>
                  Total: {totalUnits} item{totalUnits === 1 ? '' : 's'} about to release
                </Text>
                <Text style={styles.summaryRecipient}>
                  Recipient: {targetRecipient?.fullName || recipient.fullName} (via {recipient.fullName})
                </Text>
                {displayItems.map((item) => (
                  <View key={item.key} style={styles.summaryRow}>
                    <Text style={styles.summaryItemName}>{item.name}</Text>
                    <Text style={styles.summaryItemQty}>Qty: {item.qty}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.sectionTitle}>Chain of Custody Evidence</Text>
              <View style={styles.custodyCard}>
                <View style={styles.metaRow}>
                  <Icon name="location" size={16} color={COLORS.success} />
                  <Text style={styles.metaText}>
                    From: {originCoords ? `${originCoords.latitude.toFixed(5)}, ${originCoords.longitude.toFixed(5)}` : '—'}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Icon name="location" size={16} color={COLORS.error} />
                  <Text style={styles.metaText}>
                    Delivered to: {destinationCoords ? `${destinationCoords.latitude.toFixed(5)}, ${destinationCoords.longitude.toFixed(5)}` : '—'}
                  </Text>
                </View>
                {deliveryPhotoUri && (
                  <Image source={{ uri: deliveryPhotoUri }} style={styles.photoPreview} resizeMode="cover" />
                )}
              </View>

              <View style={styles.qrVerificationBanner}>
                <Icon name="lock" size={14} color={COLORS.error} />
                <Text style={styles.qrVerificationText}>
                  QR verification required from both parties upon final handover
                </Text>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Summary</Text>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTotal}>
                  Total: {totalUnits} item{totalUnits === 1 ? '' : 's'} about to release
                </Text>
                <Text style={styles.summaryRecipient}>Recipient: {recipient.fullName}</Text>
                {displayItems.map((item) => (
                  <View key={item.key} style={styles.summaryRow}>
                    <Text style={styles.summaryItemName}>{item.name}</Text>
                    <Text style={styles.summaryItemQty}>Qty: {item.qty}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.sectionTitle}>Take Photo Proof</Text>
              {releasePhotoUri ? (
                <Image source={{ uri: releasePhotoUri }} style={styles.photoPreview} resizeMode="cover" />
              ) : (
                <Button
                  title="Take Photo"
                  icon="camera"
                  variant="outline"
                  onPress={() => setIsCameraVisible(true)}
                />
              )}
              {releasePhotoUri && (
                <Button title="Retake Photo" variant="outline" onPress={() => setIsCameraVisible(true)} hasShadow={false} />
              )}
            </>
          )}

          <Text style={styles.sectionTitle}>Transaction Details</Text>
          <View style={styles.metaCard}>
            {!isCollectorDelivery && (
              <View style={styles.metaRow}>
                <Icon name="location" size={16} color={COLORS.error} />
                <Text style={styles.metaText}>
                  {coords ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` : locationError || 'Locating…'}
                </Text>
              </View>
            )}
            <View style={styles.metaRow}>
              <Icon name="building" size={16} color={COLORS.primary} />
              <Text style={styles.metaText}>{manager?.branchName || 'Loading branch…'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Icon name="package" size={16} color={COLORS.textSecondary} />
              <Text style={styles.metaText}>{deviceLabel || 'Unknown device'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Icon name="calendar" size={16} color={COLORS.textSecondary} />
              <Text style={styles.metaText}>{capturedAt.toLocaleString()}</Text>
            </View>
          </View>

          <Button
            title={isSubmitting ? 'Releasing…' : 'Confirm & Log Release'}
            variant="black"
            onPress={handleConfirmRelease}
            loading={isSubmitting}
            disabled={isSubmitting || !manager || !photoUri}
          />
        </ScrollView>

        <CameraCaptureModal
          visible={isCameraVisible}
          onClose={() => setIsCameraVisible(false)}
          onCapture={setReleasePhotoUri}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 48, gap: SPACING.md },
  recoveryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.sm,
    borderRadius: 10,
    backgroundColor: COLORS.success + '12',
  },
  recoveryText: {
    flex: 1,
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.success,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  summaryCard: {
    borderWidth: 1,
    borderColor: COLORS.accentOrange + '40',
    borderRadius: 12,
    backgroundColor: COLORS.accentOrange + '10',
    padding: SPACING.md,
    gap: 4,
  },
  summaryTotal: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  summaryRecipient: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  recipientsCard: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  recipientRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  recipientAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipientTextWrap: { flex: 1 },
  recipientName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  recipientRole: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  recipientHandover: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  custodyCard: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  qrVerificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.error + '30',
    backgroundColor: COLORS.error + '0D',
  },
  qrVerificationText: {
    flex: 1,
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.error,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  summaryItemName: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: '#272632',
  },
  summaryItemQty: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  photoPreview: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  metaCard: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  metaText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: '#272632',
  },
  qrScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: SPACING.sm,
  },
  qrTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
    textAlign: 'center',
  },
  qrSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  qrCard: { marginBottom: SPACING.xl },
  doneButton: { width: '100%' },
});
