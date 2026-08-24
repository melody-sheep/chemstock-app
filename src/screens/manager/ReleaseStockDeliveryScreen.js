// src/screens/manager/ReleaseStockDeliveryScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import Icon from '../../components/common/Icon';
import Stepper from '../../components/common/Stepper';
import Button from '../../components/common/Button';
import CameraCaptureModal from '../../components/common/CameraCaptureModal';
import MapLocationPickerModal from '../../components/common/MapLocationPickerModal';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

// Only reached for Collector ("Middleman") releases — matches the proposal's
// Figure 29 ("Deliver from" origin + "Deliver to (Destination)" map + photo
// of the package/transit invoice). Direct Sales Rep releases skip this
// screen entirely and go straight to ReleaseStockConfirm, unchanged.
const STEP_LABELS = ['Who receives the stock?', 'How many items?', 'Verify handover details'];

function formatAddress(place) {
  if (!place) return null;
  return [place.name, place.street, place.subregion || place.city].filter(Boolean).join(', ');
}

export default function ReleaseStockDeliveryScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { recipient, targetRecipient, branchId, movementType, mode, items, registerItems, registerPhotoUri, requestId } =
    route.params;

  const [originCoords, setOriginCoords] = useState(null);
  const [originAddress, setOriginAddress] = useState(null);
  const [originError, setOriginError] = useState(null);

  const [destinationCoords, setDestinationCoords] = useState(null);
  const [destinationAddress, setDestinationAddress] = useState(null);
  const [isMapVisible, setIsMapVisible] = useState(false);

  const [deliveryPhotoUri, setDeliveryPhotoUri] = useState(null);
  const [isCameraVisible, setIsCameraVisible] = useState(false);

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
          console.error('❌ [ReleaseStockDelivery] Reverse geocode failed:', geocodeError);
        }
      } catch (error) {
        console.error('❌ [ReleaseStockDelivery] Location error:', error);
        setOriginError('Unable to determine location');
      }
    })();
  }, []);

  const handleConfirmDestination = async (coords) => {
    setDestinationCoords(coords);
    setIsMapVisible(false);
    setDestinationAddress(null);
    try {
      const results = await Location.reverseGeocodeAsync(coords);
      setDestinationAddress(formatAddress(results?.[0]));
    } catch (geocodeError) {
      console.error('❌ [ReleaseStockDelivery] Destination reverse geocode failed:', geocodeError);
    }
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
            <View style={styles.onlinePill}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Online</Text>
            </View>
          </View>
        </SecondaryHeader>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
            <TouchableOpacity style={styles.photoPreviewRow} onPress={() => setIsCameraVisible(true)} activeOpacity={0.7}>
              <Image source={{ uri: deliveryPhotoUri }} style={styles.photoPreviewThumb} resizeMode="cover" />
              <View style={styles.photoPreviewInfo}>
                <Text style={styles.photoText}>Photo captured</Text>
                <Text style={styles.photoRetakeText}>Tap to retake</Text>
              </View>
              <Icon name="checkCircle" size={20} color={COLORS.success} weight="fill" />
            </TouchableOpacity>
          ) : (
            <>
              <Button title="Take Photo" icon="camera" variant="outline" onPress={() => setIsCameraVisible(true)} />
              <Text style={styles.photoHintText}>Photo will include timestamp, GPS, and device info</Text>
            </>
          )}

          <Button
            title="Review Details"
            icon="arrowRight"
            iconPosition="right"
            onPress={handleNext}
            disabled={!canProceed}
            variant="black"
            style={styles.nextButton}
          />
        </ScrollView>
      </View>

      <MapLocationPickerModal
        visible={isMapVisible}
        onClose={() => setIsMapVisible(false)}
        onConfirm={handleConfirmDestination}
        originCoords={originCoords}
        initialCoords={destinationCoords}
      />

      <CameraCaptureModal
        visible={isCameraVisible}
        onClose={() => setIsCameraVisible(false)}
        onCapture={setDeliveryPhotoUri}
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
  content: { padding: SPACING.lg, gap: SPACING.sm, paddingBottom: 40 },
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
  destinationCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    minHeight: 96,
    padding: SPACING.md,
    borderRadius: 12,
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
  photoPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.success,
    borderRadius: 12,
    padding: SPACING.sm,
    backgroundColor: COLORS.success + '10',
  },
  photoPreviewThumb: { width: 44, height: 44, borderRadius: 8 },
  photoPreviewInfo: { flex: 1 },
  photoText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: '#272632',
  },
  photoRetakeText: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  photoHintText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    fontStyle: 'italic',
    color: COLORS.textSecondary,
  },
  nextButton: { marginTop: SPACING.sm },
});
