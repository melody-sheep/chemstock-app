// src/screens/manager/ReleaseStockDeliveryScreen.js
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BlurTargetView } from 'expo-blur';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import LiveStatusPill from '../../components/common/LiveStatusPill';
import SectionHeader from '../../components/common/SectionHeader';
import UserAvatar from '../../components/common/UserAvatar';
import Icon from '../../components/common/Icon';
import Stepper from '../../components/common/Stepper';
import Button from '../../components/common/Button';
import BottomActionBar, { useBottomActionBarHeight } from '../../components/common/BottomActionBar';
import CameraCaptureModal from '../../components/common/CameraCaptureModal';
import MapLocationPickerModal from '../../components/common/MapLocationPickerModal';
import PhotoProofCard from '../../components/common/PhotoProofCard';
import { getDeviceLabel } from '../../utils/deviceInfo';
import { formatCoordinates, formatDateTime, formatCheckpointTime } from '../../utils/formatters';
import { distanceInMeters, formatDistance } from '../../utils/distance';
import authService from '../../services/authService';
import { getInitials } from '../../utils/initials';
import { readSavedData } from '../../hooks/useCachedFocusLoader';
import { TEAM_CACHE_KEY, loadTeamData, teamForMap } from '../../utils/teamLocations';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

// Only reached for Collector ("Middleman") releases — matches the proposal's
// Figure 29 ("Deliver from" origin + "Deliver to (Destination)" map + photo
// of the package/transit invoice). Direct Sales Rep releases skip this
// screen entirely and go straight to ReleaseStockConfirm, unchanged.
const STEP_LABELS = ['Who receives the stock?', 'How many items?', 'Verify handover details'];

// Blue frames so tappable areas read as tappable (as on the scan screens).
const SCAN_BLUE = '#0085F9';
const SCAN_BLUE_TINT = '#EAF4FF';

import { formatPlace as formatAddress } from '../../utils/formatPlace';

export default function ReleaseStockDeliveryScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { recipient, targetRecipient, branchId, movementType, mode, items, registerItems, registerPhotoUri, requestId } =
    route.params;
  const bottomActionBarHeight = useBottomActionBarHeight();
  const blurTarget = useRef(null);

  const [originCoords, setOriginCoords] = useState(null);
  const [originAddress, setOriginAddress] = useState(null);
  const [originError, setOriginError] = useState(null);
  // The manager's profile, for the photo/initials on the map's origin marker.
  const [manager, setManager] = useState(null);
  // The team on the destination map: saved copy first, then a fresh load.
  const [teamMembers, setTeamMembers] = useState([]);
  useEffect(() => {
    let active = true;
    (async () => {
      const saved = await readSavedData(TEAM_CACHE_KEY);
      if (saved && active) setTeamMembers(await teamForMap(saved.members));
      const fresh = await loadTeamData(saved);
      if (active) setTeamMembers(await teamForMap(fresh.members));
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    authService.getCurrentUser().then(setManager);
  }, []);

  const [destinationCoords, setDestinationCoords] = useState(null);
  const [destinationAddress, setDestinationAddress] = useState(null);
  const [isMapVisible, setIsMapVisible] = useState(false);
  // Seeds where the map opens/centers (e.g. "Go to last location") without
  // counting as an actual confirmed destination — only handleConfirmDestination
  // (the modal's own Confirm button) is allowed to set that.
  const [focusCoords, setFocusCoords] = useState(null);

  const [deliveryPhotoUri, setDeliveryPhotoUri] = useState(null);
  const [photoCapturedAt, setPhotoCapturedAt] = useState(null);
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [isViewingPhoto, setIsViewingPhoto] = useState(false);

  const handlePhotoCaptured = (uri) => {
    setDeliveryPhotoUri(uri);
    setPhotoCapturedAt(new Date());
  };

  // Opens the camera on the existing photo (review + retake), or on a fresh shot.
  const handleViewPhoto = () => {
    setIsViewingPhoto(true);
    setIsCameraVisible(true);
  };

  const handleTakePhoto = () => {
    setIsViewingPhoto(false);
    setIsCameraVisible(true);
  };

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setOriginError('Location permission denied');
          return;
        }
        const position = await Location.getCurrentPositionAsync({});
        const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setOriginCoords(coords);

        try {
          const results = await Location.reverseGeocodeAsync(coords);
          setOriginAddress(formatAddress(results?.[0]));
        } catch (geocodeError) {
          console.error('[ERROR] [ReleaseStockDelivery] Reverse geocode failed:', geocodeError);
        }
      } catch (error) {
        console.error('[ERROR] [ReleaseStockDelivery] Location error:', error);
        setOriginError('Unable to determine location');
      }
    })();
  }, []);

  const handleConfirmDestination = async (coords) => {
    setDestinationCoords(coords);
    setIsMapVisible(false);
    setFocusCoords(null);
    setDestinationAddress(null);
    try {
      const results = await Location.reverseGeocodeAsync(coords);
      setDestinationAddress(formatAddress(results?.[0]));
    } catch (geocodeError) {
      console.error('[ERROR] [ReleaseStockDelivery] Destination reverse geocode failed:', geocodeError);
    }
  };

  // The Sales Rep this delivery is ultimately headed to, at wherever the app
  // last recorded them — lets the manager jump straight to that spot on the
  // map instead of having to search for them there.
  const targetSalesRep = teamMembers.find(
    (m) => m.agentId === targetRecipient?.id && m.latitude != null && m.longitude != null
  );
  const isAtTargetLocation =
    !!targetSalesRep &&
    !!destinationCoords &&
    destinationCoords.latitude === targetSalesRep.latitude &&
    destinationCoords.longitude === targetSalesRep.longitude;

  // How far the chosen destination is from where the recipient was last seen
  // (null when unknown). Beyond 50 m the card carries a reminder.
  const metersFromRecipient =
    targetSalesRep && destinationCoords
      ? distanceInMeters(destinationCoords, { latitude: targetSalesRep.latitude, longitude: targetSalesRep.longitude })
      : null;
  const isOffRecipient = metersFromRecipient !== null && metersFromRecipient > 50;

  // Opens the map already centered/pinned at the Sales Rep's last recorded
  // spot via focusCoords (not destinationCoords — the manager still taps
  // "Confirm Location" inside to actually finalize it, same as pinning
  // anywhere else; just opening the map shouldn't count as confirming).
  // Gio's card and the map's lock work together: the card opens the map at
  // the Sales Rep's spot (it wins over an older pin), and whenever the pin
  // sits exactly on that spot the map opens already "Locked on <SR>".
  const pickerInitialCoords = focusCoords || destinationCoords;
  const pickerLockedAgentId =
    targetSalesRep &&
    pickerInitialCoords &&
    pickerInitialCoords.latitude === targetSalesRep.latitude &&
    pickerInitialCoords.longitude === targetSalesRep.longitude
      ? targetSalesRep.agentId
      : null;

  const handleGoToTargetLocation = () => {
    if (!targetSalesRep) return;
    setFocusCoords({ latitude: targetSalesRep.latitude, longitude: targetSalesRep.longitude });
    setIsMapVisible(true);
  };

  const canProceed = !!originCoords && !!destinationCoords && !!deliveryPhotoUri;

  const handleNext = () => {
    if (!canProceed) return;
    navigation.navigate('ReleaseStockConfirm', {
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
    });
  };

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton
          backButtonText="Give Out Stock"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
        />

        <SecondaryHeader height={76}>
          <View style={styles.titleRow}>
            <View style={styles.titleTextCol}>
              <Text style={styles.pageTitle} numberOfLines={1}>Delivery Details</Text>
              <Text style={styles.pageSubtitle}>Where is it going?</Text>
            </View>
            <LiveStatusPill pillStyle={styles.onlinePill} dotStyle={styles.onlineDot} textStyle={styles.onlineText} />
          </View>
        </SecondaryHeader>

        <BlurTargetView ref={blurTarget} style={styles.contentTarget}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomActionBarHeight + SPACING.md + SPACING.lg }]}
          showsVerticalScrollIndicator={false}
        >
          <Stepper currentStep={3} labels={STEP_LABELS} />

          <SectionHeader icon="location" size="md" label="Deliver from (your location)" style={styles.labelFirst} />
          <View style={styles.originCard}>
            <Icon name="location" size={16} color={COLORS.success} />
            <View style={styles.originTextWrap}>
              <Text style={styles.originCoordsText}>
                {originCoords
                  ? `${originCoords.latitude.toFixed(4)}°N, ${originCoords.longitude.toFixed(4)}°E`
                  : originError || 'Locating…'}
              </Text>
              {originAddress && <Text style={styles.originAddressText}>{originAddress}</Text>}
            </View>
          </View>

          <SectionHeader icon="navigation" size="md" label="Deliver to" style={styles.labelSpaced} />

          {targetSalesRep && !isAtTargetLocation && (
            <TouchableOpacity style={styles.lastLocationCard} onPress={handleGoToTargetLocation} activeOpacity={0.7}>
              <View style={styles.lastLocationIconWrap}>
                <UserAvatar
                  photoUrl={targetRecipient?.profilePhotoUrl || targetSalesRep.photoUrl || null}
                  fallbackText={getInitials(targetSalesRep.fullName)}
                  size={40}
                  backgroundColor="#FFFFFF"
                  fallbackTextColor={COLORS.error}
                />
              </View>
              <View style={styles.originTextWrap}>
                <Text style={styles.lastLocationTitle}>
                  {targetSalesRep.fullName}'s last recorded location
                </Text>
                <Text style={styles.lastLocationMeta}>
                  Last seen {formatCheckpointTime(targetSalesRep.capturedAt)}
                </Text>
              </View>
              <Icon name="arrowRight" size={16} color={COLORS.error} />
            </TouchableOpacity>
          )}

          {targetSalesRep && !isAtTargetLocation && (
            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.orLine} />
            </View>
          )}

          <TouchableOpacity
            style={[styles.destinationCard, destinationCoords && styles.destinationCardFilled]}
            onPress={() => setIsMapVisible(true)}
            activeOpacity={0.7}
          >
            {destinationCoords ? (
              <View style={styles.originTextWrap}>
                <View style={styles.destinationHeaderRow}>
                  <Icon name="location" size={16} color={COLORS.error} />
                  <Text style={styles.originCoordsText}>
                    {destinationCoords.latitude.toFixed(4)}°N, {destinationCoords.longitude.toFixed(4)}°E
                  </Text>
                </View>
                {destinationAddress && <Text style={styles.originAddressText}>{destinationAddress}</Text>}
                {isAtTargetLocation && (
                  <View style={styles.lockedBadge}>
                    <Icon name="checkmark" size={12} color={COLORS.success} weight="bold" />
                    <Text style={styles.lockedBadgeText}>{targetSalesRep.fullName}'s last location</Text>
                  </View>
                )}
                {isOffRecipient && (
                  <View style={styles.offRecipientRow}>
                    <Icon name="warningTriangle" size={14} color="#D98200" />
                    <Text style={styles.offRecipientText}>
                      Not at {targetSalesRep.fullName}'s last location · {formatDistance(metersFromRecipient)} away
                    </Text>
                  </View>
                )}
                <View style={styles.changeChip}>
                  <Icon name="pencilSimpleLine" size={14} color={SCAN_BLUE} />
                  <Text style={styles.destinationChangeText}>Change location</Text>
                </View>
              </View>
            ) : (
              <>
                <Icon name="navigation" size={28} color={SCAN_BLUE} />
                <Text style={styles.destinationPlaceholder}>Pin on map</Text>
              </>
            )}
          </TouchableOpacity>

          <SectionHeader icon="camera" size="md" label="Photo proof" style={styles.labelSpaced} />
          {deliveryPhotoUri ? (
            <>
              <PhotoProofCard
                photoUri={deliveryPhotoUri}
                onView={handleViewPhoto}
                fromLabel={`From ${manager?.full_name || manager?.username || 'you'} to`}
                toName={recipient?.fullName}
              />
              <View style={styles.metaCard}>
                <View style={styles.metaRow}>
                  <Icon name="location" size={16} color={COLORS.error} />
                  <Text style={styles.metaText}>
                    {originCoords ? formatCoordinates(originCoords.latitude, originCoords.longitude) : originError || 'Locating…'}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Icon name="package" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.metaText}>{getDeviceLabel(manager?.full_name || manager?.username)}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Icon name="calendar" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.metaText}>{formatDateTime(photoCapturedAt)}</Text>
                </View>
              </View>
              <Text style={styles.photoHintText}>Tap the photo to view or retake it</Text>
            </>
          ) : (
            <>
              <TouchableOpacity style={styles.photoFrame} onPress={handleTakePhoto} activeOpacity={0.7}>
                <Icon name="camera" size={28} color={SCAN_BLUE} />
                <Text style={styles.photoFrameText}>Take Photo</Text>
              </TouchableOpacity>
              <Text style={styles.photoHintText}>The photo includes the time, GPS location and device.</Text>
            </>
          )}

        </ScrollView>
        </BlurTargetView>

        <BottomActionBar variant="glass" blurTarget={blurTarget}>
          <Button
            title="Review Details"
            icon="arrowRight"
            iconPosition="right"
            onPress={handleNext}
            disabled={!canProceed}
            variant="black"
            height={48}
            fontSize={16}
            borderRadius={24}
          />
        </BottomActionBar>
      </View>

      <MapLocationPickerModal
        visible={isMapVisible}
        onClose={() => {
          setIsMapVisible(false);
          setFocusCoords(null);
        }}
        onConfirm={handleConfirmDestination}
        originCoords={originCoords}
        originAvatarUrl={manager?.profilePhotoUrl || null}
        originInitials={getInitials(manager?.full_name || manager?.username)}
        initialCoords={pickerInitialCoords}
        initialLockedAgentId={pickerLockedAgentId}
        teamMembers={teamMembers}
        targetRecipientId={targetRecipient?.id || null}
      />

      <CameraCaptureModal
        visible={isCameraVisible}
        onClose={() => setIsCameraVisible(false)}
        onCapture={handlePhotoCaptured}
        initialUri={isViewingPhoto ? deliveryPhotoUri : null}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
  },
  pageTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' },
  onlineText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.success,
  },
  titleTextCol: { flexShrink: 1, flex: 1 },
  pageSubtitle: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  contentTarget: { flex: 1 },
  content: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, gap: SPACING.sm, paddingBottom: 40 },
  labelFirst: { marginTop: SPACING.md, marginBottom: 0 },
  labelSpaced: { marginTop: SPACING.lg, marginBottom: 0 },
  photoFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    minHeight: 96,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dotted',
    borderColor: SCAN_BLUE,
    backgroundColor: SCAN_BLUE_TINT,
  },
  photoFrameText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: SCAN_BLUE,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
    marginTop: SPACING.sm,
  },
  originCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
  },
  originTextWrap: { flex: 1 },
  originCoordsText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  originAddressText: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  lastLocationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dotted',
    borderColor: COLORS.error,
    backgroundColor: '#FFF1F1',
  },
  lastLocationIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.error,
    backgroundColor: '#FFFFFF',
  },
  lastLocationTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    color: '#272632',
  },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  orLine: { flex: 1, height: 1, backgroundColor: COLORS.borderLight },
  orText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
  },
  offRecipientRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  offRecipientText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#D98200',
  },
  changeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    height: 30,
    borderRadius: 15,
    backgroundColor: SCAN_BLUE_TINT,
  },
  lastLocationMeta: {
    marginTop: 1,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  lockedBadgeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    color: COLORS.success,
  },
  destinationCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    minHeight: 96,
    padding: SPACING.md,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dotted',
    borderColor: SCAN_BLUE,
    backgroundColor: SCAN_BLUE_TINT,
  },
  destinationCardFilled: {
    alignItems: 'flex-start',
    borderStyle: 'solid',
    borderColor: COLORS.error + '66',
    backgroundColor: '#FFF1F1',
  },
  destinationHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  destinationPlaceholder: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: SCAN_BLUE,
    textAlign: 'center',
  },
  destinationChangeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: SCAN_BLUE,
  },
  // Capture metadata under the photo card, same rows as the Receive Stock preview.
  metaCard: {
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 8,
    backgroundColor: COLORS.textWhite,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  metaText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textPrimary,
  },
  photoHintText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
});
