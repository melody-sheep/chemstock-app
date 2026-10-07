// src/screens/salesrep/SalesRepDeliveryDetailScreen.js
import React, { useCallback, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Animated, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { getDeliveryParties } from '../../services/presenceService';
import { getInitials } from '../../utils/initials';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Header from '../../components/common/Header';
import SubScreenSecondaryHeader from '../../components/common/SubScreenSecondaryHeader';
import Icon from '../../components/common/Icon';
import StaticRouteMap from '../../components/common/StaticRouteMap';
import MapZoomControls from '../../components/common/MapZoomControls';
import DeliveryTimeline from '../../components/common/DeliveryTimeline';
import { buildTimelineEntries } from '../../utils/checkpointTimeline';
import authService from '../../services/authService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import MapLegend from '../../components/common/MapLegend';
import ConnectionPill from '../../components/common/ConnectionPill';
import DeliveryStatusPill from '../../components/common/DeliveryStatusPill';

// Marker colours match the markers StaticRouteMap draws for this screen.
const MAP_LEGEND_ITEMS = [
  { label: 'Start', color: '#0085F9', shape: 'dot' },
  { label: 'Collector', color: '#F4A825', shape: 'dot' },
  { label: 'You', color: '#E63946', shape: 'dot' },
];

const STATUS_LABELS = { not_delivered: 'Pending', in_transit: 'In Transit', delivered: 'Delivered' };

function getStatusLabel(delivery) {
  return STATUS_LABELS[delivery.deliveryStatus] || STATUS_LABELS.not_delivered;
}

// "Current Location" breadcrumb: the release moment plus every checkpoint.
function getTimelineEntries(delivery) {
  return buildTimelineEntries({
    originLabel: 'Picked up by Collector',
    originAt: delivery.createdAt,
    checkpoints: delivery.checkpoints || [],
  });
}

const COLLAPSED_SHEET_HEIGHT = 48;

/**
 * SalesRepDeliveryDetailScreen - full-screen, hand-pannable/zoomable map
 * (same treatment as CollectorDeliverStockScreen) with the delivery's
 * status/legend floating over the top and a collapsible bottom sheet
 * (Delivered By, Items, Current Location) that can be retracted down to a
 * thin handle so the map behind it is fully visible edge-to-edge.
 */
export default function SalesRepDeliveryDetailScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const { delivery } = route.params || {};
  const [currentUser, setCurrentUser] = useState(null);
  // The collector on this delivery, with photo and online status (for the map).
  const [parties, setParties] = useState(null);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getDeliveryParties(currentUser?.id, delivery?.transactionId).then((result) => {
        if (active) setParties(result);
      });
      return () => {
        active = false;
      };
    }, [currentUser?.id, delivery?.transactionId])
  );

  const [mapWrapHeight, setMapWrapHeight] = useState(0);
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);
  const mapRef = useRef(null);
  const sheetAnim = useRef(new Animated.Value(1)).current;

  useFocusEffect(
    useCallback(() => {
      authService.getCurrentUser().then(setCurrentUser);
    }, [])
  );

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

  if (!delivery) {
    return (
      <View style={styles.screen}>
        <StatusBar style="light" />
        <Header showBackButton height={56} backgroundColor={COLORS.primary} textColor="#FFFFFF" />
        <SubScreenSecondaryHeader title="Delivery Details" glass />
        <View style={styles.loadingWrap}>
          <Text style={styles.emptyText}>Delivery not found.</Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <Header
          showBackButton
          backButtonText="Track Deliveries"
          height={56}
          backgroundColor={COLORS.primary}
          textColor="#FFFFFF"
          onBackPress={() => navigation.goBack()}
        />
        <SubScreenSecondaryHeader title="Delivery Details" glass />

        <View style={styles.mapWrap} onLayout={(e) => setMapWrapHeight(e.nativeEvent.layout.height)}>
          <StaticRouteMap ref={mapRef}
            fill
            originCoords={delivery.originGps}
            destinationCoords={delivery.destinationGps}
            destinationLabel={`${currentUser?.full_name || currentUser?.username || 'You'} (You)`}
            lastCheckpoint={delivery.lastCheckpoint}
            lastCheckpointLabel={`${delivery.collectorName || 'Collector'} (Collector)`}
            lastCheckpointAvatar={parties?.collector || undefined}
            destinationAvatar={currentUser ? { photoUrl: currentUser.profilePhotoUrl || null, initials: getInitials(currentUser.full_name || currentUser.username) } : undefined}
            style={styles.mapFill} showScale/>
          <MapZoomControls
            onZoomIn={() => mapRef.current?.zoomIn()}
            onZoomOut={() => mapRef.current?.zoomOut()}
            onRecenter={() => mapRef.current?.recenter()}
            style={styles.zoomControls}
          />

          <View style={styles.topOverlayColumn} pointerEvents="box-none">
            <MapLegend items={MAP_LEGEND_ITEMS} />
            <ConnectionPill />
          </View>

          <Animated.View
            style={[
              styles.bottomSheet,
              { height: animatedSheetHeight, paddingBottom: isDetailsOpen ? Math.max(insets.bottom, SPACING.md) : 0 },
            ]}
          >
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
                <Text style={styles.detailSubtitle}>{new Date(delivery.createdAt).toLocaleString()}</Text>

                <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionLabel}>Delivered By</Text>
                    <DeliveryStatusPill status={delivery.deliveryStatus} label={getStatusLabel(delivery)} />
                  </View>
                  <View style={styles.metaCard}>
                    <View style={styles.metaRow}>
                      <Icon name="person" size={16} color={COLORS.primary} />
                      <Text style={styles.metaText}>{delivery.collectorName || 'Collector'} (Collector)</Text>
                    </View>
                  </View>

                  <Text style={styles.sectionLabel}>Items</Text>
                  <View style={styles.itemsCard}>
                    {(delivery.items || []).map((item, index) => (
                      <View key={`${item.productCode}-${index}`} style={[styles.itemRow, index === 0 && styles.itemRowFirst]}>
                        <Text style={styles.itemName}>{item.productName}</Text>
                        <Text style={styles.itemMeta}>Qty: {item.quantity}</Text>
                      </View>
                    ))}
                  </View>

                  <Text style={styles.sectionLabel}>Current Location</Text>
                  <DeliveryTimeline entries={getTimelineEntries(delivery)} />

                  <View style={{ height: SPACING.md }} />
                </ScrollView>
              </>
            )}
          </Animated.View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: COLORS.textSecondary,
  },

  mapWrap: { flex: 1, position: 'relative', overflow: 'hidden' },
  mapFill: { borderRadius: 0, borderWidth: 0 },

  topOverlayColumn: {
    position: 'absolute',
    top: SPACING.md,
    left: SPACING.md,
    gap: SPACING.sm,
    alignItems: 'flex-start',
  },

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
  detailSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  zoomControls: { position: 'absolute', top: SPACING.md, right: SPACING.md },
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailContent: { gap: SPACING.md, paddingBottom: SPACING.md },
  detailScroll: { flex: 1 },
  sectionLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: '#272632',
    marginBottom: SPACING.xs,
    marginTop: SPACING.xs,
  },
  metaCard: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: SPACING.sm,
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  metaText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: '#272632',
  },
  itemsCard: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  itemRowFirst: { borderTopWidth: 0 },
  itemName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  itemMeta: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
});
