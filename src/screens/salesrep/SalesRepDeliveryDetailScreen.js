// src/screens/salesrep/SalesRepDeliveryDetailScreen.js
import React, { useCallback, useRef, useState } from 'react';
import { View, Text, Image, ScrollView, Pressable, Animated, StyleSheet } from 'react-native';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import { formatDateTime } from '../../utils/formatters';
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
import MapStatusCard from '../../components/common/MapStatusCard';
import DeliveryStatusPill from '../../components/common/DeliveryStatusPill';
import RouteLegChips from '../../components/common/RouteLegChips';
import Button from '../../components/common/Button';
import useOutbox from '../../hooks/useOutbox';
import { findQueuedReceipt, queuedHandoffStatus } from '../../utils/queuedReceipts';
import { isReceivable, confirmHandoffParams } from '../../utils/srDeliveries';
import { useMapPhoto } from '../../utils/offlinePhoto';

// Marker colours match the markers StaticRouteMap draws for this screen.
const MAP_LEGEND_ITEMS = [
  { label: 'Start', color: '#0085F9', shape: 'dot' },
  { label: 'Collector', color: '#F4A825', shape: 'dot' },
  { label: 'You', color: '#E63946', shape: 'dot' },
];

const STATUS_LABELS = { not_delivered: 'Pending', in_transit: 'In Transit', delivered: 'Delivered' };

