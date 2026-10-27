// src/screens/salesrep/ResolveDiscrepancyScreen.js
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, ActivityIndicator, StyleSheet } from 'react-native';
import Alert from '../../utils/appAlert';
import { StatusBar } from 'expo-status-bar';
import { BlurTargetView } from 'expo-blur';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import Header from '../../components/common/Header';
import Icon from '../../components/common/Icon';
import OutboxFailedNotice from '../../components/common/OutboxFailedNotice';
import Button from '../../components/common/Button';
import BottomActionBar, { useBottomActionBarHeight } from '../../components/common/BottomActionBar';
import CameraCaptureModal from '../../components/common/CameraCaptureModal';
import { TYPOGRAPHY } from '../../styles/typography';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import authService from '../../services/authService';
import inventoryService from '../../services/inventoryService';
import reportService from '../../services/reportService';
import outboxService from '../../services/outboxService';
import { supabase } from '../../services/supabaseClient';
import { getConnectionStatus } from '../../services/connectionStatus';
import useOutbox from '../../hooks/useOutbox';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import { formatDateTime } from '../../utils/formatters';
import friendlyError from '../../utils/friendlyError';
import { getDeviceOs } from '../../utils/deviceInfo';

const SHIPMENT_BUCKET = 'shipment-media';
const LOCATION_TIMEOUT_MS = 8000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Location request timed out')), ms)),
  ]);
}

/**
 * Resolves a GPS fix without blocking the whole submit on a cold lock.
 * Tries the device's last-known position first (near-instant, no GPS wait)
 * and only falls back to a fresh, time-boxed fix if there isn't one.
 * request_discrepancy_resolution's gps_coordinates row is NOT NULL on the
 * server, so unlike other screens' "best effort" location, this one returns
 * null on failure instead of silently proceeding — the caller must block.
 */
async function resolveCoordsOrNull() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
  } catch {
    return null;
  }

  try {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 });
    if (last) return { latitude: last.coords.latitude, longitude: last.coords.longitude };
  } catch (error) {
    console.error('[ERROR] [ResolveDiscrepancyScreen] getLastKnownPositionAsync error:', error);
  }

  try {
    const fresh = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      LOCATION_TIMEOUT_MS
    );
    return { latitude: fresh.coords.latitude, longitude: fresh.coords.longitude };
  } catch (error) {
    console.error('[ERROR] [ResolveDiscrepancyScreen] getCurrentPositionAsync error:', error);
    return null;
  }
}

/**
 * Reached only from AlertsDiscrepanciesSR — resolves ONE discrepant report
 * item. Per Jay's explicit instruction: no QR, photo proof only. The
 * quantity is fixed (the discrepancy amount itself), not user-adjustable.
 */
