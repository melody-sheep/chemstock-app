// src/screens/salesrep/ReceiveStockSR.js
import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import Icon from '../../components/common/Icon';
import Button from '../../components/common/Button';
import UserAvatar from '../../components/common/UserAvatar';
import QRScannerModal from '../../components/common/QRScannerModal';
import CameraCaptureModal from '../../components/common/CameraCaptureModal';
import authService from '../../services/authService';
import inventoryService from '../../services/inventoryService';
import outboxService from '../../services/outboxService';
import { getConnectionStatus } from '../../services/connectionStatus';
import useConnectionStatus from '../../hooks/useConnectionStatus';
import useOutbox from '../../hooks/useOutbox';
import { getInitials } from '../../utils/initials';
import { formatClockTime } from '../../utils/formatters';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../styles/typography';

// Passed from ReceiveStockTypeSR. Used both pre-scan (what the user
// *expects* to receive) and as a hard gate once a QR resolves — the server's
// batch.movementType must match the chosen handoff type, or the scan is
// rejected (see handleScanned). The source card below is still built from
// batch.movementType, the authoritative value, not this param.
const HANDOFF_LABELS = {
  manager: 'Direct From Manager',
  rider: 'Via Collector Delivery',
};

export default function ReceiveStockSR() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const { handoffType } = route.params || {};

  const [agent, setAgent] = useState(null);
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState(null);
  const [batch, setBatch] = useState(null);

  const [coords, setCoords] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [photoUri, setPhotoUri] = useState(null);
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAccepted, setIsAccepted] = useState(false);
  const [isQueuedAccept, setIsQueuedAccept] = useState(false);
  const connection = useConnectionStatus();
  const { pendingCount, retryNow } = useOutbox('receive_stock');

  useEffect(() => {
    authService.getCurrentUser().then(setAgent);
  }, []);

  const deviceLabel = [Device.modelName, Device.osName, Device.osVersion].filter(Boolean).join(' - ');

  const handleBack = () => navigation.goBack();

  useEffect(() => {
    const initialQrCode = route.params?.initialQrCode;
    if (!initialQrCode) return;
    navigation.setParams({ initialQrCode: undefined });
    handleScanned(initialQrCode);
  }, [route.params?.initialQrCode]);

  const handleScanned = async (qrCode) => {
    setIsScannerVisible(false);
    setIsLookingUp(true);
    setLookupError(null);

    const currentAgent = agent || (await authService.getCurrentUser());
    const result = await inventoryService.getTransactionByQrCodeForAgent(qrCode, currentAgent?.id);
    setIsLookingUp(false);

    if (!result.success) {
      setLookupError(result.message || 'Transaction not found or not assigned to you.');
      return;
    }
    if (result.data.alreadyAccepted) {
      setLookupError('This batch has already been accepted.');
      return;
    }

    // Jay's explicit ask: the handoff-type button the SR picked to get into
    // the scanner must actually gate what they're allowed to scan, not just
    // be cosmetic — scanning a direct-from-manager QR via "Via Collector
    // Delivery" (or vice versa) is now rejected instead of silently
    // resolving to whatever the QR really is.
    const expectedMovementType = handoffType === 'rider' ? 'collector' : handoffType === 'manager' ? 'direct' : null;
    if (expectedMovementType && result.data.movementType !== expectedMovementType) {
      const actualLabel = result.data.movementType === 'collector' ? 'Via Collector Delivery' : 'Direct From Manager';
      setLookupError(`This batch was released as "${actualLabel}" — go back and choose that option instead.`);
      return;
    }

    setBatch(result.data);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission denied');
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch (error) {
      console.error('[ERROR] [ReceiveStockSR] Location error:', error);
      setLocationError('Unable to determine location');
    }
  };

  const handleRetry = () => {
    setLookupError(null);
    setBatch(null);
    setIsScannerVisible(true);
  };

  const totalUnits = (batch?.items || []).reduce((sum, item) => sum + item.quantity, 0);
  const isCollectorSource = batch?.movementType === 'collector';
  const sourceName = isCollectorSource ? batch?.receivedByName : batch?.releasedByName;
  const sourcePhotoUrl = isCollectorSource ? batch?.receivedByPhotoUrl : batch?.releasedByPhotoUrl;
  const sourceRole = isCollectorSource ? 'Collector' : 'Branch Manager';

  const handleAccept = async () => {
    if (!agent || !photoUri || !batch || isSubmitting) return;
    setIsSubmitting(true);

    // The scan + lookup that produced `batch` always happened live — a QR
    // code carries no data of its own, so only this final confirmation step
    // can ever be queued. Mirrors the daily report / return request pattern.
    const acceptPayload = {
      qrCode: batch.qrCode,
      agentId: agent.id,
      latitude: coords?.latitude,
      longitude: coords?.longitude,
      deviceModel: Device.modelName,
      deviceOs: `${Device.osName || ''} ${Device.osVersion || ''}`.trim(),
    };

    try {
      if (!getConnectionStatus().online) {
        await outboxService.enqueue('receive_stock', acceptPayload, photoUri);
        setIsQueuedAccept(true);
        setIsAccepted(true);
        return;
      }

      try {
        const storagePath = await inventoryService.uploadStockAcceptancePhoto(photoUri, agent.id);
        const result = await inventoryService.acceptStockRelease({ ...acceptPayload, storagePath });
        if (!result.success) {
          throw new Error(result.message);
        }
      } catch (liveError) {
        if (!getConnectionStatus().online) {
          await outboxService.enqueue('receive_stock', acceptPayload, photoUri);
          setIsQueuedAccept(true);
          setIsAccepted(true);
          return;
        }
        throw liveError;
      }

      setIsAccepted(true);
    } catch (error) {
      Alert.alert('Failed to Accept Stock', error.message || 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDone = () => navigation.navigate('SalesRepDashboard');

  if (isAccepted) {
    return (
      <>
        <StatusBar style="light" />
        <View style={styles.screen}>
          <View style={[styles.topBar, { height: 56 + insets.top, paddingTop: insets.top }]}>
            <Text style={styles.topBarTitle}>{isQueuedAccept ? 'Saved — Will Send Later' : 'Stock Accepted'}</Text>
          </View>
          <View style={styles.successWrap}>
            <Icon
              name={isQueuedAccept ? 'clock' : 'checkCircle'}
              size={48}
              color={isQueuedAccept ? COLORS.warning : COLORS.success}
              weight="fill"
            />
            <Text style={styles.successTitle}>
              {isQueuedAccept ? "You're Offline — Saved On This Device" : 'Stock Accepted Successfully'}
            </Text>
            <Text style={styles.successSubtitle}>
              {isQueuedAccept
                ? `Your confirmation for ${batch?.items?.length || 0} item${(batch?.items?.length || 0) === 1 ? '' : 's'} (${totalUnits} units) is saved and will send automatically once you're back online.`
                : `${batch?.items?.length || 0} item${(batch?.items?.length || 0) === 1 ? '' : 's'}, ${totalUnits} units added to your stock`}
            </Text>
            <Button title="Done" variant="black" onPress={handleDone} style={styles.doneButton} />
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <View style={[styles.topBar, { height: 56 + insets.top, paddingTop: insets.top }]}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Icon name="arrowLeft" size={20} color="#FFFFFF" />
          </Pressable>

          <Text style={styles.topBarTitle}>Receive Stock</Text>

          <View style={[styles.statusPill, !connection.online && styles.statusPillOffline]}>
            <View style={[styles.statusDot, !connection.online && styles.statusDotOffline]} />
            <Text style={[styles.statusText, !connection.online && styles.statusTextOffline]} numberOfLines={1}>
              {connection.online ? 'Online' : `Offline · ${formatClockTime(connection.lastOnlineAt)}`}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {pendingCount > 0 && (
            <View style={styles.pendingBanner}>
              <View style={styles.pendingIconCircle}>
                <Icon name="clock" size={14} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingBannerTitle}>Pending — {pendingCount} waiting to sync</Text>
                <Text style={styles.pendingBannerText}>
                  Saved on this device. Sends automatically once you're back online.
                </Text>
              </View>
              <Pressable onPress={retryNow} style={styles.pendingRetryButton}>
                <Text style={styles.pendingRetryText}>Retry</Text>
              </Pressable>
            </View>
          )}

          {!batch && (
            <>
              <View style={styles.sectionHeaderPanel}>
                <Text style={styles.sectionLabel}>Scanning Incoming Batch</Text>
                <Text style={styles.sectionSubLabel}>
                  {HANDOFF_LABELS[handoffType] || 'Receive Stock'}
                </Text>
              </View>

              <Pressable style={styles.scanButton} onPress={() => setIsScannerVisible(true)} disabled={isLookingUp}>
                <View style={styles.scanIconWrap}>
                  <Icon name="qrCode" size={26} color="#03045E" />
                </View>
                <View style={styles.scanTextWrap}>
                  <Text style={styles.scanTitle}>{isLookingUp ? 'Looking up batch…' : 'Scan Shipment QR'}</Text>
                  <Text style={styles.scanSubtitle}>Scan the QR code the manager generated on release.</Text>
                </View>
                <Icon name="arrowRight" size={18} color="#555353" />
              </Pressable>

              {lookupError && (
                <View style={styles.errorPanel}>
                  <Icon name="warningTriangle" size={22} color={COLORS.error} />
                  <Text style={styles.errorText}>{lookupError}</Text>
                  <Button title="Scan Again" variant="outline" onPress={handleRetry} style={styles.retryButton} />
                </View>
              )}
            </>
          )}

          {batch && (
            <>
              <Text style={styles.listTitle}>{isCollectorSource ? 'Collector' : 'Manager'}</Text>
              <View style={[styles.sourceBanner, isCollectorSource ? styles.sourceBannerCollector : styles.sourceBannerDirect]}>
                <Text style={styles.sourceBannerText}>
                  Current Source: {isCollectorSource ? 'Via Collector Delivery' : 'Direct From Manager'}
                </Text>
              </View>
              <View style={styles.sourceCard}>
                <UserAvatar
                  photoUrl={sourcePhotoUrl}
                  fallbackText={getInitials(sourceName)}
                  size={44}
                  backgroundColor="#F1F3F6"
                  fallbackTextColor={COLORS.primary}
                />
                <View style={styles.sourceTextWrap}>
                  <Text style={styles.sourceName}>{sourceName || 'Unknown'}</Text>
                  <Text style={styles.sourceRole}>{sourceRole}</Text>
                </View>
              </View>

              <View style={styles.titleRow}>
                <Text style={styles.listTitle}>Items To Be Handover</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{batch.items.length}</Text>
                </View>
              </View>

              <View style={styles.listCard}>
                {batch.items.map((item, index) => (
                  <View
                    key={`${item.batchNumber}-${index}`}
                    style={[styles.listItemRow, index === batch.items.length - 1 && styles.lastListItem]}
                  >
                    <View style={styles.itemLeft}>
                      <View style={styles.itemIconWrap}>
                        <Icon name="package" size={18} color="#03045E" />
                      </View>
                      <View>
                        <Text style={styles.itemName}>{item.productName}</Text>
                        <Text style={styles.itemMeta}>
                          Qty: {item.quantity}{item.batchNumber ? `   BN: ${item.batchNumber}` : ''}
                        </Text>
                        {(item.mfgDate || item.expDate) && (
                          <Text style={styles.itemMeta}>
                            {item.mfgDate ? `Mfg: ${new Date(item.mfgDate).toLocaleDateString()}` : ''}
                            {item.mfgDate && item.expDate ? '   ' : ''}
                            {item.expDate ? `Exp: ${new Date(item.expDate).toLocaleDateString()}` : ''}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                ))}
              </View>

              <Text style={styles.listTitle}>Photo Proof</Text>
              {photoUri ? (
                <Pressable style={styles.photoPreviewRow} onPress={() => setIsCameraVisible(true)}>
                  <Image source={{ uri: photoUri }} style={styles.photoPreviewThumb} resizeMode="cover" />
                  <View style={styles.photoPreviewInfo}>
                    <Text style={styles.itemName}>Photo captured</Text>
                    <Text style={styles.itemMeta}>Tap to retake</Text>
                  </View>
                  <Icon name="checkCircle" size={20} color={COLORS.success} weight="fill" />
                </Pressable>
              ) : (
                <Pressable style={styles.photoCard} onPress={() => setIsCameraVisible(true)}>
                  <View style={styles.photoHeaderRow}>
                    <View style={styles.requiredPill}>
                      <Text style={styles.requiredText}>Required</Text>
                    </View>
                  </View>
                  <View style={styles.photoPlaceholder}>
                    <Icon name="camera" size={36} color="#03045E" />
                    <Text style={styles.photoText}>Tap to capture proof of receipt</Text>
                  </View>
                </Pressable>
              )}

              <View style={styles.locationCard}>
                <View style={styles.locationRow}>
                  <View style={styles.locationLeft}>
                    <Icon name="location" size={18} color="#F04D59" />
                    <Text style={styles.detailLabel}>GPS</Text>
                  </View>
                  <Text style={styles.detailValue}>
                    {coords ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` : locationError || 'Locating…'}
                  </Text>
                </View>
                <View style={styles.locationRow}>
                  <View style={styles.locationLeft}>
                    <Icon name="building" size={18} color={COLORS.primary} />
                    <Text style={styles.detailLabel}>Branch</Text>
                  </View>
                  <Text style={styles.detailValue}>{batch.branchName}</Text>
                </View>
                <View style={styles.locationRow}>
                  <View style={styles.locationLeft}>
                    <Icon name="package" size={18} color={COLORS.textSecondary} />
                    <Text style={styles.detailLabel}>Device</Text>
                  </View>
                  <Text style={styles.detailValue}>{deviceLabel || 'Unknown device'}</Text>
                </View>
              </View>

              <Pressable
                style={[styles.primaryButton, (!photoUri || isSubmitting) && styles.primaryButtonDisabled]}
                onPress={handleAccept}
                disabled={!photoUri || isSubmitting}
              >
                <Text style={styles.primaryButtonText}>{isSubmitting ? 'Accepting…' : 'Accept Stock'}</Text>
              </Pressable>
            </>
          )}
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
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    height: 56,
    backgroundColor: '#03045E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAFBF2',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#A7E8C4',
    maxWidth: 150,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#1E7A3A',
    marginRight: 5,
  },
  statusText: {
    color: '#1E7A3A',
    fontSize: 10,
    fontWeight: '600',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  statusPillOffline: {
    backgroundColor: '#FBDCDC',
    borderColor: COLORS.error,
  },
  statusDotOffline: {
    backgroundColor: COLORS.error,
  },
  statusTextOffline: {
    color: '#B91C1C',
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
    fontSize: 11,
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
    fontSize: 11,
    color: '#FFFFFF',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 12,
  },
  sectionHeaderPanel: {
    backgroundColor: '#F7FEFF',
    borderWidth: 0.5,
    borderColor: '#4CF294',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionLabel: {
    fontSize: 18,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  sectionSubLabel: {
    marginTop: 2,
    fontSize: 12,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  scanButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DBE4EE',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  scanIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EDEBFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  scanTextWrap: {
    flex: 1,
  },
  scanTitle: {
    fontSize: 16,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    marginBottom: 2,
  },
  scanSubtitle: {
    fontSize: 11,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  errorPanel: {
    alignItems: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.error + '40',
    backgroundColor: COLORS.error + '0D',
  },
  errorText: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: COLORS.error,
    textAlign: 'center',
  },
  retryButton: { marginTop: 4, width: '100%' },
  sourceBanner: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sourceBannerCollector: { backgroundColor: '#FF7800' },
  sourceBannerDirect: { backgroundColor: '#03045E' },
  sourceBannerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  sourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 14,
    padding: 12,
  },
  sourceTextWrap: { flex: 1 },
  sourceName: {
    fontSize: 14,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  sourceRole: {
    marginTop: 2,
    fontSize: 12,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listTitle: {
    color: '#272632',
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  badge: {
    minWidth: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: '#03045E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  lastListItem: {
    borderBottomWidth: 0,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  itemName: {
    color: '#272632',
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  itemMeta: {
    color: '#555353',
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  photoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAEFF5',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  photoHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  requiredPill: {
    backgroundColor: '#FFF1F2',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  requiredText: {
    color: '#BE123C',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  photoPlaceholder: {
    borderWidth: 1.5,
    borderColor: '#D7E3F1',
    borderStyle: 'dashed',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoText: {
    marginTop: 8,
    color: '#555353',
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  photoPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.success,
    borderRadius: 14,
    padding: 10,
    backgroundColor: COLORS.success + '10',
  },
  photoPreviewThumb: { width: 44, height: 44, borderRadius: 8 },
  photoPreviewInfo: { flex: 1 },
  locationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAEFF5',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  locationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  locationLeft: {
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
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right',
  },
  primaryButton: {
    backgroundColor: '#03045E',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  successTitle: {
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    color: '#272632',
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: '#555353',
    textAlign: 'center',
    marginBottom: 8,
  },
  doneButton: { width: '100%' },
});