function getStatusLabel(delivery) {
  // Short: the pill shares its row with the section title.
  if (delivery.handoffStatus === 'queued') return 'Waiting to send';
  if (delivery.handoffStatus === 'queued_waiting') return 'Waiting for Collector';
  if (delivery.handoffStatus === 'queued_issue') return 'Issue — waiting to send';
  if (delivery.deliveryStatus === 'delivered' && delivery.handoffStatus === 'pending_sr') {
    return 'Awaiting your confirmation';
  }
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
  // The closed bar must sit above the phone's navigation bar (tall on 3-button phones).
  const collapsedSheetHeight = COLLAPSED_SHEET_HEIGHT + insets.bottom;
  const route = useRoute();
  const { delivery: routeDelivery } = route.params || {};
  const [currentUser, setCurrentUser] = useState(null);
  // Own photo on the map, from the phone when offline.
  const myMapPhoto = useMapPhoto(currentUser?.id, currentUser?.profilePhotoUrl || null);
  // Received or reported on this phone but not synced yet: show that, and no
  // second Receive button.
  const { pending: queuedEntries } = useOutbox();
  const queuedEntry = routeDelivery && currentUser
    ? findQueuedReceipt({ transactionId: routeDelivery.transactionId, qrCode: routeDelivery.qrCode }, currentUser.id, queuedEntries)
    : null;
  const delivery = queuedEntry ? { ...routeDelivery, handoffStatus: queuedHandoffStatus(queuedEntry) } : routeDelivery;
  const canReceive = !queuedEntry && isReceivable(delivery);
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
  // Inside the sheet: a long item list and the location trail fold away so the sheet stays short.
  const [itemsOpen, setItemsOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
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
    outputRange: [collapsedSheetHeight, Math.max(expandedHeight, collapsedSheetHeight)],
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
            // No checkpoint yet: the Collector is shown (photo + name) at the
            // trip start instead of a bare dot. Fixed point, not live tracking.
            // Start is the release point: the Manager who released it (photo when known, initials otherwise), instead of a blue dot.
            originLabel={delivery.lastCheckpoint ? `${delivery.releasedByName || 'Branch Manager'} (Manager) · release point` : `${delivery.collectorName || 'Collector'} (Collector) · trip start`}
            originAvatar={delivery.lastCheckpoint ? { photoUrl: delivery.releasedByPhotoUrl || null, initials: getInitials(delivery.releasedByName || 'Manager') } : parties?.collector || undefined}
            destinationAvatar={currentUser ? { photoUrl: myMapPhoto, initials: getInitials(currentUser.full_name || currentUser.username) } : undefined}
            style={styles.mapFill} showScale/>
          <MapZoomControls
            onZoomIn={() => mapRef.current?.zoomIn()}
            onZoomOut={() => mapRef.current?.zoomOut()}
            onRecenter={() => mapRef.current?.recenter()}
            style={styles.zoomControls}
          />

          <MapStatusCard legend={MAP_LEGEND_ITEMS} style={styles.topCard} />

          <Animated.View
            style={[
              styles.bottomSheet,
              { height: animatedSheetHeight, paddingBottom: isDetailsOpen ? Math.max(insets.bottom, SPACING.md) : insets.bottom },
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
                <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
                  <View style={styles.topLine}>
                    <Text style={styles.detailSubtitle}>{formatDateTime(new Date(delivery.createdAt))}</Text>
                    <DeliveryStatusPill status={delivery.deliveryStatus} label={getStatusLabel(delivery)} />
                  </View>

                  <View style={styles.byRow}>
                    <Icon name="person" size={16} color={COLORS.primary} />
                    <Text style={styles.byLabel}>Delivered by</Text>
                    <Text style={styles.byName} numberOfLines={1}>{delivery.collectorName || 'Collector'} (Collector)</Text>
                  </View>

                  <RouteLegChips
                    legs={[
                      {
                        from: 'Start',
                        to: (delivery.collectorName || 'Collector').split(' ')[0],
                        fromCoords: delivery.originGps,
                        toCoords: delivery.lastCheckpoint,
                      },
                      {
                        from: (delivery.collectorName || 'Collector').split(' ')[0],
                        to: 'You',
                        fromCoords: delivery.lastCheckpoint || delivery.originGps,
                        toCoords: delivery.destinationGps,
                      },
                    ]}
                  />

                  <Pressable
                    style={styles.foldHeader}
                    onPress={() => setItemsOpen((value) => !value)}
                    disabled={(delivery.items || []).length < 2}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: itemsOpen }}
                  >
                    <Text style={styles.foldLabel}>Items ({(delivery.items || []).length})</Text>
                    <View style={{ flex: 1 }} />
                    {(delivery.items || []).length > 1 && (
                      <View style={styles.foldPill}>
                        <Text style={styles.foldPillText}>{itemsOpen ? 'Show less' : `Show all (${(delivery.items || []).length})`}</Text>
                        <View style={{ transform: [{ rotate: itemsOpen ? '180deg' : '0deg' }] }}>
                          <Icon name="caretDown" size={14} color="#0085F9" weight="bold" />
                        </View>
                      </View>
                    )}
                  </Pressable>
                  <View style={styles.itemsCard}>
                    {(itemsOpen ? delivery.items || [] : (delivery.items || []).slice(0, 1)).map((item, index) => (
                      <View key={`${item.productCode}-${index}`} style={[styles.itemRow, index === 0 && styles.itemRowFirst]}>
                        <View style={styles.itemLeft}>
                          <View style={styles.itemThumb}>
                            {PRODUCT_CATALOG.find((p) => p.code === item.productCode)?.image ? (
                              <Image source={PRODUCT_CATALOG.find((p) => p.code === item.productCode).image} style={styles.itemImage} resizeMode="contain" />
                            ) : null}
                          </View>
                          <Text style={styles.itemName} numberOfLines={1}>{item.productName}</Text>
                        </View>
                        <View style={styles.qtyChip}>
                          <Text style={styles.qtyChipText}>{item.quantity} pcs</Text>
                        </View>
                      </View>
                    ))}
                  </View>

                  <Pressable
                    style={styles.foldHeader}
                    onPress={() => setTimelineOpen((value) => !value)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: timelineOpen }}
                  >
                    <Text style={styles.foldLabel}>Current location</Text>
                    <View style={{ flex: 1 }} />
                    <View style={styles.foldPill}>
                      <Text style={styles.foldPillText}>{timelineOpen ? 'Hide' : 'Show'}</Text>
                      <View style={{ transform: [{ rotate: timelineOpen ? '180deg' : '0deg' }] }}>
                        <Icon name="caretDown" size={14} color="#0085F9" weight="bold" />
                      </View>
                    </View>
                  </Pressable>
                  {timelineOpen && <DeliveryTimeline entries={getTimelineEntries(delivery)} />}

                  <View style={{ height: SPACING.xs }} />
                </ScrollView>
                {canReceive && (
                  <Button
                    title="Receive this Delivery"
                    variant="black"
                    onPress={() => navigation.navigate('SalesRepConfirmHandoff', confirmHandoffParams(delivery, { delivery: null }))}
                    height={48}
                    fontSize={15}
                  />
                )}
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

  topCard: { top: SPACING.md, left: SPACING.md },

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
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  detailSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    marginBottom: 0,
  },
  zoomControls: { position: 'absolute', top: SPACING.md, right: SPACING.md },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEF2F7',
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
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  detailContent: { gap: SPACING.sm, paddingBottom: SPACING.sm },
  topLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  byRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: '#E1EEFF', borderRadius: 12, backgroundColor: '#F4F9FF' },
  byLabel: { fontSize: 12, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.regular },
  byName: { flex: 1, fontSize: TYPOGRAPHY.fontSize.sm, color: '#272632', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  foldHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: 2 },
  foldLabel: { fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', color: '#4B5563', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  foldPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, backgroundColor: '#EAF4FF' },
  foldPillText: { fontSize: 12, color: '#0085F9', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  detailScroll: { flex: 1 },
  sectionLabel: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#4B5563',
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
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  itemThumb: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: '#EEEEEE', alignItems: 'center', justifyContent: 'center', padding: 3, backgroundColor: '#FFFFFF' },
  itemImage: { width: '100%', height: '100%' },
  qtyChip: { borderRadius: 2, backgroundColor: '#0085F9', paddingHorizontal: 8, height: 24, justifyContent: 'center' },
  qtyChipText: { fontSize: 12, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', color: '#FFFFFF' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
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
