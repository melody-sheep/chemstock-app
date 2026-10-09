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
import MapLegend from '../../components/common/MapLegend';
import ConnectionPill from '../../components/common/ConnectionPill';
import StaticRouteMap from '../../components/common/StaticRouteMap';
import DeliveryStatusPill from '../../components/common/DeliveryStatusPill';
import MapZoomControls from '../../components/common/MapZoomControls';
import DeliveryTimeline from '../../components/common/DeliveryTimeline';
import { buildTimelineEntries } from '../../utils/checkpointTimeline';
import CollectorUpdateCheckpointModal from '../../components/common/CollectorUpdateCheckpointModal';
import authService from '../../services/authService';
import deliveryService from '../../services/deliveryService';
import outboxService from '../../services/outboxService';
import { getConnectionStatus } from '../../services/connectionStatus';
import { recordLandmarkUsage } from '../../utils/landmarkUsage';
import { distanceInMeters, formatDistance } from '../../utils/distance';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { glassPanel } from '../../styles/glass';
import { getInitials } from '../../utils/initials';
import { getDeliveryParties } from '../../services/presenceService';

// Marker colours match the markers StaticRouteMap draws for this screen.
const MAP_LEGEND_ITEMS = [
  { label: 'Start', color: '#0085F9', shape: 'dot' },
  { label: 'You', color: '#F4A825', shape: 'dot' },
  { label: 'Stop', color: '#E63946', shape: 'pin' },
];

