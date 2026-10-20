// src/screens/manager/ReleaseStockConfirmScreen.js
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, BackHandler } from 'react-native';
import Alert from '../../utils/appAlert';
import { StatusBar } from 'expo-status-bar';
import { BlurTargetView } from 'expo-blur';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import { getDeviceModel, getDeviceOs, getDeviceLabel } from '../../utils/deviceInfo';
import QRSuccessView from '../../components/common/QRSuccessView';
import ReleaseSummaryCard from '../../components/common/ReleaseSummaryCard';
import PhotoProofCard from '../../components/common/PhotoProofCard';
import ShipmentProofRow from '../../components/common/ShipmentProofRow';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import { formatDateTime } from '../../utils/formatters';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import LiveStatusPill from '../../components/common/LiveStatusPill';
import SectionHeader from '../../components/common/SectionHeader';
import BottomActionBar, { useBottomActionBarHeight } from '../../components/common/BottomActionBar';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import UserAvatar from '../../components/common/UserAvatar';
import CameraCaptureModal from '../../components/common/CameraCaptureModal';
import authService from '../../services/authService';
import inventoryService from '../../services/inventoryService';
import requestService from '../../services/requestService';
import { getInitials } from '../../utils/initials';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import friendlyError from '../../utils/friendlyError';

