// src/screens/collector/CollectorDeliveryDetailScreen.js
import React, { useState } from 'react';
import { View, Text, Image, ScrollView, Pressable, StyleSheet, Alert, Linking, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import Icon from '../../components/common/Icon';
import Button from '../../components/common/Button';
import Header from '../../components/common/Header';
import SubScreenSecondaryHeader from '../../components/common/SubScreenSecondaryHeader';
import UserAvatar from '../../components/common/UserAvatar';
import QRScannerModal from '../../components/common/QRScannerModal';
import CameraCaptureModal from '../../components/common/CameraCaptureModal';
import StaticRouteMap from '../../components/common/StaticRouteMap';
import CustomModal from '../../components/common/Modal';
import authService from '../../services/authService';
import inventoryService from '../../services/inventoryService';
import profileService from '../../services/profileService';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import { getInitials } from '../../utils/initials';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../styles/typography';

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

  const deviceLabel = [Device.modelName, Device.osName, Device.osVersion].filter(Boolean).join(' - ');
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
    setIsSubmitting(true);

    try {
      const storagePath = await inventoryService.uploadStockAcceptancePhoto(photoUri, agent.id);
      const result = await inventoryService.acceptStockRelease({
        qrCode: delivery.qrCode,
        agentId: agent.id,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        deviceModel: Device.modelName,
        deviceOs: `${Device.osName || ''} ${Device.osVersion || ''}`.trim(),
        storagePath,
      });

      if (!result.success) {
        throw new Error(result.message);
      }

      setIsAccepted(true);
    } catch (error) {
      Alert.alert('Failed to Accept Stock', error.message || 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDone = () => navigation.navigate('CollectorAcceptDeliveries');

  if (!delivery) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Delivery not found.</Text>
      </View>
    );
  }

  if (isAccepted) {
    return (
      <>
        <StatusBar style="light" />
        <View style={styles.screen}>
          <Header height={56} backgroundColor="#03045E" textColor="#FFFFFF" />
          <SubScreenSecondaryHeader title="Stock Accepted" />
          <View style={styles.successWrap}>
            <Icon name="checkCircle" size={48} color={COLORS.success} weight="fill" />
            <Text style={styles.successTitle}>Stock Accepted Successfully</Text>
            <Text style={styles.successSubtitle}>
              {delivery.items.length} item{delivery.items.length === 1 ? '' : 's'}, {totalUnits} units are now ready
              to deliver
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
        <Header showBackButton height={56} backgroundColor="#03045E" textColor="#FFFFFF" onBackPress={handleBack} />
        <SubScreenSecondaryHeader title="Delivery Details" />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.listTitle}>Stock Transfer Information</Text>
          <View style={[styles.sourceBanner, styles.sourceBannerDirect]}>
            <Text style={styles.sourceBannerText}>From: {delivery.branchName || 'Branch'}</Text>
          </View>
          <Pressable
            style={styles.sourceCard}
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
            <View style={styles.sourceTextWrap}>
              <Text style={styles.sourceName}>{delivery.releasedByName || 'Branch Manager'}</Text>
              <Text style={styles.sourceRole}>Branch Manager</Text>
            </View>
            <Icon name="arrowRight" size={16} color="#94a3b8" />
          </Pressable>

          <View style={[styles.sourceBanner, styles.sourceBannerCollector]}>
            <Text style={styles.sourceBannerText}>Deliver to: {delivery.targetRecipientName || 'Sales Rep'}</Text>
          </View>
          <Pressable
            style={styles.sourceCard}
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
            <View style={styles.sourceTextWrap}>
              <Text style={styles.sourceName}>{delivery.targetRecipientName || 'Sales Rep'}</Text>
              <Text style={styles.sourceRole}>Sales Representative</Text>
            </View>
            <Icon name="arrowRight" size={16} color="#94a3b8" />
          </Pressable>

          {delivery.destinationGps && (
            <Pressable style={styles.mapToggleRow} onPress={() => setShowMap((prev) => !prev)}>
              <Icon name="location" size={16} color={COLORS.primary} />
              <Text style={styles.mapToggleText}>{showMap ? 'Hide Map' : 'View Map'}</Text>
            </Pressable>
          )}
          {showMap && delivery.destinationGps && (
            <StaticRouteMap
              originCoords={delivery.originGps}
              destinationCoords={delivery.destinationGps}
              height={160}
              style={styles.map}
            />
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
                  <View>
                    <Text style={styles.itemName}>{item.productName}</Text>
                    <Text style={styles.itemMeta}>
                      Qty: {item.quantity}{item.batchNumber ? `   BN: ${item.batchNumber}` : ''}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

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
                <Text style={styles.photoText}>
                  Tap to capture proof you're physically at the pickup area
                </Text>
              </View>
            </Pressable>
          )}

          {locationError && <Text style={styles.errorInlineText}>{locationError}</Text>}

          <Pressable
            style={[styles.primaryButton, (!isVerified || !photoUri || isSubmitting) && styles.primaryButtonDisabled]}
            onPress={handleAccept}
            disabled={!isVerified || !photoUri || isSubmitting}
          >
            <Text style={styles.primaryButtonText}>{isSubmitting ? 'Accepting…' : 'Accept Stock'}</Text>
          </Pressable>
        </ScrollView>
      </View>

      <QRScannerModal visible={isScannerVisible} onClose={() => setIsScannerVisible(false)} onScanned={handleScanned} />
      <CameraCaptureModal visible={isCameraVisible} onClose={() => setIsCameraVisible(false)} onCapture={setPhotoUri} />

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
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32, gap: 12 },
  listTitle: { color: '#272632', fontSize: 18, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  sourceBanner: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  sourceBannerCollector: { backgroundColor: '#FF7800' },
  sourceBannerDirect: { backgroundColor: '#03045E' },
  sourceBannerText: { color: '#FFFFFF', fontSize: 12, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
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
  map: { marginTop: 4 },
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
  itemMeta: { color: '#555353', fontSize: 11, fontFamily: TYPOGRAPHY.fontFamily.regular, marginTop: 2 },
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
  errorInlineText: { fontSize: 11, color: COLORS.error, fontFamily: TYPOGRAPHY.fontFamily.medium },
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
  requiredText: { color: '#BE123C', fontSize: 10, fontWeight: '700', fontFamily: TYPOGRAPHY.fontFamily.bold },
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
    fontSize: 10,
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