// A stop is considered "reached" (Finish Delivery becomes available) within
// this radius — advisory only, computed from a fresh GPS fix on focus, never
// a server-side gate. A bad fix or dead zone should never block marking a
// real physical delivery done.
const NEAR_THRESHOLD_METERS = 300;
// Handle row + the always-visible Finish Delivery/Go to Next Stop button,
// so collapsing the timeline/details never hides the primary action.
const COLLAPSED_SHEET_HEIGHT = 112;

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
  const mapRef = useRef(null);
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

  // Each stop's Sales Rep, with photo and online status, keyed by transaction.
  // Loaded once per set of legs; a failed load just leaves plain stop markers.
  const [partiesById, setPartiesById] = useState({});
  const legKey = legs.map((leg) => leg.transactionId).join(',');
  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all(
        legs.map(async (leg) => [leg.transactionId, await getDeliveryParties(agent?.id, leg.transactionId)])
      ).then((entries) => {
        if (active) setPartiesById(Object.fromEntries(entries));
      });
      return () => {
        active = false;
      };
    }, [agent?.id, legKey])
  );

  const destinations = undeliveredLegs
    .filter((leg) => leg.destinationGps)
    .map((leg) => {
      const meters = collectorPosition ? distanceInMeters(collectorPosition, leg.destinationGps) : null;
      return {
        id: leg.transactionId,
        avatar: partiesById[leg.transactionId]?.salesRep || undefined,
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

  const timeline = buildTimelineEntries({
    originLabel: 'Trip Started',
    originAt: legs[0]?.createdAt,
    checkpoints,
  });

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

      const checkpointPayload = {
        agentId: agent.id,
        tripId,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        label,
        // Captured at the moment of the tap, not whenever this eventually
        // syncs if it has to queue offline — see the 2026-10-08 migrations.
        capturedAt: new Date().toISOString(),
      };

      // Already known offline — don't even attempt the live call.
      if (!getConnectionStatus().online) {
        await outboxService.enqueue('delivery_checkpoint', checkpointPayload);
        await recordLandmarkUsage(label);
        setIsCheckpointModalVisible(false);
        Alert.alert(
          'Saved — Will Send Later',
          "You're offline. This checkpoint is saved on this device and will sync automatically once you're back online."
        );
        return;
      }

      try {
        const result = await deliveryService.logDeliveryCheckpoint(checkpointPayload);
        if (!result.success) {
          throw new Error(result.message);
        }
      } catch (liveError) {
        // A failure that leaves us offline is a network problem, not a real
        // rejection — queue it instead of showing an error. Anything else
        // (still online) is a genuine failure, handled below as before.
        if (!getConnectionStatus().online) {
          await outboxService.enqueue('delivery_checkpoint', checkpointPayload);
          await recordLandmarkUsage(label);
          setIsCheckpointModalVisible(false);
          Alert.alert(
            'Saved — Will Send Later',
            "Connection dropped mid-update. This checkpoint is saved on this device and will sync automatically once you're back online."
          );
          return;
        }
        throw liveError;
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

    const finishPayload = {
      agentId: agent.id,
      transactionId: nearestLeg.id,
      latitude: collectorPosition?.latitude,
      longitude: collectorPosition?.longitude,
      label: `Delivered to ${nearestLeg.label}`,
    };

    // Approximated locally for the offline case — the real answer comes
    // from the server's tripCompleted once this syncs. Just enough to
    // decide what to show right now: is this the only leg still pending?
    const isLikelyLastStop = undeliveredLegs.length <= 1;

    try {
      // Already known offline — don't even attempt the live call.
      if (!getConnectionStatus().online) {
        await outboxService.enqueue('finish_delivery_leg', finishPayload);
        if (isLikelyLastStop) {
          Alert.alert(
            'Saved — Will Send Later',
            "You're offline. This looks like your last stop — it'll be marked delivered and the trip completed once you're back online.",
            [{ text: 'OK', onPress: () => navigation.navigate('CollectorDashboard') }]
          );
        } else {
          Alert.alert(
            'Saved — Will Send Later',
            `You're offline. Delivery to ${nearestLeg.label} is saved on this device and will sync automatically once you're back online.`
          );
          load();
        }
        return;
      }

      try {
        const result = await deliveryService.finishDeliveryLeg(finishPayload);
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
      } catch (liveError) {
        // A failure that leaves us offline is a network problem, not a real
        // rejection — queue it instead of showing an error. Anything else
        // (still online) is a genuine failure, handled below as before.
        if (!getConnectionStatus().online) {
          await outboxService.enqueue('finish_delivery_leg', finishPayload);
          if (isLikelyLastStop) {
            Alert.alert(
              'Saved — Will Send Later',
              "Connection dropped mid-update. This looks like your last stop — it'll be marked delivered and the trip completed once you're back online.",
              [{ text: 'OK', onPress: () => navigation.navigate('CollectorDashboard') }]
            );
          } else {
            Alert.alert(
              'Saved — Will Send Later',
              `Connection dropped mid-update. Delivery to ${nearestLeg.label} is saved on this device and will sync automatically once you're back online.`
            );
            load();
          }
          return;
        }
        throw liveError;
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
        <SubScreenSecondaryHeader title="Deliver Stock" glass />
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
        <SubScreenSecondaryHeader title="Deliver Stock" glass />
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
        <SubScreenSecondaryHeader title="Deliver Stock" glass />

        <View style={styles.mapWrap} onLayout={(e) => setMapWrapHeight(e.nativeEvent.layout.height)}>
          <StaticRouteMap ref={mapRef}
            fill
            originCoords={originCoords}
            lastCheckpoint={
              lastCheckpoint
                ? { latitude: lastCheckpoint.latitude, longitude: lastCheckpoint.longitude, label: lastCheckpoint.label }
                : collectorPosition
            }
            lastCheckpointLabel={`${agent?.full_name || agent?.username || 'You'} (You)`}
            lastCheckpointAvatar={{
              photoUrl: agent?.profilePhotoUrl || null,
              initials: getInitials(agent?.full_name || agent?.username),
            }}
            destinations={destinations}
            style={styles.mapFill} showScale/>
          <MapZoomControls
            onZoomIn={() => mapRef.current?.zoomIn()}
            onZoomOut={() => mapRef.current?.zoomOut()}
            onRecenter={() => mapRef.current?.recenter()}
            style={styles.zoomControls}
          />

          {/* Stacked on the left so it never sits over the map's zoom control (top right). */}
          <View style={styles.topOverlayColumn} pointerEvents="box-none">
            <MapLegend items={MAP_LEGEND_ITEMS} />
            <ConnectionPill />
            <Pressable style={[styles.cancelPill, glassPanel]} onPress={() => setIsCancelDialogVisible(true)} hitSlop={8}>
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
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionLabel}>Current Location</Text>
                    <DeliveryStatusPill status="in_transit" label="In Transit" />
                  </View>
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
                height={48}
                fontSize={15}
              />
            ) : (
              <Button
                title="Go to Next Stop"
                variant="black"
                onPress={() => setIsCheckpointModalVisible(true)}
                height={48}
                fontSize={15}
              />
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

  topOverlayColumn: {
    position: 'absolute',
    top: SPACING.md,
    left: SPACING.md,
    gap: SPACING.sm,
    alignItems: 'flex-start',
  },
  cancelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 999,
  },
  cancelPillText: { fontSize: 12, color: COLORS.error, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },

  distanceOverlay: {
    position: 'absolute',
    top: 124,
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

  zoomControls: { position: 'absolute', top: SPACING.md, right: SPACING.md },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    backgroundColor: COLORS.glassStrong,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
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
  sheetHandleRow: { alignItems: "center", paddingBottom: SPACING.sm },
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