const catalogImageFor = (code) => PRODUCT_CATALOG.find((product) => product.code === code)?.image;

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
    requestId,
  } = route.params;
  const isQuickRegister = mode === 'quickRegister';
  const bottomActionBarHeight = useBottomActionBarHeight();
  const blurTarget = useRef(null);
  // Full-size look at the handover photo from the evidence card (view only, no retake).
  const [isEvidenceVisible, setIsEvidenceVisible] = useState(false);
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
  const [isViewingPhoto, setIsViewingPhoto] = useState(false);

  const handleOpenCamera = () => {
    setIsViewingPhoto(false);
    setIsCameraVisible(true);
  };

  const handleViewPhoto = () => {
    setIsViewingPhoto(true);
    setIsCameraVisible(true);
  };

  const handleCloseCamera = () => {
    setIsCameraVisible(false);
    setIsViewingPhoto(false);
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [qrCode, setQrCode] = useState(null);

  const coords = isCollectorDelivery ? originCoords : selfCoords;
  // Quick Register already captured the shipment/handover photo on step 2,
  // so that one photo serves as the release proof too (no second capture).
  const photoUri = isCollectorDelivery ? deliveryPhotoUri : isQuickRegister ? registerPhotoUri : releasePhotoUri;
  const shipmentStoragePathRef = useRef(null);

  // Quick Register chains two writes: register the new stock, then release
  // it. If the release half fails after registration already succeeded,
  // that's not a broken data state (the stock IS legitimately received) —
  // but retrying shouldn't re-register it a second time. These two refs
  // remember what already succeeded so a second tap of the same button
  // retries only the release, using the batch that was already created.
  const [hasRegistered, setHasRegistered] = useState(false);
  const [pendingReleaseItems, setPendingReleaseItems] = useState(null);
  const [receivingQrCode, setReceivingQrCode] = useState(null);

  // Branch name for the transaction card. Resolved from the branch chosen in
  // step 1 (branchId), since a multi-branch manager has no single branchName.
  const [branchName, setBranchName] = useState(null);

  useEffect(() => {
    if (!manager || !branchId) return;
    requestService.getAgentBranches(manager.branchIds || []).then((list) => {
      const match = list.find((b) => b.id === branchId);
      setBranchName(match?.name || 'Branch unavailable');
    });
  }, [manager, branchId]);

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
        console.error('[ERROR] [ReleaseStockConfirm] Location error:', error);
        setLocationError('Unable to determine location');
      }
    })();
  }, [isCollectorDelivery]);

  const deviceLabel = getDeviceLabel(manager?.full_name || manager?.username);

  const displayItems = isQuickRegister
    ? registerItems.map((item) => ({ key: item.code, name: item.name, qty: item.registeredQty, image: item.image }))
    : items.map((item) => ({
        key: item.branchInventoryId,
        name: item.productName,
        qty: item.releaseQty,
        image: catalogImageFor(item.productCode),
      }));

  const totalUnits = displayItems.reduce((sum, item) => sum + item.qty, 0);

  const handleConfirmRelease = async () => {
    if (!manager || !photoUri || isSubmitting) return;
    setIsSubmitting(true);

    try {
      let itemsToRelease = items;

      if (isQuickRegister && !hasRegistered) {
        const registerStoragePath = await inventoryService.uploadShipmentPhoto(registerPhotoUri, manager.id);
        shipmentStoragePathRef.current = registerStoragePath;
        const registerResult = await inventoryService.receiveStockBatch({
          branchId,
          latitude: coords?.latitude,
          longitude: coords?.longitude,
          deviceModel: getDeviceModel(),
          deviceOs: getDeviceOs(),
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

      const releaseStoragePath = isQuickRegister
        ? shipmentStoragePathRef.current
        : await inventoryService.uploadShipmentPhoto(photoUri, manager.id);
      const releaseResult = await inventoryService.releaseStockBatch({
        branchId,
        recipientId: recipient.id,
        movementType,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        deviceModel: getDeviceModel(),
        deviceOs: getDeviceOs(),
        storagePath: releaseStoragePath,
        items: itemsToRelease,
        targetRecipientId: targetRecipient?.id,
        destinationLatitude: destinationCoords?.latitude,
        destinationLongitude: destinationCoords?.longitude,
      });

      if (!releaseResult.success) {
        throw new Error(releaseResult.message);
      }

      // The release itself is already the source of truth — if this
      // traceability follow-up fails, log it but still show success below
      // rather than stranding a completed release behind a linking error.
      if (requestId) {
        const linkResult = await requestService.linkRequestFulfillment(requestId, releaseResult.data.transactionId);
        if (!linkResult.success) {
          console.error('[ERROR] [ReleaseStockConfirm] Failed to link request fulfillment:', linkResult.message);
          Alert.alert(
            'Stock Released — Request Not Updated',
            `The stock was released, but the request could not be marked as fulfilled: ${friendlyError(linkResult.message) || 'unknown error'}. Do not release it again — report this so the request can be linked.`
          );
        }
      }

      setQrCode(releaseResult.data.qrCode);
    } catch (error) {
      Alert.alert('Failed to Release Stock', friendlyError(error.message) || 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDone = () => {
    navigation.navigate('ManagerDashboard', undefined, { pop: true });
  };

  // Once the release succeeds, going "back" from here would re-show the
  // confirm form over an already-completed release — tapping Confirm again
  // would release the same stock a second time. Block the Android hardware
  // back button and the iOS/Android swipe-back gesture while this success
  // state is shown; only the on-screen Done button may leave this screen.
  useEffect(() => {
    if (!qrCode) return;

    navigation.setOptions({ gestureEnabled: false });
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => {
      subscription.remove();
      navigation.setOptions({ gestureEnabled: true });
    };
  }, [qrCode, navigation]);

  if (qrCode) {
    return (
      <>
        <StatusBar style="light" />
        <View style={styles.container}>
          <Header title="Stock Released" height={56} backgroundColor="#03045E" textColor="#FFFFFF" paddingHorizontal={SPACING.md} />
          <View style={{ flex: 1 }}>
            <QRSuccessView
              title="Stock Released Successfully"
              subtitle="Scan this code anytime to track the release."
              qrValue={qrCode}
              receipt={[
                {
                  label: 'Recipient',
                  value: targetRecipient ? `${recipient.fullName} → ${targetRecipient.fullName}` : recipient.fullName,
                },
                { label: 'Items', value: `${displayItems.length} item${displayItems.length === 1 ? '' : 's'}, ${totalUnits} units` },
                { label: 'Released', value: formatDateTime(capturedAt) },
              ]}
              onDone={handleDone}
            />
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
        <SecondaryHeader height={76}>
          <View style={styles.titleRow}>
            <View style={styles.titleTextCol}>
              <Text style={styles.pageTitle} numberOfLines={1}>Confirm & Finish</Text>
              <Text style={styles.pageSubtitle}>Check everything, then log it</Text>
            </View>
            <LiveStatusPill pillStyle={styles.onlinePill} dotStyle={styles.onlineDot} textStyle={styles.onlineText} />
          </View>
        </SecondaryHeader>

        <BlurTargetView ref={blurTarget} style={styles.contentTarget}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomActionBarHeight + SPACING.lg }]}
          showsVerticalScrollIndicator={false}
        >
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
              <SectionHeader icon="users" size="md" label="Recipients" style={styles.labelFirst} />
              <View style={styles.recipientsCard}>
                <View style={styles.recipientsRow}>
                  <View style={styles.summaryPerson}>
                    <UserAvatar
                      photoUrl={recipient.profilePhotoUrl}
                      fallbackText={getInitials(recipient.fullName)}
                      size={40}
                      backgroundColor={COLORS.primaryLight}
                      fallbackTextColor={COLORS.primary}
                    />
                    <View style={styles.summaryTextCol}>
                      <Text style={styles.summaryCaption}>Collector</Text>
                      <Text style={styles.summaryName}>{recipient.fullName}</Text>
                    </View>
                  </View>
                  {targetRecipient && (
                    <>
                      <Icon name="arrowRight" size={16} color={COLORS.textSecondary} />
                      <View style={styles.summaryPerson}>
                        <UserAvatar
                          photoUrl={targetRecipient.profilePhotoUrl}
                          fallbackText={getInitials(targetRecipient.fullName)}
                          size={40}
                          backgroundColor={COLORS.primaryLight}
                          fallbackTextColor={COLORS.primary}
                        />
                        <View style={styles.summaryTextCol}>
                          <Text style={styles.summaryCaption}>Sales Rep</Text>
                          <Text style={styles.summaryName}>{targetRecipient.fullName}</Text>
                        </View>
                      </View>
                    </>
                  )}
                </View>
                <View style={styles.handoverRow}>
                  <Icon name="truck" size={14} color={COLORS.textSecondary} />
                  <Text style={styles.handoverText}>Handover type: Delivery via Collector</Text>
                </View>
              </View>

              <SectionHeader icon="package" size="md" label="Items to release" style={styles.labelSpaced} />
              <ReleaseSummaryCard
                totalUnits={totalUnits}
                recipientLine={`Recipient: ${targetRecipient?.fullName || recipient.fullName} (via ${recipient.fullName})`}
                items={displayItems}
                defaultOpen={false}
              />

              <SectionHeader icon="location" size="md" label="Chain of custody" style={styles.labelSpaced} />
              <View style={styles.custodyCard}>
                <View style={styles.custodyTop}>
                  {deliveryPhotoUri ? (
                    <TouchableOpacity
                      style={styles.evidenceThumbWrap}
                      onPress={() => setIsEvidenceVisible(true)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel="View the handover photo"
                    >
                      <Image source={{ uri: deliveryPhotoUri }} style={styles.evidenceThumb} resizeMode="cover" />
                      <View style={styles.evidenceExpand}>
                        <Icon name="expand" size={12} color="#FFFFFF" />
                      </View>
                    </TouchableOpacity>
                  ) : null}
                  <View style={styles.custodyLines}>
                    <View style={styles.metaRow}>
                      <Icon name="location" size={16} color={COLORS.success} />
                      <View style={styles.metaTextCol}>
                        <Text style={styles.metaCaption}>From</Text>
                        <Text style={styles.metaText}>
                          {originCoords ? `${originCoords.latitude.toFixed(5)}, ${originCoords.longitude.toFixed(5)}` : '—'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.metaRow}>
                      <Icon name="location" size={16} color={COLORS.error} />
                      <View style={styles.metaTextCol}>
                        <Text style={styles.metaCaption}>Delivered to</Text>
                        <Text style={styles.metaText}>
                          {destinationCoords ? `${destinationCoords.latitude.toFixed(5)}, ${destinationCoords.longitude.toFixed(5)}` : '—'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
                <View style={styles.custodyDivider} />
                <View style={styles.metaRow}>
                  <Icon name="home" size={15} color={COLORS.primary} />
                  <Text style={styles.metaTextSmall}>{branchName ?? 'Loading branch…'}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Icon name="phone" size={15} color={COLORS.textSecondary} />
                  <Text style={styles.metaTextSmall}>{deviceLabel || 'Unknown device'}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Icon name="clock" size={15} color={COLORS.textSecondary} />
                  <Text style={styles.metaTextSmall}>{capturedAt.toLocaleString()}</Text>
                </View>
              </View>

              <View style={styles.qrVerificationBanner}>
                <Icon name="lock" size={14} color="#D98200" />
                <Text style={styles.qrVerificationText}>
                  QR verification required from both parties upon final handover
                </Text>
              </View>
            </>
          ) : (
            <>
              <SectionHeader icon="package" size="md" label="Summary" style={styles.labelFirst} />
              <ReleaseSummaryCard
                totalUnits={totalUnits}
                recipientLine={`Recipient: ${recipient.fullName}`}
                items={displayItems}
                defaultOpen={false}
              />

              <SectionHeader
                icon="camera"
                size="md"
                label={isQuickRegister ? 'Shipment proof (handover)' : 'Photo proof'}
                style={styles.labelSpaced}
              />
              {!isQuickRegister && (
                <ShipmentProofRow
                  photoUri={photoUri}
                  onOpenCamera={handleOpenCamera}
                  onViewPhoto={photoUri ? handleViewPhoto : undefined}
                  label="Take Photo of Handover"
                />
              )}
              <PhotoProofCard
                photoUri={photoUri}
                onView={isQuickRegister ? handleViewPhoto : handleOpenCamera}
                fromLabel={`From ${manager?.full_name || manager?.username || 'you'} to`}
                toName={recipient.fullName}
              />

              <SectionHeader icon="clipboardText" size="md" label="Transaction details" style={styles.labelSpaced} />
              <View style={styles.metaCard}>
                <View style={styles.metaRow}>
                  <Icon name="location" size={16} color={COLORS.error} />
                  <Text style={styles.metaText}>
                    {coords ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` : locationError || 'Locating…'}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Icon name="home" size={16} color={COLORS.primary} />
                  <Text style={styles.metaText}>{branchName ?? 'Loading branch…'}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Icon name="phone" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.metaText}>{deviceLabel || 'Unknown device'}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Icon name="clock" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.metaText}>{capturedAt.toLocaleString()}</Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>
        </BlurTargetView>

        <BottomActionBar variant="glass" blurTarget={blurTarget}>
          {!photoUri && !isSubmitting && <Text style={styles.barHint}>Take the handover photo to continue.</Text>}
          <Button
            title={isSubmitting ? 'Releasing…' : 'Confirm & Log Release'}
            variant="black"
            onPress={handleConfirmRelease}
            loading={isSubmitting}
            disabled={isSubmitting || !manager || !photoUri}
            height={48}
            fontSize={16}
            borderRadius={24}
          />
        </BottomActionBar>

        <CameraCaptureModal
          visible={isEvidenceVisible}
          onClose={() => setIsEvidenceVisible(false)}
          onCapture={() => {}}
          initialUri={deliveryPhotoUri}
          readOnly
        />

        <CameraCaptureModal
          visible={isCameraVisible}
          onClose={handleCloseCamera}
          onCapture={isQuickRegister ? handleCloseCamera : setReleasePhotoUri}
          initialUri={isViewingPhoto ? photoUri : null}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  contentTarget: { flex: 1 },
  content: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, gap: SPACING.sm },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
  },
  titleTextCol: { flexShrink: 1, flex: 1 },
  pageTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  pageSubtitle: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' },
  onlineText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.success,
  },
  labelFirst: { marginTop: SPACING.sm, marginBottom: 0 },
  labelSpaced: { marginTop: SPACING.md, marginBottom: 0 },
  recoveryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.sm,
    borderRadius: 8,
    backgroundColor: COLORS.success + '12',
  },
  recoveryText: {
    flex: 1,
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.success,
  },
  recipientsCard: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  recipientsRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  summaryPerson: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  summaryTextCol: { flex: 1 },
  summaryCaption: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  summaryName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  handoverRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  handoverText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
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
  custodyTop: { flexDirection: 'row', gap: SPACING.md, alignItems: 'center' },
  custodyLines: { flex: 1, gap: SPACING.sm },
  custodyDivider: { height: 1, backgroundColor: '#EEEEEE' },
  evidenceThumbWrap: { width: 84, height: 84, borderRadius: 10, overflow: 'hidden', backgroundColor: '#F1F5F9' },
  evidenceThumb: { width: '100%', height: '100%' },
  evidenceExpand: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrVerificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F59E0B66',
    backgroundColor: '#FFF3E0',
  },
  qrVerificationText: {
    flex: 1,
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: '#8A5A00',
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
  metaTextCol: { flex: 1 },
  metaCaption: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  metaText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: '#272632',
  },
  metaTextSmall: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  barHint: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
});
