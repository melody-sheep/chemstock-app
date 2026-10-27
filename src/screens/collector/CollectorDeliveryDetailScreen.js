// src/screens/collector/CollectorDeliveryDetailScreen.js
import React, { useRef, useState } from 'react';
import { View, Text, Image, ScrollView, Pressable, Modal, StyleSheet, Linking, ActivityIndicator } from 'react-native';
import Alert from '../../utils/appAlert';
import { StatusBar } from 'expo-status-bar';
import { BlurTargetView } from 'expo-blur';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import Icon from '../../components/common/Icon';
import Button from '../../components/common/Button';
import BottomActionBar, { useBottomActionBarHeight } from '../../components/common/BottomActionBar';
import Header from '../../components/common/Header';
import SubScreenSecondaryHeader from '../../components/common/SubScreenSecondaryHeader';
import UserAvatar from '../../components/common/UserAvatar';
import QRScannerModal from '../../components/common/QRScannerModal';
import CameraCaptureModal from '../../components/common/CameraCaptureModal';
import StaticRouteMap from '../../components/common/StaticRouteMap';
import MapZoomControls from '../../components/common/MapZoomControls';
import MapStatusCard from '../../components/common/MapStatusCard';
import RouteLegChips from '../../components/common/RouteLegChips';
import CustomModal from '../../components/common/Modal';
import BrandedQRCode from '../../components/common/BrandedQRCode';
import authService from '../../services/authService';
import inventoryService from '../../services/inventoryService';
import profileService from '../../services/profileService';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import { getInitials } from '../../utils/initials';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import friendlyError from '../../utils/friendlyError';
import requireOnline from '../../utils/requireOnline';
import { getDeviceLabel, getDeviceOs } from '../../utils/deviceInfo';

const ROLE_LABELS = {
  manager: 'Branch Manager',
  sales_rep: 'Sales Representative',
  collector: 'Collector',
};

const ROLE_PILL_COLORS = {
  manager: { backgroundColor: COLORS.primaryLight, color: COLORS.primary },
  sales_rep: { backgroundColor: '#FFE8F0', color: COLORS.accentPink },
  collector: { backgroundColor: '#FFF1E0', color: COLORS.accentOrange },
};

