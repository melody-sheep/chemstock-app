// src/screens/manager/TrackDeliveryDetailScreen.js
import React, { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, Image, ScrollView, Pressable, Animated, ActivityIndicator, Linking, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Header from '../../components/common/Header';
import SubScreenSecondaryHeader from '../../components/common/SubScreenSecondaryHeader';
import Icon from '../../components/common/Icon';
import UserAvatar from '../../components/common/UserAvatar';
import CustomModal from '../../components/common/Modal';
import StaticRouteMap from '../../components/common/StaticRouteMap';
import MapZoomControls from '../../components/common/MapZoomControls';
import { getInitials } from '../../utils/initials';
import { getPresence, describePresence } from '../../services/presenceService';
import profileService from '../../services/profileService';
import MapLegend from '../../components/common/MapLegend';
import ConnectionPill from '../../components/common/ConnectionPill';
import DeliveryStatusPill from '../../components/common/DeliveryStatusPill';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';

// Marker colours match the markers StaticRouteMap draws for this screen.
// No separate "Start" dot — the Collector's avatar marker already sits at
// the pickup point until they log a real checkpoint (see lastCheckpoint
// fallback below), so there's only ever one marker representing them.
const MAP_LEGEND_ITEMS = [
  { label: 'Collector', color: '#F4A825', shape: 'dot' },
  { label: 'Sales Rep', color: '#E63946', shape: 'dot' },
];
import DeliveryTimeline from '../../components/common/DeliveryTimeline';
import { buildTimelineEntries } from '../../utils/checkpointTimeline';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
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

const STATUS_LABELS = { not_delivered: 'Pending', in_transit: 'In Transit', delivered: 'Delivered' };

function getStatusLabel(delivery) {
  return STATUS_LABELS[delivery.delivery_status] || STATUS_LABELS.not_delivered;
}

function getLastCheckpoint(delivery) {
  const checkpoints = delivery.delivery_checkpoints || [];
  if (checkpoints.length === 0) return null;
  return checkpoints.reduce((latest, cp) =>
    new Date(cp.created_at) > new Date(latest.created_at) ? cp : latest
  );
}

// "Current Location" breadcrumb: the release moment plus every checkpoint.
// The raw PostgREST embed uses snake_case fields, so they're mapped here.
function getTimelineEntries(delivery) {
  return buildTimelineEntries({
    originLabel: 'Picked up by Collector',
    originAt: delivery.created_at,
    checkpoints: (delivery.delivery_checkpoints || []).map((cp) => ({ label: cp.label, createdAt: cp.created_at })),
  });
}

const COLLAPSED_SHEET_HEIGHT = 48;

/**
 * TrackDeliveryDetailScreen - full-screen, hand-pannable/zoomable map
 * (same treatment as CollectorDeliverStockScreen / SalesRepDeliveryDetailScreen)
 * for the Manager's read-only view of a collector-mediated delivery. The
 * Collector and Sales Rep names aren't embedded in the delivery row itself
 * (only their user ids), so the list screen resolves them once via its own
 * agent roster fetch and passes the strings along as route params instead
 * of this screen re-fetching the whole roster just to label two pins.
 */
export default function TrackDeliveryDetailScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const { delivery, collectorName, targetName, collectorPhotoUrl, targetPhotoUrl } = route.params || {};

  const [mapWrapHeight, setMapWrapHeight] = useState(0);
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);
  const [presenceById, setPresenceById] = useState({});
  const [viewingParty, setViewingParty] = useState(null);
  const [isLoadingPartyDetail, setIsLoadingPartyDetail] = useState(false);

  // Who is online right now. Refreshed each time the screen is shown.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getPresence([delivery?.received_by, delivery?.target_recipient_id]).then((map) => {
        if (active) setPresenceById(map);
      });
      return () => {
        active = false;
      };
    }, [delivery?.received_by, delivery?.target_recipient_id])
  );
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

  // Neither party is the Manager themselves, so both always get the extra
  // fetch — get_agent_profile covers sales_rep/collector rows, which is
  // exactly who's shown here. Shows the name/photo already on hand
  // immediately, then fills in the phone number once it loads.
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

  const resolvedCollectorName = collectorName || 'Collector';
  const resolvedTargetName = targetName || 'Sales Rep';

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
            destinationCoords={delivery.destination_gps}
            destinationLabel={`${resolvedTargetName} (Sales Rep)`}
            lastCheckpoint={getLastCheckpoint(delivery) || delivery.origin_gps}
            lastCheckpointLabel={`${resolvedCollectorName} (Collector)`}
            lastCheckpointAvatar={{
              photoUrl: collectorPhotoUrl || null,
              initials: getInitials(resolvedCollectorName),
              ...describePresence(presenceById[delivery?.received_by]),
            }}
            destinationAvatar={{
              photoUrl: targetPhotoUrl || null,
              initials: getInitials(resolvedTargetName),
              ...describePresence(presenceById[delivery?.target_recipient_id]),
            }}
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
                <Text style={styles.detailSubtitle}>{new Date(delivery.created_at).toLocaleString()}</Text>

                <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionLabel}>Recipients</Text>
                    <DeliveryStatusPill status={delivery.delivery_status} label={getStatusLabel(delivery)} />
                  </View>
                  <View style={styles.partiesWrap}>
                    <Pressable
                      style={styles.partyCard}
                      onPress={() =>
                        handleViewParty({
                          agentId: delivery.received_by,
                          name: resolvedCollectorName,
                          role: 'collector',
                          profilePhotoUrl: collectorPhotoUrl,
                        })
                      }
                    >
                      <UserAvatar
                        photoUrl={collectorPhotoUrl}
                        fallbackText={getInitials(resolvedCollectorName)}
                        size={44}
                        backgroundColor={ROLE_PILL_COLORS.collector.backgroundColor}
                        fallbackTextColor={ROLE_PILL_COLORS.collector.color}
                      />
                      <View style={styles.partyTextWrap}>
                        <Text style={styles.partyName} numberOfLines={1}>{resolvedCollectorName}</Text>
                        <View style={[styles.partyRolePill, { backgroundColor: ROLE_PILL_COLORS.collector.backgroundColor }]}>
                          <Text style={[styles.partyRoleText, { color: ROLE_PILL_COLORS.collector.color }]}>Collector</Text>
                        </View>
                      </View>
                      <Icon name="arrowRight" size={16} color="#94a3b8" />
                    </Pressable>

                    <Pressable
                      style={styles.partyCard}
                      onPress={() =>
                        handleViewParty({
                          agentId: delivery.target_recipient_id,
                          name: resolvedTargetName,
                          role: 'sales_rep',
                          profilePhotoUrl: targetPhotoUrl,
                        })
                      }
                    >
                      <UserAvatar
                        photoUrl={targetPhotoUrl}
                        fallbackText={getInitials(resolvedTargetName)}
                        size={44}
                        backgroundColor={ROLE_PILL_COLORS.sales_rep.backgroundColor}
                        fallbackTextColor={ROLE_PILL_COLORS.sales_rep.color}
                      />
                      <View style={styles.partyTextWrap}>
                        <Text style={styles.partyName} numberOfLines={1}>{resolvedTargetName}</Text>
                        <View style={[styles.partyRolePill, { backgroundColor: ROLE_PILL_COLORS.sales_rep.backgroundColor }]}>
                          <Text style={[styles.partyRoleText, { color: ROLE_PILL_COLORS.sales_rep.color }]}>Sales Representative</Text>
                        </View>
                      </View>
                      <Icon name="arrowRight" size={16} color="#94a3b8" />
                    </Pressable>
                  </View>

                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionLabel}>Items</Text>
                    <View style={styles.itemCountBadge}>
                      <Text style={styles.itemCountText}>{(delivery.transaction_details || []).length}</Text>
                    </View>
                  </View>
                  <View style={styles.itemsCard}>
                    {(delivery.transaction_details || []).map((item, index) => {
                      const catalogEntry = PRODUCT_CATALOG.find((p) => p.code === item.product_code);
                      return (
                        <View key={`${item.batch_number}-${index}`} style={[styles.itemRow, index === 0 && styles.itemRowFirst]}>
                          <View style={[styles.itemIconWrap, { backgroundColor: catalogEntry?.tint || '#EEF2FF' }]}>
                            {catalogEntry?.image ? (
                              <Image source={catalogEntry.image} style={styles.itemIconImage} resizeMode="contain" />
                            ) : (
                              <Icon name="package" size={18} color="#03045E" />
                            )}
                          </View>
                          <View style={styles.itemTextWrap}>
                            <Text style={styles.itemName}>{item.product_name}</Text>
                            {item.batch_number ? <Text style={styles.itemBatch}>BN: {item.batch_number}</Text> : null}
                          </View>
                          <Text style={styles.itemMeta}>Qty: {item.quantity}</Text>
                        </View>
                      );
                    })}
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
  partiesWrap: { gap: SPACING.sm, marginBottom: SPACING.sm },
  partyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    padding: SPACING.sm,
  },
  partyTextWrap: { flex: 1, gap: 4 },
  partyName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    color: '#272632',
  },
  partyRolePill: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  partyRoleText: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
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
    alignItems: 'center',
    padding: SPACING.sm,
    gap: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  itemRowFirst: { borderTopWidth: 0 },
  itemIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemIconImage: { width: '100%', height: '100%' },
  itemTextWrap: { flex: 1 },
  itemName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  itemBatch: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  itemMeta: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  itemCountBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  itemCountText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
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
