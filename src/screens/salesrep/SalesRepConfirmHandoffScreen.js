// src/screens/salesrep/SalesRepConfirmHandoffScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import Header from '../../components/common/Header';
import Icon from '../../components/common/Icon';
import Button from '../../components/common/Button';
import QRScannerModal from '../../components/common/QRScannerModal';
import CameraCaptureModal from '../../components/common/CameraCaptureModal';
import ReportHandoffIssueModal from '../../components/common/ReportHandoffIssueModal';
import DeliveryHandoffStatusBadge from '../../components/common/DeliveryHandoffStatusBadge';
import authService from '../../services/authService';
import inventoryService from '../../services/inventoryService';
import outboxService, { isWaitingForCollector } from '../../services/outboxService';
import { getConnectionStatus } from '../../services/connectionStatus';
import { findQueuedReceipt, receiptDisplay } from '../../utils/queuedReceipts';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import { distanceInMeters, formatDistance } from '../../utils/distance';
import { getRequiredPosition } from '../../utils/quickLocation';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import friendlyError, { NO_INTERNET_MESSAGE, isNetworkError } from '../../utils/friendlyError';
import { getDeviceOs } from '../../utils/deviceInfo';

const DISTANCE_WARN_METERS = 50;

/**
 * SalesRepConfirmHandoffScreen - SR confirms receipt of a collector-mediated
 * delivery. Requires the package QR and a receipt photo before confirmation.
 */
export default function SalesRepConfirmHandoffScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const handoff = route.params?.handoff;
  // Only present when opened from Track Deliveries (not from a notification
  // or a QR scan), which is the only entry that has the route data.
  const mapDelivery = route.params?.delivery || null;
  const [directTransaction, setDirectTransaction] = useState(route.params?.directTransaction || null);
  const initialScannedQr = route.params?.initialScannedQr || null;

  const [agent, setAgent] = useState(null);
  const [coords, setCoords] = useState(null);
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [isIssueModalVisible, setIsIssueModalVisible] = useState(false);
  const [scannedQrCode, setScannedQrCode] = useState(initialScannedQr);
  const [photoUri, setPhotoUri] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchedDirectTx, setFetchedDirectTx] = useState(null);
  const isDirectAwaitingScan = !handoff && !directTransaction;
  const isDirectMode = route.params?.directMode === true || !!directTransaction || isDirectAwaitingScan;

  useEffect(() => {
    let isActive = true;

    authService.getCurrentUser()
      .then((currentUser) => {
        if (isActive) setAgent(currentUser);
      })
      .catch((error) => {
        console.error('[ERROR] [SalesRepConfirmHandoffScreen] Failed to load user:', error);
      });

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.warn('[WARN] [SalesRepConfirmHandoffScreen] Location permission denied');
          return;
        }
        const position = await Location.getCurrentPositionAsync({});
        if (isActive) {
          setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        }
      } catch (error) {
        console.error('[ERROR] [SalesRepConfirmHandoffScreen] Location error:', error);
      }
    })();

    return () => {
      isActive = false;
    };
  }, []);

  const effectiveDirectTx = directTransaction || fetchedDirectTx;

  // Opened for a delivery already received offline on this phone (e.g. from a
  // notification or the Delivery tab): say so instead of showing the form again.
  useEffect(() => {
    if (!agent?.id) return;
    const queued = findQueuedReceipt({
      transactionId: handoff?.transactionId || directTransaction?.transactionId,
      qrCode: handoff?.releaseQrCode || directTransaction?.qrCode,
    }, agent.id);
    if (queued) {
      const isIssue = queued.type === 'dispute_delivery_handoff';
      Alert.alert(
        isIssue ? 'Issue Already Reported' : 'Already Received',
        isIssue
          ? 'You already reported an issue with this delivery on this phone. It will sync automatically.'
          : 'You already received this delivery on this phone. It will sync automatically.',
        [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  }, [agent?.id]);
  const expectedQr = handoff?.releaseQrCode || effectiveDirectTx?.qrCode || null;

  // A delivery still "on the way" carries no QR in the Sales Rep's list (it
  // only comes with the Collector's handoff). Online, the scan is checked
  // with the server; offline it is accepted for now and the server checks it
  // when the receipt syncs (a wrong QR is refused then).
  const needsQrLookup = !isDirectMode && !expectedQr;
  const [qrLookup, setQrLookup] = useState({ code: null, result: null }); // 'match' | 'mismatch' | 'unchecked'
  useEffect(() => {
    if (!needsQrLookup || !scannedQrCode || !agent?.id) return undefined;
    let active = true;
    (async () => {
      let result = 'unchecked';
      if (getConnectionStatus().online) {
        const res = await inventoryService.getTransactionByQrCodeForAgent(scannedQrCode, agent.id);
        if (res.success && res.data) result = res.data.transactionId === handoff?.transactionId ? 'match' : 'mismatch';
        else if (!isNetworkError(res.message) && getConnectionStatus().online) result = 'mismatch';
      }
      if (active) setQrLookup({ code: scannedQrCode, result });
    })();
    return () => {
      active = false;
    };
  }, [needsQrLookup, scannedQrCode, agent?.id]);
  const qrLookupResult = needsQrLookup && qrLookup.code === scannedQrCode ? qrLookup.result : null;
  const isQrChecking = needsQrLookup && !!scannedQrCode && !qrLookupResult;

  const isQrValid = isDirectAwaitingScan && !fetchedDirectTx
    ? Boolean(scannedQrCode)
    : needsQrLookup
      ? qrLookupResult === 'match' || qrLookupResult === 'unchecked'
      : Boolean(scannedQrCode && expectedQr && scannedQrCode === expectedQr);
  const collectorGps = handoff?.collectorGps;
  const distanceMeters =
    collectorGps && coords
      ? distanceInMeters(coords, { latitude: collectorGps.latitude, longitude: collectorGps.longitude })
      : null;
  const isFar = distanceMeters != null && distanceMeters > DISTANCE_WARN_METERS;

  const handleScanned = async (code) => {
    setIsScannerVisible(false);
    if (isDirectAwaitingScan && !fetchedDirectTx) {
      try {
        const currentAgent = agent || await authService.getCurrentUser();
        if (!currentAgent?.id) {
          Alert.alert('Unable to Verify QR', 'Your account could not be loaded. Please try again.');
          return;
        }
        const result = await inventoryService.getTransactionByQrCodeForAgent(code, currentAgent.id);

        if (!result.success || !result.data) {
          if (friendlyError(result.message) === NO_INTERNET_MESSAGE) {
            Alert.alert('Needs Internet', 'Checking a delivery QR needs an internet connection. Connect and scan again.');
            return;
          }
          Alert.alert('Delivery Not Found', "This QR doesn't match any delivery assigned to you.");
          return;
        }

        const tx = result.data;
        if (tx.movementType !== 'direct') {
          Alert.alert(
            'Wrong Delivery Type',
            'This QR belongs to a collector delivery. Go back and use "Via Collector Delivery" instead.'
          );
          return;
        }

        if (tx.alreadyAccepted) {
          Alert.alert('Already Accepted', 'This batch was already accepted.');
          return;
        }

        setFetchedDirectTx({
          transactionId: tx.transactionId,
          qrCode: tx.qrCode,
          movementType: tx.movementType,
          releasedByName: tx.releasedByName,
          releasedByPhotoPath: tx.releasedByPhotoPath,
          targetRecipientId: tx.targetRecipientId,
          targetRecipientName: tx.targetRecipientName,
          branchName: tx.branchName,
          items: tx.items || [],
        });
        setScannedQrCode(code);
      } catch (error) {
        Alert.alert('Lookup Failed', friendlyError(error.message) || 'Could not load this delivery.');
      }
      return;
    }
    setScannedQrCode(code);
  };

  const handleSubmit = async () => {
    if (!agent || !photoUri || !scannedQrCode || isSubmitting) return;
    if (!isQrValid) {
      Alert.alert('QR Mismatch', 'The scanned QR does not match this delivery. Check the package label.');
      return;
    }
    setIsSubmitting(true);

    // The confirm RPCs store the position in gps_coordinates, where latitude
    // and longitude are NOT NULL — sending none fails with a raw database
    // error (seen on device Oct 13), and a queued offline copy would fail the
    // same way on every retry and block the outbox. The one-shot fix on open
    // can come back empty (location services off, or a slow first fix), so
    // look again here before giving up.
    let position = coords;
    if (!position) {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') position = await getRequiredPosition();
      } catch (error) {
        console.error('[ERROR] [SalesRepConfirmHandoffScreen] Location error:', error);
      }
    }
    if (!position) {
      setIsSubmitting(false);
      Alert.alert(
        'Location Needed',
        'Your location could not be found. Check that Location is turned on and ChemStock is allowed to use it, then try again.'
      );
      return;
    }

    const payload = {
      ...(isDirectMode
        ? { qrCode: scannedQrCode }
        : { transactionId: handoff.transactionId, scannedQrCode }),
      agentId: agent.id,
      latitude: position.latitude,
      longitude: position.longitude,
      deviceModel: Device.modelName,
      deviceOs: getDeviceOs(),
    };
    const outboxAction = isDirectMode ? 'receive_stock' : 'confirm_delivery_handoff';
    const receiptCopy = receiptDisplay({
      transactionId: handoff?.transactionId || effectiveDirectTx?.transactionId,
      qrCode: expectedQr || scannedQrCode,
      items: handoff?.items || effectiveDirectTx?.items,
      collectorPending: !isDirectMode && !!handoff?.collectorPending,
    });
    // Saved on the phone; the outbox sends it on its own, and for a collector
    // delivery the server completes it only once the Collector's side is in.
    const saveForLater = async (reason) => {
      await outboxService.enqueue(outboxAction, payload, photoUri, receiptCopy);
      const waiting = !isDirectMode && (reason === 'waiting' || receiptCopy.collectorPending);
      Alert.alert(
        waiting ? 'Received — Waiting for Collector' : 'Saved — Will Send Later',
        waiting
          ? "Saved on this phone. It completes automatically once the Collector's phone syncs their delivery — you don't need to do anything."
          : reason === 'dropped'
            ? 'Connection dropped. Your confirmation is saved on this phone and will sync automatically.'
            : "You're offline. Your confirmation is saved on this phone and will sync automatically once you're back online.",
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    };
    if (findQueuedReceipt({ transactionId: receiptCopy.transactionId, qrCode: receiptCopy.qrCode }, agent.id)) {
      setIsSubmitting(false);
      Alert.alert('Already Received', 'You already received this delivery on this phone. It will sync automatically once you are online.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
      return;
    }

    try {
      if (!getConnectionStatus().online) {
        await saveForLater('offline');
        return;
      }

      try {
        const storagePath = await inventoryService.uploadStockAcceptancePhoto(photoUri, agent.id);
        const result = isDirectMode
          ? await inventoryService.acceptStockRelease({ ...payload, storagePath })
          : await inventoryService.confirmDeliveryHandoff({ ...payload, storagePath });
        if (!result.success) throw new Error(result.message);
      } catch (liveError) {
        if (!getConnectionStatus().online) {
          await saveForLater('dropped');
          return;
        }
        // Online, but the Collector's "delivered" isn't on the server yet
        // (they marked it offline): save it and let it complete on its own.
        if (!isDirectMode && isWaitingForCollector(liveError.message)) {
          await saveForLater('waiting');
          return;
        }
        throw liveError;
      }

      Alert.alert('Confirmed', 'Your receipt is recorded. Stock has been credited to your inventory.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Failed to Confirm', friendlyError(error.message) || 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitIssue = async ({ reasonCode, reason, photoUri: issuePhoto }) => {
    if (!agent || isSubmitting || isDirectMode) return false;
    setIsSubmitting(true);

    const disputePayload = {
      agentId: agent.id,
      transactionId: handoff.transactionId,
      reason,
      reasonCode,
      deviceModel: Device.modelName,
      deviceOs: getDeviceOs(),
    };
    const issueCopy = receiptDisplay({ transactionId: handoff.transactionId, qrCode: expectedQr, items: [] });
    // Offline, or the Collector's side isn't synced yet: saved on the phone
    // and sent automatically.
    const saveIssueForLater = async () => {
      await outboxService.enqueue('dispute_delivery_handoff', disputePayload, issuePhoto || null, issueCopy);
      setIsIssueModalVisible(false);
      Alert.alert('Issue Saved', 'Your report is saved on this phone and will be sent to your manager automatically.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
      return true;
    };

    try {
      if (!getConnectionStatus().online) return await saveIssueForLater();
      let result;
      try {
        let storagePath = null;
        if (issuePhoto) {
          storagePath = await inventoryService.uploadStockAcceptancePhoto(issuePhoto, agent.id);
        }
        result = await inventoryService.disputeDeliveryHandoff({ ...disputePayload, storagePath });
        if (!result.success) throw new Error(result.message);
      } catch (liveError) {
        if (!getConnectionStatus().online || isWaitingForCollector(liveError.message)) return await saveIssueForLater();
        throw liveError;
      }
      setIsIssueModalVisible(false);
      Alert.alert('Reported', 'Your manager has been notified and will investigate.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
      return true;
    } catch (error) {
      Alert.alert('Failed to Report', friendlyError(error.message) || 'Please try again.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const productImageFor = (code) => PRODUCT_CATALOG.find((product) => product.code === code)?.image;

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton
          title="Verify Delivery"
          titleAlign="left"
          height={56}
          backgroundColor={COLORS.primary}
          textColor="#FFFFFF"
        />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.handoffCard}>
            <View style={styles.handoffTop}>
              <View style={styles.truckBadge}>
                <Icon name={isDirectMode ? 'package' : 'truck'} size={22} color={COLORS.primary} />
              </View>
              <View style={styles.handoffInfo}>
                <Text style={styles.handoffName}>
                  {isDirectMode
                    ? effectiveDirectTx
                      ? `Direct release from ${effectiveDirectTx.releasedByName || 'Manager'}`
                      : 'Direct release from Manager'
                    : `Received from ${handoff.collectorName || 'Collector'}`}
                </Text>
                <Text style={styles.handoffMeta}>
                  {isDirectMode
                    ? effectiveDirectTx?.branchName || 'Scan the QR to load the delivery'
                    : handoff.collectorPending
                      ? "Not marked delivered on the server yet — it's checked automatically when the Collector's phone syncs"
                      : `Marked delivered ${handoff.collectorClaimedAt
                        ? new Date(handoff.collectorClaimedAt).toLocaleString()
                        : 'by Collector'}`}
                </Text>
              </View>
            </View>
            {!isDirectMode && (
              <DeliveryHandoffStatusBadge status={handoff.handoffStatus || 'pending_sr'} />
            )}
            {!isDirectMode && !!mapDelivery && (
              <TouchableOpacity
                style={styles.viewMapButton}
                onPress={() => navigation.navigate('SalesRepDeliveryDetail', { delivery: mapDelivery })}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="View delivery on map"
              >
                <Icon name="location" size={16} color={COLORS.primary} />
                <Text style={styles.viewMapText}>View on map</Text>
                <Icon name="arrowRight" size={14} color={COLORS.primary} />
              </TouchableOpacity>
            )}
            {isFar && (
              <View style={styles.distanceWarn}>
                <Icon name="warningTriangle" size={14} color={COLORS.warning} />
                <Text style={styles.distanceWarnText}>
                  {handoff?.collectorPending
                    ? `You are ${formatDistance(distanceMeters)} from the delivery location`
                    : `You are ${formatDistance(distanceMeters)} from where the collector marked delivered`}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.sectionLabel}>Items</Text>
          <View style={styles.itemsCard}>
            {((handoff?.items) || (effectiveDirectTx?.items) || []).map((item, index) => {
              const image = productImageFor(item.productCode);
              return (
                <View
                  key={`${item.productCode}-${index}`}
                  style={[styles.itemRow, index === 0 && styles.itemRowFirst]}
                >
                  <View style={styles.itemIconWrap}>
                    {image ? (
                      <Image source={image} style={styles.itemIconImage} resizeMode="contain" />
                    ) : (
                      <Icon name="package" size={18} color={COLORS.primary} />
                    )}
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.productName}</Text>
                    {!!item.batchNumber && <Text style={styles.itemMeta}>BN: {item.batchNumber}</Text>}
                  </View>
                  <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
                </View>
              );
            })}
            {((handoff?.items) || (effectiveDirectTx?.items) || []).length === 0 && (
              <View style={{ padding: SPACING.md, alignItems: 'center' }}>
                <Text style={styles.emptyText}>
                  {isDirectAwaitingScan && !fetchedDirectTx
                    ? 'Scan the QR to load the items.'
                    : 'No items to show.'}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.sectionLabel}>Step 1 — Scan product QR</Text>
          {isQrValid ? (
            <View style={styles.stepDone}>
              <Icon name="checkCircle" size={18} color={COLORS.success} weight="fill" />
              <Text style={styles.stepDoneText}>
                {qrLookupResult === 'unchecked'
                  ? "QR saved — it's checked against this delivery when you're back online"
                  : 'QR verified — matches this delivery'}
              </Text>
            </View>
          ) : isQrChecking ? (
            <View style={styles.stepDone}>
              <Icon name="qrCode" size={18} color={COLORS.primary} />
              <Text style={styles.stepDoneText}>Checking QR…</Text>
            </View>
          ) : scannedQrCode ? (
            <View style={styles.stepError}>
              <Icon name="xCircle" size={18} color={COLORS.error} weight="fill" />
              <View style={styles.stepErrorInfo}>
                <Text style={styles.stepErrorText}>QR does not match this delivery</Text>
                <TouchableOpacity onPress={() => setIsScannerVisible(true)}>
                  <Text style={styles.stepErrorRetry}>Scan again</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.stepButton}
              onPress={() => setIsScannerVisible(true)}
              activeOpacity={0.8}
            >
              <Icon name="qrCode" size={20} color={COLORS.primary} />
              <Text style={styles.stepButtonText}>
                {isDirectAwaitingScan && !fetchedDirectTx
                  ? 'Scan the QR to load the delivery'
                  : 'Scan the QR on the package'}
              </Text>
              <Icon name="arrowRight" size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}

          <Text style={styles.sectionLabel}>Step 2 — Take receipt photo</Text>
          {photoUri ? (
            <TouchableOpacity
              style={styles.photoPreviewWrap}
              onPress={() => setIsCameraVisible(true)}
              activeOpacity={0.85}
            >
              <Image source={{ uri: photoUri }} style={styles.photoPreview} />
              <View style={styles.photoBadge}>
                <Icon name="checkCircle" size={14} color="#FFFFFF" weight="fill" />
                <Text style={styles.photoBadgeText}>Photo captured — tap to retake</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.stepButton}
              onPress={() => setIsCameraVisible(true)}
              activeOpacity={0.8}
            >
              <Icon name="camera" size={20} color={COLORS.primary} />
              <Text style={styles.stepButtonText}>Take a photo of the received items</Text>
              <Icon name="arrowRight" size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}

          <Button
            title={isSubmitting ? 'Confirming…' : 'Verify & Confirm'}
            variant="black"
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting || !isQrValid || !photoUri}
            height={50}
            fontSize={15}
            style={styles.confirmButton}
          />

          {!isDirectMode && (
            <TouchableOpacity
              onPress={() => setIsIssueModalVisible(true)}
              style={styles.issueLink}
              activeOpacity={0.7}
              disabled={isSubmitting}
            >
              <Icon name="warningTriangle" size={14} color={COLORS.error} />
              <Text style={styles.issueLinkText}>Report an issue</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: Math.max(insets.bottom, SPACING.lg) + 16 }} />
        </ScrollView>
      </View>

      <QRScannerModal
        visible={isScannerVisible}
        onClose={() => setIsScannerVisible(false)}
        onScanned={handleScanned}
      />

      <CameraCaptureModal
        visible={isCameraVisible}
        onClose={() => setIsCameraVisible(false)}
        onCapture={setPhotoUri}
      />

      {!isDirectMode && (
        <ReportHandoffIssueModal
          visible={isIssueModalVisible}
          onCancel={() => setIsIssueModalVisible(false)}
          onSubmit={handleSubmitIssue}
          isSubmitting={isSubmitting}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  viewMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm + 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  viewMapText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.primary,
  },
  container: { flex: 1, backgroundColor: COLORS.background },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  content: { padding: SPACING.lg, gap: SPACING.md },
  handoffCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  handoffTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  truckBadge: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  handoffInfo: { flex: 1 },
  handoffName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textPrimary,
  },
  handoffMeta: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  distanceWarn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    padding: SPACING.sm, borderRadius: 8,
    backgroundColor: '#FFF8E1',
    borderWidth: 1, borderColor: '#F2C94C',
  },
  distanceWarnText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: '#7A4A00',
  },
  sectionLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textTertiary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: SPACING.sm,
  },
  itemsCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: COLORS.borderSubtle,
    borderRadius: 8, overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    padding: SPACING.sm,
    borderTopWidth: 1, borderTopColor: '#F4F5F7',
  },
  itemRowFirst: { borderTopWidth: 0 },
  itemIconWrap: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: '#EEF2FF',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  itemIconImage: { width: '100%', height: '100%' },
  itemInfo: { flex: 1 },
  itemName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textPrimary,
  },
  itemMeta: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  itemQty: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textPrimary,
  },
  stepButton: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: COLORS.borderSubtle,
    borderRadius: 8, padding: SPACING.md,
  },
  stepButtonText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: COLORS.textPrimary,
  },
  stepDone: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    padding: SPACING.sm, borderRadius: 8,
    backgroundColor: COLORS.success + '10',
    borderWidth: 1, borderColor: COLORS.success + '40',
  },
  stepDoneText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: COLORS.success,
  },
  stepError: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    padding: SPACING.sm, borderRadius: 8,
    backgroundColor: COLORS.error + '10',
    borderWidth: 1, borderColor: COLORS.error + '40',
  },
  stepErrorInfo: { flex: 1 },
  stepErrorText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: COLORS.error,
  },
  stepErrorRetry: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
  photoPreviewWrap: {
    height: 180, borderRadius: 8, overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    borderWidth: 1, borderColor: COLORS.success,
  },
  photoPreview: { width: '100%', height: '100%' },
  photoBadge: {
    position: 'absolute', bottom: SPACING.sm, left: SPACING.sm,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING.sm, paddingVertical: 4,
    borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.6)',
  },
  photoBadgeText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: '#FFFFFF',
  },
  confirmButton: { width: '100%', marginTop: SPACING.sm },
  issueLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: SPACING.sm, alignSelf: 'center',
  },
  issueLinkText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: COLORS.error,
  },
});
