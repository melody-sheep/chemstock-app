// src/screens/manager/ReleaseStockDeliveryScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import LiveStatusPill from '../../components/common/LiveStatusPill';
import Icon from '../../components/common/Icon';
import Stepper from '../../components/common/Stepper';
import Button from '../../components/common/Button';
import BottomActionBar, { useBottomActionBarHeight } from '../../components/common/BottomActionBar';
import CameraCaptureModal from '../../components/common/CameraCaptureModal';
import MapLocationPickerModal from '../../components/common/MapLocationPickerModal';
import PhotoProofCard from '../../components/common/PhotoProofCard';
import { getDeviceLabel } from '../../utils/deviceInfo';
import { formatCoordinates, formatDateTime, formatCheckpointTime } from '../../utils/formatters';
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

import { formatPlace as formatAddress } from '../../utils/formatPlace';

export default function ReleaseStockDeliveryScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { recipient, targetRecipient, branchId, movementType, mode, items, registerItems, registerPhotoUri, requestId } =
    route.params;
  const bottomActionBarHeight = useBottomActionBarHeight();

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

  // Opens the map already centered/pinned at the Sales Rep's last recorded
  // spot via focusCoords (not destinationCoords — the manager still taps
  // "Confirm Location" inside to actually finalize it, same as pinning
  // anywhere else; just opening the map shouldn't count as confirming).
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

        <SecondaryHeader height={56}>
          <View style={styles.titleRow}>
            <Text style={styles.pageTitle}>Pick Products</Text>
            <LiveStatusPill pillStyle={styles.onlinePill} dotStyle={styles.onlineDot} textStyle={styles.onlineText} />
          </View>
        </SecondaryHeader>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomActionBarHeight + SPACING.md }]}
          showsVerticalScrollIndicator={false}
        >
          <Stepper currentStep={3} labels={STEP_LABELS} />

          <Text style={styles.sectionTitle}>Deliver from (current location)</Text>
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

          <Text style={styles.sectionTitle}>Deliver to (destination)</Text>

          {targetSalesRep && !isAtTargetLocation && (
            <TouchableOpacity style={styles.lastLocationCard} onPress={handleGoToTargetLocation} activeOpacity={0.7}>
              <View style={styles.lastLocationIconWrap}>
                <Icon name="location" size={16} color={COLORS.primary} weight="fill" />
              </View>
              <View style={styles.originTextWrap}>
                <Text style={styles.lastLocationTitle}>
                  Go to {targetSalesRep.fullName}'s last recorded location
                </Text>
                <Text style={styles.lastLocationMeta}>
                  Last seen {formatCheckpointTime(targetSalesRep.capturedAt)}
                </Text>
              </View>
              <Icon name="arrowRight" size={16} color={COLORS.primary} />
            </TouchableOpacity>
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
                <Text style={styles.destinationChangeText}>Tap to change</Text>
              </View>
            ) : (
              <>
                <Icon name="navigation" size={28} color={COLORS.textSecondary} />
                <Text style={styles.destinationPlaceholder}>Tap to pin delivery location on map</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Take Photo Proof</Text>
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
              <Button title="Take Photo" icon="camera" variant="outline" onPress={handleTakePhoto} />
              <Text style={styles.photoHintText}>Photo will include timestamp, GPS, and device info</Text>
            </>
          )}

        </ScrollView>

        <BottomActionBar>
          <Button
            title="Review Details"
            icon="arrowRight"
            iconPosition="right"
            onPress={handleNext}
            disabled={!canProceed}
            variant="black"
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
        initialCoords={destinationCoords || focusCoords}
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
  content: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, gap: SPACING.sm, paddingBottom: 40 },
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.success + '40',
    backgroundColor: COLORS.success + '10',
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
    backgroundColor: COLORS.primary + '0D',
  },
  lastLocationIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
  },
  lastLocationTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    color: COLORS.primary,
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
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#757575',
    backgroundColor: '#FFFFFF',
  },
  destinationCardFilled: {
    alignItems: 'flex-start',
    borderStyle: 'solid',
    borderColor: COLORS.error + '40',
    backgroundColor: COLORS.error + '08',
  },
  destinationHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  destinationPlaceholder: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  destinationChangeText: {
    marginTop: 4,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.primary,
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
    fontStyle: 'italic',
    color: COLORS.textSecondary,
  },
});