export default function ResolveDiscrepancyScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const reportItem = route.params?.reportItem;

  const [agent, setAgent] = useState(null);
  const blurTarget = useRef(null);
  const bottomActionBarHeight = useBottomActionBarHeight();
  const [photoUri, setPhotoUri] = useState(null);
  const [photoCoords, setPhotoCoords] = useState(null);
  const [uploadedPhoto, setUploadedPhoto] = useState(null); // { uri, storagePath } — avoids re-upload on retry
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [isViewingSubmittedPhoto, setIsViewingSubmittedPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { pending, pendingCount, failed: failedItems, retryNow, discard } = useOutbox('discrepancy_resolution', agent?.id ?? null);

  const [requestDetail, setRequestDetail] = useState(null);
  const [requestPhotoUrl, setRequestPhotoUrl] = useState(null);
  const [isDetailLoaded, setIsDetailLoaded] = useState(false);

  // Already queued offline for this exact item — block a second submission
  // outright rather than letting the form re-collect a photo that has
  // nowhere new to go.
  const queuedEntry = pending.find((entry) => entry.payload?.reportItemId === reportItem?.reportItemId);
  const alreadyQueued = !!queuedEntry;

  // Also already pending on the SERVER (synced from a prior visit).
  const alreadyPendingReview = reportItem?.latestRequest?.status === 'pending';
  const isSettled = reportItem?.resolutionStatus === 'resolved';
  const wasRejected = !alreadyQueued && !alreadyPendingReview && !isSettled && reportItem?.latestRequest?.status === 'rejected';
  const isLocked = alreadyQueued || alreadyPendingReview || isSettled;

  useEffect(() => {
    authService.getCurrentUser().then(setAgent);
  }, []);

  // Pulls the full submitted-request detail (photo, GPS, device, timing) for
  // a request that already exists server-side — same data Reports & Returns
  // shows the manager, reused here read-only so the agent can see what they
  // sent instead of being told nothing more than "pending."
  useEffect(() => {
    let cancelled = false;
    async function loadDetail() {
      if (!agent?.id || !reportItem?.latestRequest?.id) return;
      if (!alreadyPendingReview && !isSettled) return;

      // Always marks the load as attempted, success or failure — previously
      // a failed fetch (e.g. offline) returned early without ever setting
      // this, leaving the photo spinner stuck forever instead of falling
      // back to "Photo unavailable."
      try {
        const result = await reportService.getMyReturnRequests(agent.id, 50);
        if (cancelled || !result.success) return;

        const match = result.data.find((r) => r.resolutionRequestId === reportItem.latestRequest.id);
        if (!match) return;
        setRequestDetail(match);

        if (match.media?.storagePath) {
          const { data } = await supabase.storage
            .from(SHIPMENT_BUCKET)
            .createSignedUrl(match.media.storagePath, 600);
          if (!cancelled) setRequestPhotoUrl(data?.signedUrl || null);
        }
      } finally {
        if (!cancelled) setIsDetailLoaded(true);
      }
    }
    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [agent?.id, reportItem?.latestRequest?.id, alreadyPendingReview, isSettled]);

  const handleBack = () => navigation.goBack();

  const handleOpenCamera = () => setIsCameraVisible(true);

  // CameraCaptureModal already resolves GPS the moment the shot is taken
  // (onCapture's 2nd arg) — reusing it here means handleSubmit usually needs
  // no location call of its own at all, instead of the screen re-fetching a
  // fresh GPS fix from scratch on every submit attempt.
  const handleCaptured = (uri, coords) => {
    setPhotoUri(uri);
    setPhotoCoords(coords || null);
    setIsCameraVisible(false);
  };

  const ensureUploadedPhoto = async (agentId) => {
    if (uploadedPhoto?.uri === photoUri) return uploadedPhoto.storagePath;
    const storagePath = await inventoryService.uploadDiscrepancyPhoto(photoUri, agentId);
    setUploadedPhoto({ uri: photoUri, storagePath });
    return storagePath;
  };

  const handleSubmit = async () => {
    if (isLocked) return;

    if (!photoUri) {
      Alert.alert('Photo Required', 'Please attach a photo before requesting a return.');
      return;
    }

    setIsSubmitting(true);
    // Shown on Return Stocks as "waiting for connection" until it syncs.
    const returnCopy = { productCode: reportItem.productCode, productName: reportItem.productName };
    try {
      const currentAgent = agent || (await authService.getCurrentUser());

      // Reuse the fix taken alongside the photo when we have one — only
      // resolve a new one (last-known first, fresh fix as a bounded
      // fallback) if the capture didn't already get one in time.
      const coords = photoCoords || (await resolveCoordsOrNull());

      if (!coords) {
        Alert.alert(
          'Location Required',
          "This request needs your device's location. Enable Location Services and make sure ChemStock has location permission, then try again."
        );
        return;
      }

      const requestPayload = {
        agentId: currentAgent?.id,
        reportItemId: reportItem.reportItemId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        deviceModel: Device.modelName || null,
        deviceOs: getDeviceOs() || null,
      };

      // Already known offline — don't even attempt the live call.
      if (!getConnectionStatus().online) {
        await outboxService.enqueue('discrepancy_resolution', requestPayload, photoUri, returnCopy);
        Alert.alert(
          'Saved — Will Send Later',
          "You're offline. Your return request and photo proof are saved on this device and will upload automatically once you're back online.",
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }

      try {
        const storagePath = await ensureUploadedPhoto(currentAgent?.id);
        const result = await reportService.requestDiscrepancyResolution({ ...requestPayload, storagePath });

        if (!result.success) {
          Alert.alert('Request Failed', friendlyError(result.message) || 'Could not submit your return request.');
          return;
        }
      } catch (liveError) {
        // A failure that leaves us offline is a network problem, not a real
        // rejection — queue it instead of showing an error. Anything else
        // (still online) is a genuine failure, handled below as before.
        if (!getConnectionStatus().online) {
          await outboxService.enqueue('discrepancy_resolution', requestPayload, photoUri, returnCopy);
          Alert.alert(
            'Saved — Will Send Later',
            "Connection dropped mid-submit. Your return request and photo proof are saved on this device and will upload automatically once you're back online.",
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
          return;
        }
        throw liveError;
      }

      Alert.alert('Request Sent', 'Your return request has been sent to your manager for review.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Request Failed', friendlyError(error.message) || 'Could not submit your return request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!reportItem) {
    return (
      <View style={styles.screen}>
        <Header
          showBackButton
          title="Resolve Discrepancy"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
          onBackPress={handleBack}
        />
        <View style={styles.loadingWrap}>
          <Text style={styles.emptyText}>This discrepancy could not be loaded.</Text>
        </View>
      </View>
    );
  }

  const isLoss = reportItem.discrepancyType === 'loss';
  const isCarryForward = reportItem.carryForwardEnabled && isLoss;
  // alreadyQueued (offline, unsynced) has only the local file; a synced
  // request's photo comes from storage via the signed URL above.
  const displayPhotoUrl = alreadyQueued ? queuedEntry?.localPhotoUri : requestPhotoUrl;

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <Header
          showBackButton
          title="Resolve Discrepancy"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
          onBackPress={handleBack}
        />

        <BlurTargetView ref={blurTarget} style={styles.contentTarget}>
        <ScrollView contentContainerStyle={[styles.content, !isLocked && { paddingBottom: bottomActionBarHeight + SPACING.lg }]} showsVerticalScrollIndicator={false}>
          {pendingCount > 0 && (
            <View style={styles.pendingBanner}>
              <View style={styles.pendingIconCircle}>
                <Icon name="clock" size={14} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingBannerTitle}>
                  Pending — {pendingCount} waiting to send
                </Text>
                <Text style={styles.pendingBannerText}>
                  Saved on this device. Sends automatically once you're back online.
                </Text>
              </View>
              <Pressable onPress={retryNow} style={styles.pendingRetryButton}>
                <Text style={styles.pendingRetryText}>Retry</Text>
              </Pressable>
            </View>
          )}

          <OutboxFailedNotice failed={failedItems} agentId={agent?.id} onRetry={retryNow} onDiscard={discard} />

          {isLocked && (
            <View style={[styles.statusWrap, isSettled ? styles.statusWrapSettled : styles.statusWrapPending]}>
              <View style={[styles.statusIconCircle, isSettled ? styles.statusIconCircleSettled : styles.statusIconCirclePending]}>
                <Icon name={isSettled ? 'check' : 'clock'} size={16} color="#FFFFFF" weight="bold" />
              </View>
              <View style={styles.statusTextCol}>
                <Text style={[styles.statusTitle, isSettled ? styles.statusTitleSettled : styles.statusTitlePending]}>
                  {isSettled ? 'Settled' : alreadyQueued ? 'Saved — waiting to send' : 'Waiting for manager review'}
                </Text>
                <Text style={[styles.statusText, isSettled ? styles.statusTextSettled : styles.statusTextPending]}>
                  {isSettled
                    ? 'Your manager approved this return and it has been settled.'
                    : alreadyQueued
                    ? "You requested this return while offline. It uploads automatically once you're back online — no need to submit it again."
                    : "This return was already sent and is waiting on your manager's review — no need to submit it again."}
                </Text>
              </View>
            </View>
          )}

          {wasRejected && (
            <View style={styles.rejectedBanner}>
              <View style={styles.rejectedIconCircle}>
                <Icon name="warningTriangle" size={14} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rejectedBannerTitle}>Last request was rejected</Text>
                <Text style={styles.rejectedBannerText}>
                  {reportItem.latestRequest.rejectReason
                    ? reportItem.latestRequest.rejectReason
                    : 'Your manager rejected this request.'}{' '}
                  You can resubmit below with a new photo.
                </Text>
              </View>
            </View>
          )}

          <View style={styles.itemCard}>
            <View style={styles.itemTopRow}>
              <View style={styles.thumbnail}>
                {PRODUCT_CATALOG.find((p) => p.code === reportItem.productCode)?.image ? (
                  <Image
                    source={PRODUCT_CATALOG.find((p) => p.code === reportItem.productCode).image}
                    style={styles.thumbnailImage}
                    resizeMode="contain"
                  />
                ) : (
                  <Icon name="package" size={26} color="#94a3b8" />
                )}
              </View>
              <View style={styles.itemDetails}>
                <Text style={styles.itemCode} numberOfLines={1}>{reportItem.productCode}</Text>
                <Text style={styles.itemFullName} numberOfLines={1}>{reportItem.productName}</Text>
              </View>
            </View>

            <View style={styles.figuresRow}>
              <View style={styles.figureColumn}>
                <View style={styles.figureLabelRow}>
                  <Icon name="trayDown" size={11} color="#272632" />
                  <Text style={styles.figureLabel}>Custody</Text>
                </View>
                <View style={styles.figureBox}>
                  <Text style={styles.figureValue}>{reportItem.inCustodyQuantity}</Text>
                </View>
              </View>
              <View style={styles.figureColumn}>
                <View style={styles.figureLabelRow}>
                  <Icon name="checkCircle" size={11} color="#272632" />
                  <Text style={styles.figureLabel}>Sold</Text>
                </View>
                <View style={styles.figureBox}>
                  <Text style={styles.figureValue}>{reportItem.soldQuantity}</Text>
                </View>
              </View>
              <View style={styles.figureColumn}>
                <View style={styles.figureLabelRow}>
                  <Icon name="returns" size={11} color="#272632" />
                  <Text style={styles.figureLabel}>Return</Text>
                </View>
                <View style={styles.figureBox}>
                  <Text style={styles.figureValue}>{reportItem.returnQuantity}</Text>
                </View>
              </View>
              <View style={styles.figureColumn}>
                <View style={styles.figureLabelRow}>
                  <Icon name="warningTriangle" size={11} color={isCarryForward ? '#B26400' : '#B91C1C'} />
                  <Text style={[styles.figureLabel, isCarryForward ? styles.carryForwardLabel : styles.discrepancyLabel]}>
                    {isCarryForward ? 'Carry fwd.' : isLoss ? 'Missing' : 'Over'}
                  </Text>
                </View>
                <View style={[styles.figureBox, isCarryForward ? styles.figureBoxCarryForward : styles.figureBoxError]}>
                  <Text style={[styles.figureValue, isCarryForward ? styles.figureValueCarryForward : styles.figureValueError]}>
                    {Math.abs(reportItem.discrepancy)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {!isLocked && (
            <Text style={styles.helperText}>
              {isCarryForward
                ? `These units were not included in the report and remain in your inventory. Request a return only for units you are physically handing back; manager approval removes them from your inventory and credits the branch.`
                : isLoss
                ? `This will request the return of the ${Math.abs(reportItem.discrepancy)} missing unit(s) once your manager reviews the photo evidence below.`
                : `This will flag the ${Math.abs(reportItem.discrepancy)} extra unit(s) reported for manager review with the photo evidence below.`}
            </Text>
          )}

          {/* Photo Proof is the screen's own frame, not a bordered card —
              matches the open-capture state and the read-only states alike. */}
          {!isLocked ? (
            <View style={styles.photoSection}>
              <Text style={styles.listTitle}>Photo Proof</Text>
              <Pressable onPress={handleOpenCamera}>
                {photoUri ? (
                  <View style={styles.photoPreviewWrap}>
                    <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
                    <View style={styles.expandBadge}>
                      <Icon name="expand" size={14} color="#FFFFFF" />
                    </View>
                  </View>
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <View style={styles.cameraCircle}>
                      <Icon name="camera" size={26} color="#03045E" />
                    </View>
                    <Text style={styles.photoText}>Tap to capture proof</Text>
                  </View>
                )}
              </Pressable>
            </View>
          ) : (
            <View style={styles.photoSection}>
              <Text style={styles.sectionLabel}>{isSettled ? 'EVIDENCE' : 'PHOTO PROOF'}</Text>
              <View style={styles.evidenceCard}>
                {displayPhotoUrl ? (
                  <Pressable onPress={() => setIsViewingSubmittedPhoto(true)} accessibilityLabel="View photo" accessibilityRole="button">
                    <View style={styles.evidenceThumbWrap}>
                      <Image source={{ uri: displayPhotoUrl }} style={styles.evidenceThumb} resizeMode="cover" />
                      <View style={styles.expandBadgeSmall}>
                        <Icon name="expand" size={12} color="#FFFFFF" />
                      </View>
                    </View>
                  </Pressable>
                ) : (
                  <View style={[styles.evidenceThumbWrap, styles.evidenceThumbEmpty]}>
                    {!isDetailLoaded && !alreadyQueued ? (
                      <ActivityIndicator color={COLORS.primary} />
                    ) : (
                      <>
                        <Icon name="package" size={24} color="#94a3b8" />
                        <Text style={styles.evidenceEmptyText}>No photo</Text>
                      </>
                    )}
                  </View>
                )}

                {requestDetail && (
                  <View style={styles.evidenceDetails}>
                    {requestDetail.gps && (
                      <View style={styles.evidenceRow}>
                        <Icon name="location" size={15} color="#F04D59" />
                        <Text style={styles.evidenceText}>
                          {requestDetail.gps.latitude.toFixed(4)}°, {requestDetail.gps.longitude.toFixed(4)}°
                        </Text>
                      </View>
                    )}
                    {requestDetail.media?.deviceModel && (
                      <View style={styles.evidenceRow}>
                        <Icon name="package" size={15} color="#0085F9" />
                        <Text style={styles.evidenceText}>{requestDetail.media.deviceModel}</Text>
                      </View>
                    )}
                    <View style={styles.evidenceRow}>
                      <Icon name="clock" size={15} color="#00B4D8" />
                      <Text style={styles.evidenceText}>
                        {isSettled ? 'Settled ' : 'Requested '}
                        {formatDateTime(new Date(requestDetail.resolvedAt && isSettled ? requestDetail.resolvedAt : requestDetail.createdAt))}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}
        </ScrollView>

        </BlurTargetView>

        {!isLocked && (
          <BottomActionBar variant="glass" blurTarget={blurTarget}>
            {!photoUri && !isSubmitting && <Text style={styles.barHint}>A photo is required.</Text>}
            <Button
              title="Request Return Stock"
              variant="black"
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={isSubmitting}
              height={48}
              fontSize={16}
              borderRadius={24}
            />
          </BottomActionBar>
        )}
      </View>

      <CameraCaptureModal
        visible={isCameraVisible}
        onClose={() => setIsCameraVisible(false)}
        onCapture={handleCaptured}
        initialUri={photoUri}
      />

      {/* Read-only viewer for an already-submitted photo — same pattern
          ManageReturnsScreen.js uses to show a report photo to the manager. */}
      <CameraCaptureModal
        visible={isViewingSubmittedPhoto}
        onClose={() => setIsViewingSubmittedPhoto(false)}
        onCapture={() => {}}
        initialUri={displayPhotoUrl}
        readOnly
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentTarget: { flex: 1 },
  sectionLabel: { marginBottom: 8, fontSize: 12, letterSpacing: 0.8, color: '#6B7280', fontFamily: TYPOGRAPHY.fontFamily.semibold, fontWeight: '600' },
  statusTextCol: { flex: 1 },
  statusWrapPending: { backgroundColor: '#FFF1D6', borderColor: '#F2C94C' },
  statusIconCirclePending: { backgroundColor: '#B26400' },
  statusTitlePending: { color: '#7A4A00' },
  statusTextPending: { color: '#7A4A00' },
  evidenceCard: { flexDirection: 'row', gap: 12, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#EAEFF5', backgroundColor: '#FFFFFF' },
  evidenceThumbWrap: { width: 96, height: 96, borderRadius: 10, overflow: 'hidden' },
  evidenceThumb: { width: '100%', height: '100%' },
  evidenceThumbEmpty: { backgroundColor: '#F1F3F6', alignItems: 'center', justifyContent: 'center', gap: 4 },
  evidenceEmptyText: { fontSize: 11, color: '#6B7280', fontFamily: TYPOGRAPHY.fontFamily.medium },
  expandBadgeSmall: { position: 'absolute', bottom: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(3,4,94,0.55)', alignItems: 'center', justifyContent: 'center' },
  evidenceDetails: { flex: 1, justifyContent: 'center', gap: 8 },
  evidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  evidenceText: { flex: 1, fontSize: 12, color: '#272632', fontFamily: TYPOGRAPHY.fontFamily.semibold, fontWeight: '600' },
  cameraCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#E6E8F5', alignItems: 'center', justifyContent: 'center' },
  barHint: { marginBottom: 8, fontSize: 12, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.regular },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF1D6',
    borderWidth: 1,
    borderColor: '#F2C94C',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  pendingIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#B26400',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingBannerTitle: {
    fontSize: 13,
    color: '#7A4A00',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  pendingBannerText: {
    fontSize: 12,
    color: '#7A4A00',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  pendingRetryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#B26400',
  },
  pendingRetryText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  statusWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#EAFBF2',
    borderWidth: 1,
    borderColor: '#A7E8C4',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  statusWrapSettled: {
    backgroundColor: '#E1F4E8',
    borderColor: '#A7E8C4',
  },
  statusIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E7A3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIconCircleSettled: {
    backgroundColor: '#1E7A3A',
  },
  statusTitle: {
    fontSize: 14,
    color: '#1E7A3A',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  statusTitleSettled: {
    color: '#1E7A3A',
  },
  statusText: {
    fontSize: 12,
    color: '#2F6B48',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
    lineHeight: 16,
  },
  statusTextSettled: {
    color: '#2F6B48',
  },
  rejectedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FBDCDC',
    borderWidth: 1,
    borderColor: '#F3B4B4',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  rejectedIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#B91C1C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectedBannerTitle: {
    fontSize: 13,
    color: '#8A1515',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  rejectedBannerText: {
    fontSize: 12,
    color: '#8A1515',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
    lineHeight: 16,
  },
  itemCard: {
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  itemTopRow: {
    flexDirection: 'row',
  },
  thumbnail: {
    width: 52,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#F1F3F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  thumbnailImage: {
    width: '70%',
    height: '70%',
  },
  itemDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  itemCode: {
    fontSize: 15,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  itemFullName: {
    fontSize: 12,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  figuresRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  figureColumn: {
    flex: 1,
  },
  figureLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  figureLabel: {
    fontSize: 12,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  discrepancyLabel: {
    color: '#B91C1C',
  },
  carryForwardLabel: { color: '#8A5A00' },
  figureBox: {
    borderWidth: 1,
    borderColor: '#DBE4EE',
    borderRadius: 8,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  figureBoxError: {
    borderColor: '#EF4444',
    backgroundColor: '#FFFFFF',
  },
  figureBoxCarryForward: {
    borderColor: '#F4D28B',
    backgroundColor: '#FFF7E6',
  },
  figureValue: {
    fontSize: 13,
    color: '#03045E',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  figureValueError: {
    color: '#EF4444',
  },
  figureValueCarryForward: { color: '#8A5A00' },
  helperText: {
    fontSize: 12,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    lineHeight: 18,
    marginBottom: 18,
  },
  photoSection: {
    marginTop: 4,
  },
  listTitle: {
    color: '#272632',
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    marginBottom: 10,
  },
  photoPlaceholder: {
    borderWidth: 1.5,
    borderColor: '#D7E3F1',
    borderStyle: 'dashed',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoText: {
    marginTop: 8,
    color: '#555353',
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  photoPreviewWrap: {
    position: 'relative',
    width: '100%',
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  expandBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(3,4,94,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EAEFF5',
    paddingHorizontal: 12,
    marginTop: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    color: '#555353',
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  detailValue: {
    color: '#272632',
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
  },
  primaryButton: {
    backgroundColor: '#03045E',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: '#B5BEC9',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
});