// The queue row already tells us exactly which transaction this is (unlike
// the Sales Rep's blind-scan Receive Stock flow) — the QR scan here proves
// physical presence against the specific delivery already on screen, not
// "which delivery is this." accept_stock_release still re-derives and
// re-validates everything server-side from the scanned code itself, so this
// client-side match is a data-correctness guard against mis-scanning the
// wrong box while juggling multiple pending pickups, not the security
// boundary — see the design plan for the full reasoning.
export default function CollectorDeliveryDetailScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const { delivery } = route.params || {};

  const [agent, setAgent] = useState(null);
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [isFullMapOpen, setIsFullMapOpen] = useState(false);
  const fullMapRef = useRef(null);
  const [qrOpen, setQrOpen] = useState(false);
  const blurTarget = useRef(null);
  const bottomActionBarHeight = useBottomActionBarHeight();

  const [coords, setCoords] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [photoUri, setPhotoUri] = useState(null);
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAccepted, setIsAccepted] = useState(false);
  const [viewingParty, setViewingParty] = useState(null);
  const [isLoadingPartyDetail, setIsLoadingPartyDetail] = useState(false);

  React.useEffect(() => {
    authService.getCurrentUser().then(setAgent);
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status !== 'granted') {
        setLocationError('Location permission denied');
        return;
      }
      Location.getCurrentPositionAsync({})
        .then((position) => setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude }))
        .catch(() => setLocationError('Unable to determine location'));
    });
  }, []);

  const deviceLabel = getDeviceLabel(agent?.full_name || agent?.username);
  const totalUnits = (delivery?.items || []).reduce((sum, item) => sum + item.quantity, 0);

  const handleBack = () => navigation.goBack();

  // Shows whatever the delivery row already carries (name/photo/role)
  // immediately, then — only for the Sales Rep (an agent, unlike the
  // releasing Manager) — fetches their phone number via the same
  // get_agent_profile RPC authService already uses for its own refresh.
  // get_agent_profile only covers sales_rep/collector rows, so the Manager
  // party has no extra fetch to make.
  const handleViewParty = async (party) => {
    setViewingParty(party);

    if (!party.agentId) return;

    setIsLoadingPartyDetail(true);
    try {
      const result = await profileService.getAgentProfileById(party.agentId);
      if (result.success) {
        setViewingParty((prev) =>
          prev && prev.agentId === party.agentId
            ? { ...prev, phoneNumber: result.data.phoneNumber, profilePhotoUrl: result.data.profilePhotoUrl || prev.profilePhotoUrl }
            : prev
        );
      }
    } finally {
      setIsLoadingPartyDetail(false);
    }
  };

  const handleCallParty = () => {
    if (!viewingParty?.phoneNumber) return;
    Linking.openURL(`tel:${viewingParty.phoneNumber}`);
  };

  const handleScanned = (code) => {
    setIsScannerVisible(false);
    if (code === delivery?.qrCode) {
      setIsVerified(true);
      setScanError(null);
    } else {
      setScanError("That QR doesn't match this delivery. Make sure you're scanning the right shipment.");
    }
  };

  const handleAccept = async () => {
    if (!agent || !photoUri || !delivery || !isVerified || isSubmitting) return;
    if (!requireOnline('Accepting stock')) return;
    setIsSubmitting(true);

    try {
      const storagePath = await inventoryService.uploadStockAcceptancePhoto(photoUri, agent.id);
      const result = await inventoryService.acceptStockRelease({
        qrCode: delivery.qrCode,
        agentId: agent.id,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        deviceModel: Device.modelName,
        deviceOs: getDeviceOs(),
        storagePath,
      });

      if (!result.success) {
        throw new Error(result.message);
      }

      setIsAccepted(true);
    } catch (error) {
      Alert.alert('Failed to Accept Stock', friendlyError(error.message) || 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Back to the Accept Deliveries screen already in the stack (not a second copy on top of it),
  // so one Back press from there reaches the dashboard.
  const handleDone = () => navigation.navigate('CollectorAcceptDeliveries', { highlightId: delivery?.transactionId }, { pop: true });

  // Start Trip straight from the success message: swaps this screen for the trip review, which
  // starts the trip on its own (same start logic, same checks) and opens the map.
  const handleStartTripNow = () =>
    navigation.replace('CollectorTripReview', { transactionIds: [delivery.transactionId], autoStart: true });

  if (!delivery) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Delivery not found.</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <Header showBackButton backButtonText="Accept Deliveries" height={56} backgroundColor="#03045E" textColor="#FFFFFF" onBackPress={handleBack} />
        <SubScreenSecondaryHeader title="Delivery Details" />

        <BlurTargetView ref={blurTarget} style={styles.contentTarget}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomActionBarHeight + SPACING.lg }]} showsVerticalScrollIndicator={false}>
          <View style={styles.routeCardC}>
            <View style={styles.routeHeaderC}>
              <View style={styles.routeBranchC}>
                <Icon name="building" size={16} color={COLORS.primary} />
                <Text style={styles.routeBranchText} numberOfLines={1}>{delivery.branchName || 'Branch'}</Text>
              </View>
              {delivery.destinationGps && (
                <Pressable style={styles.mapPill} onPress={() => setShowMap((prev) => !prev)} accessibilityRole="button">
                  <Icon name="location" size={14} color="#0085F9" />
                  <Text style={styles.mapPillText}>{showMap ? 'Hide map' : 'View map'}</Text>
                  <View style={{ transform: [{ rotate: showMap ? '180deg' : '0deg' }] }}>
                    <Icon name="caretDown" size={12} color="#0085F9" weight="bold" />
                  </View>
                </Pressable>
              )}
            </View>
            <View style={styles.routePeopleC}>
              <Pressable
                style={styles.personC}
                onPress={() =>
                  handleViewParty({
                    agentId: null,
                    name: delivery.releasedByName || 'Branch Manager',
                    role: 'manager',
                    profilePhotoUrl: delivery.releasedByPhotoUrl,
                  })
                }
              >
                <UserAvatar
                  photoUrl={delivery.releasedByPhotoUrl}
                  fallbackText={getInitials(delivery.releasedByName)}
                  size={44}
                  backgroundColor="#F1F3F6"
                  fallbackTextColor={COLORS.primary}
                />
                <Text style={styles.personName} numberOfLines={1}>{delivery.releasedByName || 'Branch Manager'}</Text>
                <Text style={styles.personRole}>Branch Manager</Text>
              </Pressable>
              <View style={styles.routeArrowC}>
                <Icon name="arrowRight" size={18} color="#94a3b8" />
              </View>
              <Pressable
                style={styles.personC}
                onPress={() =>
                  handleViewParty({
                    agentId: delivery.targetRecipientId,
                    name: delivery.targetRecipientName || 'Sales Rep',
                    role: 'sales_rep',
                    profilePhotoUrl: delivery.targetRecipientPhotoUrl,
                  })
                }
              >
                <UserAvatar
                  photoUrl={delivery.targetRecipientPhotoUrl}
                  fallbackText={getInitials(delivery.targetRecipientName)}
                  size={44}
                  backgroundColor="#F1F3F6"
                  fallbackTextColor={COLORS.primary}
                />
                <Text style={styles.personName} numberOfLines={1}>{delivery.targetRecipientName || 'Sales Rep'}</Text>
                <Text style={styles.personRole}>Sales Representative</Text>
              </Pressable>
            </View>
          </View>
          {showMap && delivery.destinationGps && (
            <>
              <View style={styles.mapCardC}>
                <View style={styles.mapFrameC}>
                  <StaticRouteMap
              originCoords={delivery.originGps}
              destinationCoords={delivery.destinationGps}
              originLabel={`${(delivery.releasedByName || 'Branch Manager')} (Pickup)`}
              destinationLabel={`${(delivery.targetRecipientName || 'Sales Rep')} (Sales Rep)`}
              originAvatar={{ photoUrl: delivery.releasedByPhotoUrl || null, initials: getInitials(delivery.releasedByName) }}
              destinationAvatar={{ photoUrl: delivery.targetRecipientPhotoUrl || null, initials: getInitials(delivery.targetRecipientName) }}
              height={220}
              fitTop={90}
              fitBottom={30}
              style={styles.mapInline}
                  />
                  <Pressable style={styles.expandBtn} onPress={() => setIsFullMapOpen(true)} accessibilityRole="button" accessibilityLabel="Open the full map">
                    <Icon name="expand" size={14} color="#0085F9" />
                    <Text style={styles.mapPillText}>Full map</Text>
                  </Pressable>
                </View>
                <RouteLegChips
                  legs={[
                    {
                      from: 'Pickup',
                      to: (delivery.targetRecipientName || 'Sales Rep').split(' ')[0],
                      fromCoords: delivery.originGps,
                      toCoords: delivery.destinationGps,
                    },
                  ]}
                />
              </View>

              <Modal visible={isFullMapOpen} animationType="slide" onRequestClose={() => setIsFullMapOpen(false)}>
                <View style={styles.fullMap}>
                  <StaticRouteMap ref={fullMapRef}
              originCoords={delivery.originGps}
              destinationCoords={delivery.destinationGps}
              originLabel={`${(delivery.releasedByName || 'Branch Manager')} (Pickup)`}
              destinationLabel={`${(delivery.targetRecipientName || 'Sales Rep')} (Sales Rep)`}
              originAvatar={{ photoUrl: delivery.releasedByPhotoUrl || null, initials: getInitials(delivery.releasedByName) }}
              destinationAvatar={{ photoUrl: delivery.targetRecipientPhotoUrl || null, initials: getInitials(delivery.targetRecipientName) }}
                    fill
                    showScale
                    fitTop={170}
                    fitBottom={80}
                    style={styles.fullMapFill}
                  />
                  <MapZoomControls
                    onZoomIn={() => fullMapRef.current?.zoomIn()}
                    onZoomOut={() => fullMapRef.current?.zoomOut()}
                    onRecenter={() => fullMapRef.current?.recenter()}
                    style={[styles.fullMapZoom, { top: 76 + insets.top }]}
                  />
                  <View style={[styles.fullMapHeader, { paddingTop: SPACING.md + insets.top }]}>
                    <Text style={styles.fullMapTitle}>Delivery route</Text>
                    <Pressable style={styles.mapPill} onPress={() => setIsFullMapOpen(false)} accessibilityRole="button" accessibilityLabel="Close the full map">
                      <Icon name="xCircle" size={14} color="#0085F9" />
                      <Text style={styles.mapPillText}>Close</Text>
                    </Pressable>
                  </View>
                  <MapStatusCard
                    legend={[
                      { label: 'Pickup', color: '#0085F9' },
                      { label: 'Sales Rep', color: '#E63946' },
                    ]}
                    style={[styles.fullMapCard, { top: 76 + insets.top }]}
                  />
                </View>
              </Modal>
            </>
          )}

          <View style={styles.titleRow}>
            <Text style={styles.listTitle}>Items To Be Loaded</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{delivery.items.length}</Text>
            </View>
          </View>

          <View style={styles.listCard}>
            {delivery.items.map((item, index) => (
              <View
                key={`${item.batchNumber}-${index}`}
                style={[styles.listItemRow, index === delivery.items.length - 1 && styles.lastListItem]}
              >
                <View style={styles.itemLeft}>
                  <View style={styles.itemIconWrap}>
                    {PRODUCT_CATALOG.find((p) => p.code === item.productCode)?.image ? (
                      <Image
                        source={PRODUCT_CATALOG.find((p) => p.code === item.productCode).image}
                        style={styles.itemIconImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <Icon name="package" size={18} color="#03045E" />
                    )}
                  </View>
                  <View style={styles.itemTextC}>
                    <Text style={styles.itemName}>{item.productName}</Text>
                    <Text style={styles.itemMeta}>Qty: {item.quantity}</Text>
                    {!!item.batchNumber && <Text style={styles.itemMeta} numberOfLines={1}>BN: {item.batchNumber}</Text>}
                  </View>
                </View>
              </View>
            ))}
          </View>

          {delivery.qrCode && (
            <View style={styles.qrCardC}>
              <Pressable
                style={styles.qrHeaderC}
                onPress={() => setQrOpen((prev) => !prev)}
                accessibilityRole="button"
                accessibilityState={{ expanded: qrOpen }}
              >
                <Icon name="qrCode" size={22} color={COLORS.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.qrHeadTitle}>Product QR</Text>
                  <Text style={styles.qrHeadHint}>Scan to verify this shipment</Text>
                </View>
                <View style={styles.mapPill}>
                  <Text style={styles.mapPillText}>{qrOpen ? 'Hide QR' : 'Show QR'}</Text>
                  <View style={{ transform: [{ rotate: qrOpen ? '180deg' : '0deg' }] }}>
                    <Icon name="caretDown" size={14} color="#0085F9" weight="bold" />
                  </View>
                </View>
              </Pressable>
              {qrOpen && (
                <View style={styles.qrTile}>
                  <BrandedQRCode value={delivery.qrCode} size={200} />
                </View>
              )}
            </View>
          )}

          <Text style={styles.listTitle}>Verify Stock With Manager</Text>
          <View style={styles.verifyCard}>
            <Text style={styles.verifyStatus}>
              {isVerified ? 'QR verified — ready to capture photo proof.' : 'Waiting for you to scan the manager\'s QR.'}
            </Text>
            <View style={styles.verifyRow}>
              <Pressable
                style={[styles.verifyButton, isVerified && styles.verifyButtonDone]}
                onPress={() => setIsScannerVisible(true)}
              >
                <Icon name="qrCode" size={22} color={isVerified ? COLORS.success : COLORS.primary} />
                <Text style={styles.verifyButtonLabel}>Product QR</Text>
                {isVerified ? (
                  <Icon name="checkCircle" size={16} color={COLORS.success} weight="fill" />
                ) : (
                  <Icon name="xCircle" size={16} color={COLORS.error} />
                )}
              </Pressable>

              <Pressable
                style={[styles.verifyButton, photoUri && styles.verifyButtonDone]}
                onPress={() => setIsCameraVisible(true)}
              >
                <Icon name="camera" size={22} color={photoUri ? COLORS.success : COLORS.primary} />
                <Text style={styles.verifyButtonLabel}>Photo Proof</Text>
                {photoUri ? (
                  <Icon name="checkCircle" size={16} color={COLORS.success} weight="fill" />
                ) : (
                  <Icon name="xCircle" size={16} color={COLORS.error} />
                )}
              </Pressable>
            </View>
            {scanError && <Text style={styles.errorInlineText}>{scanError}</Text>}
            {photoUri && (
              <Pressable style={styles.photoPreviewRow} onPress={() => setIsCameraVisible(true)}>
                <Image source={{ uri: photoUri }} style={styles.photoPreviewThumb} resizeMode="cover" />
                <View style={styles.photoPreviewInfo}>
                  <Text style={styles.itemName}>Photo captured</Text>
                  <Text style={styles.itemMeta}>Tap to retake</Text>
                </View>
                <Icon name="checkCircle" size={20} color={COLORS.success} weight="fill" />
              </Pressable>
            )}
          </View>

          {locationError && <Text style={styles.errorInlineText}>{locationError}</Text>}
        </ScrollView>
        </BlurTargetView>

        <BottomActionBar variant="glass" blurTarget={blurTarget}>
          {(!isVerified || !photoUri) && !isSubmitting && (
            <Text style={styles.barHint}>
              {!isVerified ? "Scan the manager's QR, then take the photo proof." : 'Take the photo proof to continue.'}
            </Text>
          )}
          <Button
            title={isSubmitting ? 'Accepting…' : 'Accept Stock'}
            variant="black"
            onPress={handleAccept}
            loading={isSubmitting}
            disabled={!isVerified || !photoUri || isSubmitting}
            height={48}
            fontSize={16}
            borderRadius={24}
          />
        </BottomActionBar>
      </View>

      <QRScannerModal visible={isScannerVisible} onClose={() => setIsScannerVisible(false)} onScanned={handleScanned} />
      <CameraCaptureModal visible={isCameraVisible} onClose={() => setIsCameraVisible(false)} onCapture={setPhotoUri} />

      <CustomModal visible={isAccepted} onClose={() => {}} variant="center" closeOnBackdropPress={false}>
        <View style={styles.successIconWrap}>
          <View style={styles.successRing}>
            <View style={styles.successCircle}>
              <Icon name="checkCircle" size={28} color={COLORS.success} />
            </View>
          </View>
        </View>
        <Text style={styles.successModalTitle}>Stock accepted</Text>
        <Text style={styles.successModalText}>
          {delivery.items.length} item{delivery.items.length === 1 ? '' : 's'}, {totalUnits} units are now ready to deliver.
        </Text>
        <Button title="Start Trip" variant="black" icon="truck" onPress={handleStartTripNow} height={48} fontSize={16} borderRadius={24} style={styles.modalButton} />
        <Button title="Done" variant="outline" onPress={handleDone} height={48} fontSize={16} borderRadius={24} hasShadow={false} style={styles.modalButton} />
      </CustomModal>

      <CustomModal visible={!!viewingParty} onClose={() => setViewingParty(null)} height="auto">
        {viewingParty && (
          <View style={styles.partyModalContent}>
            <View style={styles.partyModalHandle} />
            <Pressable
              style={styles.partyModalCloseBtn}
              onPress={() => setViewingParty(null)}
              hitSlop={10}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <Icon name="xCircle" size={24} color="#94a3b8" />
            </Pressable>

            <UserAvatar
              photoUrl={viewingParty.profilePhotoUrl}
              fallbackText={getInitials(viewingParty.name)}
              size={96}
              backgroundColor="#F1F3F6"
              fallbackTextColor={COLORS.primary}
              style={styles.partyModalAvatarRing}
            />
            <Text style={styles.partyModalName}>{viewingParty.name}</Text>
            <View
              style={[
                styles.partyModalRolePill,
                { backgroundColor: ROLE_PILL_COLORS[viewingParty.role]?.backgroundColor || '#EEF2FF' },
              ]}
            >
              <Text
                style={[
                  styles.partyModalRoleText,
                  { color: ROLE_PILL_COLORS[viewingParty.role]?.color || COLORS.primary },
                ]}
              >
                {ROLE_LABELS[viewingParty.role] || viewingParty.role}
              </Text>
            </View>

            <View style={styles.partyModalDivider} />

            {isLoadingPartyDetail ? (
              <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 8 }} />
            ) : viewingParty.phoneNumber ? (
              <Pressable style={styles.partyModalPhoneRow} onPress={handleCallParty}>
                <View style={styles.partyModalPhoneIconWrap}>
                  <Icon name="phone" size={16} color={COLORS.primary} />
                </View>
                <View style={styles.partyModalPhoneTextWrap}>
                  <Text style={styles.partyModalPhoneLabel}>Phone Number</Text>
                  <Text style={styles.partyModalPhoneText}>{viewingParty.phoneNumber}</Text>
                </View>
                <View style={styles.partyModalCallBtn}>
                  <Icon name="phone" size={14} color="#FFFFFF" weight="fill" />
                </View>
              </Pressable>
            ) : (
              <View style={styles.partyModalNoPhoneRow}>
                <Icon name="phone" size={16} color="#94a3b8" />
                <Text style={styles.partyModalNoPhone}>No phone number on file.</Text>
              </View>
            )}
          </View>
        )}
      </CustomModal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  contentTarget: { flex: 1 },
  routeCardC: { borderWidth: 1, borderColor: '#EAEFF5', borderRadius: 14, backgroundColor: '#FFFFFF', padding: SPACING.sm + 2, gap: 10 },
  routeHeaderC: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  routeBranchC: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  routeBranchText: { flex: 1, fontSize: TYPOGRAPHY.fontSize.base, color: '#272632', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  mapPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: '#EAF4FF' },
  mapPillText: { fontSize: 12, color: '#0085F9', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  routePeopleC: { flexDirection: 'row', alignItems: 'center' },
  personC: { flex: 1, alignItems: 'center', gap: 2 },
  personName: { fontSize: TYPOGRAPHY.fontSize.sm, color: '#272632', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', marginTop: 4 },
  personRole: { fontSize: 11, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.regular },
  routeArrowC: { paddingHorizontal: 4 },
  itemTextC: { flexShrink: 1 },
  qrCardC: { borderWidth: 1, borderColor: '#EAEFF5', borderRadius: 14, backgroundColor: '#FFFFFF', padding: SPACING.sm + 2, gap: 10 },
  qrHeaderC: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  qrHeadTitle: { fontSize: TYPOGRAPHY.fontSize.sm, color: '#272632', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  qrHeadHint: { fontSize: 11, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.regular },
  barHint: { marginBottom: 8, fontSize: 12, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.regular },
  successIconWrap: { alignItems: 'center', marginBottom: SPACING.md },
  successRing: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.success + '14', alignItems: 'center', justifyContent: 'center' },
  successCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.success + '26', alignItems: 'center', justifyContent: 'center' },
  successModalTitle: { fontSize: TYPOGRAPHY.fontSize.lg, color: '#272632', textAlign: 'center', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', marginBottom: SPACING.xs },
  successModalText: { fontSize: TYPOGRAPHY.fontSize.base, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: SPACING.lg, fontFamily: TYPOGRAPHY.fontFamily.regular },
  modalButton: { width: '100%', marginBottom: SPACING.sm },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32, gap: 12 },
  listTitle: { color: '#272632', fontSize: 18, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 6,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeLabel: {
    fontSize: 12,
    color: COLORS.textTertiary,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    minWidth: 32,
  },
  routeValue: {
    flex: 1,
    fontSize: 14,
    color: '#272632',
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
  sourceName: { fontSize: 14, color: '#272632', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  sourceRole: { marginTop: 2, fontSize: 12, color: '#555353', fontFamily: TYPOGRAPHY.fontFamily.regular },
  mapToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  mapToggleText: { fontSize: 12, color: COLORS.primary, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  mapCardC: { borderWidth: 1, borderColor: '#E1EEFF', borderRadius: 14, backgroundColor: '#F4F9FF', padding: SPACING.sm, gap: SPACING.sm },
  mapFrameC: { borderRadius: 10, overflow: 'hidden', position: 'relative' },
  mapInline: { borderRadius: 10, borderWidth: 0 },
  expandBtn: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.95)' },
  fullMap: { flex: 1, backgroundColor: COLORS.background },
  fullMapFill: { borderRadius: 0, borderWidth: 0 },
  fullMapHeader: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, backgroundColor: '#FFFFFF', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 10 },
  fullMapTitle: { fontSize: TYPOGRAPHY.fontSize.base, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', color: '#272632' },
  fullMapCard: { top: 76, left: SPACING.md },
  fullMapZoom: { position: 'absolute', top: 76, right: SPACING.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: {
    minWidth: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: '#03045E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', fontFamily: TYPOGRAPHY.fontFamily.bold },
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
  lastListItem: { borderBottomWidth: 0 },
  itemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  itemIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  itemIconImage: {
    width: '100%',
    height: '100%',
  },
  itemName: { color: '#272632', fontSize: 13, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  itemMeta: { color: '#555353', fontSize: 12, fontFamily: TYPOGRAPHY.fontFamily.regular, marginTop: 2 },
  qrSection: {
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 10,
  },
  qrTitle: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  qrTile: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  verifyCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAEFF5',
    padding: 12,
    gap: 10,
  },
  verifyStatus: { fontSize: 12, color: '#555353', fontFamily: TYPOGRAPHY.fontFamily.regular },
  verifyRow: { flexDirection: 'row', gap: 10 },
  verifyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DBE4EE',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  verifyButtonDone: { borderColor: COLORS.success },
  verifyButtonLabel: { flex: 1, fontSize: 12, color: '#272632', fontFamily: TYPOGRAPHY.fontFamily.medium },
  errorInlineText: { fontSize: 12, color: COLORS.error, fontFamily: TYPOGRAPHY.fontFamily.medium },
  photoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAEFF5',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  photoHeaderRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 10 },
  requiredPill: { backgroundColor: '#FFF1F2', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  requiredText: { color: '#BE123C', fontSize: 11, fontWeight: '700', fontFamily: TYPOGRAPHY.fontFamily.bold },
  photoPlaceholder: {
    borderWidth: 1.5,
    borderColor: '#D7E3F1',
    borderStyle: 'dashed',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  photoText: { marginTop: 8, color: '#555353', fontSize: 12, fontFamily: TYPOGRAPHY.fontFamily.medium, textAlign: 'center' },
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
  primaryButton: { backgroundColor: '#03045E', borderRadius: 12, height: 52, alignItems: 'center', justifyContent: 'center' },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', fontFamily: TYPOGRAPHY.fontFamily.bold },
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  successTitle: { fontSize: 18, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', color: '#272632', textAlign: 'center' },
  successSubtitle: { fontSize: 13, fontFamily: TYPOGRAPHY.fontFamily.regular, color: '#555353', textAlign: 'center', marginBottom: 8 },
  doneButton: { width: '100%' },
  errorText: { padding: 24, textAlign: 'center', color: COLORS.error, fontFamily: TYPOGRAPHY.fontFamily.medium },
  partyModalContent: { alignItems: 'center', paddingTop: 4, paddingBottom: 8 },
  partyModalHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    marginBottom: 12,
  },
  partyModalCloseBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    padding: 4,
  },
  partyModalAvatarRing: {
    borderWidth: 3,
    borderColor: COLORS.primaryLight,
  },
  partyModalName: {
    marginTop: 14,
    fontSize: 19,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    textAlign: 'center',
  },
  partyModalRolePill: {
    marginTop: 8,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  partyModalRoleText: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  partyModalDivider: {
    alignSelf: 'stretch',
    height: 1,
    backgroundColor: '#EEF2F7',
    marginVertical: 20,
  },
  partyModalPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 12,
    borderWidth: 1,
    borderColor: '#EAEFF5',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  partyModalPhoneIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  partyModalPhoneTextWrap: { flex: 1 },
  partyModalPhoneLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  partyModalPhoneText: {
    marginTop: 2,
    fontSize: 15,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  partyModalCallBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partyModalNoPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  partyModalNoPhone: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontStyle: 'italic',
  },
});
