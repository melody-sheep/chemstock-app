// src/screens/collector/CollectorDeliverStockScreen.js
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import Header from '../../components/common/Header';
import Icon from '../../components/common/Icon';
import Button from '../../components/common/Button';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import StaticRouteMap from '../../components/common/StaticRouteMap';
import DeliveryTimeline from '../../components/common/DeliveryTimeline';
import CollectorUpdateCheckpointModal from '../../components/common/CollectorUpdateCheckpointModal';
import authService from '../../services/authService';
import deliveryService from '../../services/deliveryService';
import { recordLandmarkUsage } from '../../utils/landmarkUsage';
import { distanceInMeters, formatDistance } from '../../utils/distance';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

// A stop is considered "reached" (Finish Delivery becomes available) within
// this radius — advisory only, computed from a fresh GPS fix on focus, never
// a server-side gate. A bad fix or dead zone should never block marking a
// real physical delivery done.
const NEAR_THRESHOLD_METERS = 300;

export default function CollectorDeliverStockScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { tripId } = route.params || {};

  const [agent, setAgent] = useState(null);
  const [legs, setLegs] = useState([]);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckpointModalVisible, setIsCheckpointModalVisible] = useState(false);
  const [isSubmittingCheckpoint, setIsSubmittingCheckpoint] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isCancelDialogVisible, setIsCancelDialogVisible] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    const currentAgent = await authService.getCurrentUser();
    setAgent(currentAgent);

    const [result] = await Promise.all([
      deliveryService.getMyCollectorDeliveries(currentAgent?.id),
      (async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          try {
            const position = await Location.getCurrentPositionAsync({});
            setCurrentPosition({ latitude: position.coords.latitude, longitude: position.coords.longitude });
          } catch (error) {
            console.error('[ERROR] [CollectorDeliverStockScreen] Location error:', error);
          }
        }
      })(),
    ]);

    const all = result.success ? result.data : [];
    setLegs(all.filter((d) => d.tripId === tripId));
    setIsLoading(false);
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const undeliveredLegs = legs.filter((l) => l.deliveryStatus === 'in_transit');
  const originCoords = legs[0]?.tripOriginGps || null;
  const checkpoints = legs[0]?.checkpoints || [];
  const lastCheckpoint = checkpoints.length > 0 ? checkpoints[checkpoints.length - 1] : null;
  const collectorPosition = currentPosition || (lastCheckpoint ? { latitude: lastCheckpoint.latitude, longitude: lastCheckpoint.longitude } : null);

  const destinations = undeliveredLegs
    .filter((leg) => leg.destinationGps)
    .map((leg) => {
      const meters = collectorPosition ? distanceInMeters(collectorPosition, leg.destinationGps) : null;
      return {
        id: leg.transactionId,
        label: leg.targetRecipientName || 'Sales Rep',
        latitude: leg.destinationGps.latitude,
        longitude: leg.destinationGps.longitude,
        delivered: false,
        distanceLabel: meters != null ? formatDistance(meters) : undefined,
        _meters: meters,
      };
    });

  const nearestLeg = destinations.reduce((closest, d) => {
    if (d._meters == null) return closest;
    if (!closest || d._meters < closest._meters) return d;
    return closest;
  }, null);

  const isNearAStop = nearestLeg && nearestLeg._meters <= NEAR_THRESHOLD_METERS;

  const timeline = [
    ...(originCoords ? [{ key: 'origin', label: 'Trip Started', createdAt: legs[0]?.createdAt }] : []),
    ...checkpoints.map((cp, index) => ({ key: `cp-${index}`, label: cp.label, createdAt: cp.createdAt })),
  ];

  const handleLogCheckpoint = async (label) => {
    if (!agent || !tripId || isSubmittingCheckpoint) return;
    setIsSubmittingCheckpoint(true);

    try {
      let coords = currentPosition;
      if (!coords) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const position = await Location.getCurrentPositionAsync({});
          coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        }
      }

      const result = await deliveryService.logDeliveryCheckpoint({
        agentId: agent.id,
        tripId,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        label,
      });

      if (!result.success) {
        throw new Error(result.message);
      }

      await recordLandmarkUsage(label);
      setIsCheckpointModalVisible(false);
      load();
    } catch (error) {
      Alert.alert('Failed to Update Checkpoint', error.message || 'Please try again.');
    } finally {
      setIsSubmittingCheckpoint(false);
    }
  };

  const handleFinishDelivery = async () => {
    if (!agent || !nearestLeg || isFinishing) return;
    setIsFinishing(true);

    try {
      const result = await deliveryService.finishDeliveryLeg({
        agentId: agent.id,
        transactionId: nearestLeg.id,
        latitude: collectorPosition?.latitude,
        longitude: collectorPosition?.longitude,
        label: `Delivered to ${nearestLeg.label}`,
      });

      if (!result.success) {
        throw new Error(result.message);
      }

      if (result.data?.tripCompleted) {
        Alert.alert('Trip Completed', 'All deliveries in this trip are done.', [
          { text: 'OK', onPress: () => navigation.navigate('CollectorDashboard') },
        ]);
      } else {
        Alert.alert('Delivery Finished', `Delivery to ${nearestLeg.label} is complete.`);
        load();
      }
    } catch (error) {
      Alert.alert('Failed to Finish Delivery', error.message || 'Please try again.');
    } finally {
      setIsFinishing(false);
    }
  };

  const handleCancelTrip = async () => {
    if (!agent || !tripId || isCancelling) return;
    setIsCancelling(true);

    try {
      const result = await deliveryService.cancelDeliveryTrip(agent.id, tripId);
      if (!result.success) {
        throw new Error(result.message);
      }
      setIsCancelDialogVisible(false);
      navigation.navigate('CollectorDashboard');
    } catch (error) {
      setIsCancelDialogVisible(false);
      Alert.alert('Failed to Cancel Trip', error.message || 'Please try again.');
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <Header showBackButton backButtonText="Back" title="Deliver Stock" height={56} backgroundColor="#03045E" textColor="#FFFFFF" />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </View>
    );
  }

  if (undeliveredLegs.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <Header showBackButton backButtonText="Collector Dashboard" title="Deliver Stock" height={56} backgroundColor="#03045E" textColor="#FFFFFF" />
        <View style={styles.loadingWrap}>
          <Icon name="checkCircle" size={32} color={COLORS.success} weight="fill" />
          <Text style={styles.emptyText}>All deliveries in this trip are complete.</Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header showBackButton backButtonText="Back" title="Deliver Stock" height={56} backgroundColor="#03045E" textColor="#FFFFFF" />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <StaticRouteMap
            originCoords={originCoords}
            lastCheckpoint={lastCheckpoint ? { latitude: lastCheckpoint.latitude, longitude: lastCheckpoint.longitude } : collectorPosition}
            destinations={destinations}
            height={220}
            style={styles.map}
          />

          <View style={styles.currentLocationHeaderRow}>
            <Text style={styles.sectionLabel}>Current Location</Text>
            <Pressable onPress={() => setIsCancelDialogVisible(true)}>
              <Text style={styles.cancelLink}>Cancel Delivery</Text>
            </Pressable>
          </View>

          <DeliveryTimeline entries={timeline} emptyText="No location updates logged yet." />

          <View style={{ height: 8 }} />

          {isNearAStop ? (
            <Button
              title={isFinishing ? 'Finishing…' : `Finish Delivery — ${nearestLeg.label}`}
              variant="black"
              onPress={handleFinishDelivery}
              loading={isFinishing}
            />
          ) : (
            <Button title="Go to Next Stop" variant="black" onPress={() => setIsCheckpointModalVisible(true)} />
          )}

          <View style={{ height: 24 }} />
        </ScrollView>
      </View>

      <CollectorUpdateCheckpointModal
        visible={isCheckpointModalVisible}
        onClose={() => setIsCheckpointModalVisible(false)}
        onConfirm={handleLogCheckpoint}
        isSubmitting={isSubmittingCheckpoint}
      />

      <ConfirmationDialog
        visible={isCancelDialogVisible}
        onCancel={() => setIsCancelDialogVisible(false)}
        onConfirm={handleCancelTrip}
        title="Cancel Delivery?"
        description="This will cancel the remaining, undelivered stops on this trip. Deliveries already finished stay marked delivered."
        confirmLabel={isCancelling ? 'Cancelling…' : 'Cancel Delivery'}
        cancelLabel="Keep Trip"
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.xl },
  emptyText: { fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.medium, textAlign: 'center' },
  content: { padding: SPACING.lg, gap: SPACING.sm },
  map: { marginBottom: SPACING.sm },
  currentLocationHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  cancelLink: { fontSize: 12, color: COLORS.error, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
});
