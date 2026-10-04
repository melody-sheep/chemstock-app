// src/screens/collector/CollectorDeliverStockScreen.js
import React, { useCallback, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Animated, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import Header from '../../components/common/Header';
import SubScreenSecondaryHeader from '../../components/common/SubScreenSecondaryHeader';
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
// Handle row + the always-visible Finish Delivery/Go to Next Stop button,
// so collapsing the timeline/details never hides the primary action.
const COLLAPSED_SHEET_HEIGHT = 150;

export default function CollectorDeliverStockScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
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
  const [mapWrapHeight, setMapWrapHeight] = useState(0);
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);
  const sheetAnim = useRef(new Animated.Value(1)).current;

  const toggleDetails = () => {
    const next = !isDetailsOpen;
    setIsDetailsOpen(next);
    Animated.timing(sheetAnim, {
      toValue: next ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  };

  const expandedHeight = mapWrapHeight ? Math.round(mapWrapHeight * 0.55) : 0;
  const animatedSheetHeight = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [COLLAPSED_SHEET_HEIGHT, Math.max(expandedHeight, COLLAPSED_SHEET_HEIGHT)],
  });

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
        <Header showBackButton backButtonText="Back" height={56} backgroundColor="#03045E" textColor="#FFFFFF" />
        <SubScreenSecondaryHeader title="Deliver Stock" syncStatus="online" />
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
        <Header showBackButton backButtonText="Collector Dashboard" height={56} backgroundColor="#03045E" textColor="#FFFFFF" />
        <SubScreenSecondaryHeader title="Deliver Stock" syncStatus="online" />
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
        <Header showBackButton backButtonText="Back" height={56} backgroundColor="#03045E" textColor="#FFFFFF" />
        <SubScreenSecondaryHeader title="Deliver Stock" syncStatus="online" />

        <View style={styles.mapWrap} onLayout={(e) => setMapWrapHeight(e.nativeEvent.layout.height)}>
          <StaticRouteMap
            fill
            originCoords={originCoords}
            lastCheckpoint={
              lastCheckpoint
                ? { latitude: lastCheckpoint.latitude, longitude: lastCheckpoint.longitude, label: lastCheckpoint.label }
                : collectorPosition
            }
            lastCheckpointLabel={`${agent?.full_name || agent?.username || 'You'} (You)`}
            destinations={destinations}
            style={styles.mapFill}
            showZoomControl
            showScale
          />

          <View style={styles.topOverlayRow} pointerEvents="box-none">
            <View style={styles.legendPill}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#0085F9' }]} />
                <Text style={styles.legendText}>Start</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#F4A825' }]} />
                <Text style={styles.legendText}>You</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendPin, { backgroundColor: '#E63946' }]} />
                <Text style={styles.legendText}>Stop</Text>
              </View>
            </View>

            <Pressable style={styles.cancelPill} onPress={() => setIsCancelDialogVisible(true)} hitSlop={8}>
              <Icon name="xCircle" size={14} color={COLORS.error} weight="fill" />
              <Text style={styles.cancelPillText}>Cancel</Text>
            </Pressable>
          </View>

          {nearestLeg ? (
            <View style={styles.distanceOverlay} pointerEvents="none">
              {isNearAStop ? (
                <View style={styles.nearBadge}>
                  <Icon name="location" size={12} color={COLORS.success} weight="fill" />
                  <Text style={styles.nearBadgeText}>Near {nearestLeg.label}</Text>
                </View>
              ) : nearestLeg.distanceLabel ? (
                <View style={styles.nearBadge}>
                  <Icon name="navigation" size={12} color={COLORS.textSecondary} weight="fill" />
                  <Text style={styles.distanceBadgeText}>{nearestLeg.distanceLabel} to {nearestLeg.label}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <Animated.View
            style={[
              styles.bottomSheet,
              { height: animatedSheetHeight, paddingBottom: Math.max(insets.bottom, SPACING.md) },
            ]}
          >
            <View style={styles.sheetTopContent}>
              <Pressable onPress={toggleDetails} style={styles.sheetHandleRow} hitSlop={8}>
                <View style={styles.sheetHandle} />
                <View style={styles.sheetToggleRow}>
                  <Text style={styles.sheetToggleText}>{isDetailsOpen ? 'Hide Details' : 'Show Details'}</Text>
                  <Icon
                    name="caretDown"
                    size={14}
                    color={COLORS.textSecondary}
                    style={{ transform: [{ rotate: isDetailsOpen ? '0deg' : '180deg' }] }}
                  />
                </View>
              </Pressable>

              {isDetailsOpen && (
                <>
                  <Text style={styles.sectionLabel}>Current Location</Text>
                  <ScrollView style={styles.timelineScroll} showsVerticalScrollIndicator={false}>
                    <DeliveryTimeline entries={timeline} emptyText="No location updates logged yet." />
                  </ScrollView>
                </>
              )}
            </View>

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
          </Animated.View>
        </View>
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

  mapWrap: { flex: 1, position: 'relative', overflow: 'hidden' },
  mapFill: { borderRadius: 0, borderWidth: 0 },

  topOverlayRow: {
    position: 'absolute',
    top: SPACING.md,
    left: SPACING.md,
    right: SPACING.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendPin: { width: 9, height: 9, borderRadius: 5, transform: [{ rotate: '45deg' }], borderBottomLeftRadius: 0 },
  legendText: { fontSize: 10, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.medium },

  cancelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  cancelPillText: { fontSize: 12, color: COLORS.error, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },

  distanceOverlay: {
    position: 'absolute',
    top: 56,
    left: SPACING.md,
    right: SPACING.md,
    alignItems: 'flex-start',
  },
  nearBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  nearBadgeText: { fontSize: 11, color: COLORS.success, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  distanceBadgeText: { fontSize: 11, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.medium },

  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  sheetTopContent: { flex: 1, gap: SPACING.sm },
  sheetHandleRow: { alignItems: 'center' },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    marginBottom: SPACING.xs,
  },
  sheetToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sheetToggleText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  timelineScroll: { flex: 1 },
  sectionLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
});
