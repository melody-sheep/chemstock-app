// src/screens/collector/CollectorTripReviewScreen.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getDeliveryParties } from '../../services/presenceService';
import { View, Text, Image, ScrollView, Pressable, ActivityIndicator, Linking, Dimensions, StyleSheet } from 'react-native';
import Alert from '../../utils/appAlert';
import { StatusBar } from 'expo-status-bar';
import { BlurTargetView } from 'expo-blur';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import Header from '../../components/common/Header';
import SubScreenSecondaryHeader from '../../components/common/SubScreenSecondaryHeader';
import Icon from '../../components/common/Icon';
import UserAvatar from '../../components/common/UserAvatar';
import Button from '../../components/common/Button';
import BottomActionBar, { useBottomActionBarHeight } from '../../components/common/BottomActionBar';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import CustomModal from '../../components/common/Modal';
import authService from '../../services/authService';
import deliveryService from '../../services/deliveryService';
import profileService from '../../services/profileService';
import BrandedQRCode from '../../components/common/BrandedQRCode';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import { getInitials } from '../../utils/initials';
import { getRequiredPosition } from '../../utils/quickLocation';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import friendlyError from '../../utils/friendlyError';
import requireOnline from '../../utils/requireOnline';

const HALF_BUTTON_WIDTH = (Dimensions.get('window').width - SPACING.lg * 2 - SPACING.sm) / 2;

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

// Doubles as both the post-selection "review before Start Trip" screen
// (route params: transactionIds, no tripId yet) and the Active-trip detail
// hub reachable later from the Dashboard's Active list (route params:
// tripId) — same recipients/items view either way, matching the mockup's
// two rendered states of this one screen.
export default function CollectorTripReviewScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { transactionIds, tripId: routeTripId } = route.params || {};

  const [agent, setAgent] = useState(null);
  const [legs, setLegs] = useState([]);
  const [tripId, setTripId] = useState(routeTripId || null);
  const [tripStatus, setTripStatus] = useState(routeTripId ? 'active' : null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCancelDialogVisible, setIsCancelDialogVisible] = useState(false);
  const [viewingParty, setViewingParty] = useState(null);
  // Which recipients have their QR code open (closed to begin with, so the screen stays short).
  const [qrOpenById, setQrOpenById] = useState({});
  const blurTarget = useRef(null);
  const bottomActionBarHeight = useBottomActionBarHeight();
  const [isLoadingPartyDetail, setIsLoadingPartyDetail] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    const currentAgent = await authService.getCurrentUser();
    setAgent(currentAgent);

    const result = await deliveryService.getMyCollectorDeliveries(currentAgent?.id);
    const all = result.success ? result.data : [];

    if (routeTripId) {
      const tripLegs = all.filter((d) => d.tripId === routeTripId);
      setLegs(tripLegs);
      setTripStatus(tripLegs[0]?.tripStatus || 'active');
    } else {
      setLegs(all.filter((d) => transactionIds?.includes(d.transactionId)));
    }
    setIsLoading(false);
  }, [routeTripId, transactionIds]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const totalUnits = legs.reduce(
    (sum, leg) => sum + (leg.items || []).reduce((s, item) => s + item.quantity, 0),
    0
  );

  const handleStartTrip = async () => {
    if (!agent || isStarting) return;
    if (!requireOnline('Starting a trip')) return;
    setIsStarting(true);

    try {
      let coords = null;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        // An open-ended GPS wait here is what made Start Trip hang. This
        // uses the last known position when there is one, so it normally
        // returns at once.
        coords = await getRequiredPosition();
      }

      // start_delivery_trip stores the origin point as NOT NULL, so a trip
      // cannot start without one — say so instead of sending nulls.
      if (!coords) {
        Alert.alert(
          'Location Needed',
          status === 'granted'
            ? "Your location could not be found. Check that Location is turned on, then try again."
            : 'Starting a trip needs location access. Allow location for ChemStock, then try again.'
        );
        return;
      }

      const result = await deliveryService.startDeliveryTrip({
        agentId: agent.id,
        transactionIds: legs.map((leg) => leg.transactionId),
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      });

      if (!result.success) {
        throw new Error(result.message);
      }

      navigation.replace('CollectorDeliverStock', { tripId: result.data.tripId });
    } catch (error) {
      Alert.alert('Failed to Start Trip', friendlyError(error.message) || 'Please try again.');
    } finally {
      setIsStarting(false);
    }
  };

  // Opened from "Start Trip" on the accept-stock message: runs the normal Start Trip once the
  // deliveries are loaded (same checks, same call), so the Collector lands on the map.
  const autoStart = route.params?.autoStart === true;
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (!autoStart || autoStartedRef.current || isLoading || !agent || tripId || legs.length === 0) return;
    autoStartedRef.current = true;
    handleStartTrip();
  }, [autoStart, isLoading, agent, tripId, legs.length]);

  const handleCancelTrip = async () => {
    if (!agent || !tripId || isCancelling) return;
    if (!requireOnline('Cancelling a trip')) return;
    setIsCancelling(true);

    try {
      const result = await deliveryService.cancelDeliveryTrip(agent.id, tripId);
      if (!result.success) {
        throw new Error(result.message);
      }
      setIsCancelDialogVisible(false);
      navigation.navigate('CollectorAcceptDeliveries', undefined, { pop: true });
    } catch (error) {
      setIsCancelDialogVisible(false);
      Alert.alert('Failed to Cancel Trip', friendlyError(error.message) || 'Please try again.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleTrack = () => navigation.navigate('CollectorDeliverStock', { tripId });

  // The Collector row is always the current viewer — their full profile
  // (including phone) is already loaded via authService, no extra fetch
  // needed. A Recipient row is someone else (an agent), so only a fetch via
  // get_agent_profile — same RPC authService uses for its own refresh —
  // can surface their phone number.
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

  // Each leg's Sales Rep, with a photo. The leg data has no photo of its own.
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

  if (isLoading) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <Header
          showBackButton
          backButtonText="Accept Deliveries"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
        />
        <SubScreenSecondaryHeader title="Delivery Details" />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </View>
    );
  }

  const isActiveTrip = !!routeTripId;

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton
          backButtonText={isActiveTrip ? 'Collector Dashboard' : 'Accept Deliveries'}
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
        />
        <SubScreenSecondaryHeader title="Delivery Details" />

        <BlurTargetView ref={blurTarget} style={styles.contentTarget}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomActionBarHeight + (isActiveTrip ? 60 : 0) + SPACING.lg }]} showsVerticalScrollIndicator={false}>
          <View style={styles.summaryCardC}>
            <View style={styles.summaryIconC}>
              <Icon name="truck" size={20} color={COLORS.primary} />
            </View>
            <View style={styles.summaryTextC}>
              <Text style={styles.summaryTitleC}>
                {legs.length} deliver{legs.length === 1 ? 'y' : 'ies'} · {totalUnits} units
              </Text>
              <Text style={styles.summaryHintC} numberOfLines={1}>
                {agent?.branchName || 'Branch'} · {agent?.full_name || agent?.username} (Collector)
              </Text>
            </View>
            {isActiveTrip && (
              <View style={[styles.statusPill, tripStatus === 'completed' ? styles.statusPillDone : styles.statusPillActive]}>
                <Text style={styles.statusPillText}>{tripStatus === 'completed' ? 'Completed' : 'In Transit'}</Text>
              </View>
            )}
          </View>

          <Text style={styles.sectionLabelC}>{isActiveTrip ? 'RECIPIENTS' : 'DELIVER TO'}</Text>
          {legs.map((leg) => {
            const isQrOpen = !!qrOpenById[leg.transactionId];
            return (
              <View key={leg.transactionId} style={styles.legCardC}>
                <Pressable
                  style={styles.legPersonRow}
                  onPress={() =>
                    handleViewParty({
                      agentId: leg.targetRecipientId,
                      name: leg.targetRecipientName || 'Sales Rep',
                      role: 'sales_rep',
                      profilePhotoUrl: partiesById[leg.transactionId]?.salesRep?.photoUrl || leg.targetRecipientPhotoUrl,
                    })
                  }
                >
                  <UserAvatar
                    photoUrl={partiesById[leg.transactionId]?.salesRep?.photoUrl || leg.targetRecipientPhotoUrl}
                    fallbackText={getInitials(leg.targetRecipientName)}
                    size={40}
                    backgroundColor="#F1F3F6"
                    fallbackTextColor={COLORS.primary}
                  />
                  <View style={styles.personTextWrap}>
                    <Text style={styles.personName}>{leg.targetRecipientName || 'Sales Rep'}</Text>
                    <Text style={styles.personRole}>Sales Representative</Text>
                  </View>
                  <Icon name="arrowRight" size={16} color="#94a3b8" />
                </Pressable>

                {(leg.items || []).map((item, index) => (
                  <View key={`${item.batchNumber}-${index}`} style={styles.legItemRow}>
                    <View style={styles.itemIconWrap}>
                      {PRODUCT_CATALOG.find((p) => p.code === item.productCode)?.image ? (
                        <Image
                          source={PRODUCT_CATALOG.find((p) => p.code === item.productCode).image}
                          style={styles.itemIconImage}
                          resizeMode="contain"
                        />
                      ) : (
                        <Icon name="package" size={16} color="#03045E" />
                      )}
                    </View>
                    <View style={styles.itemTextWrap}>
                      <Text style={styles.itemName}>{item.productName}</Text>
                    </View>
                    <Text style={styles.itemMeta}>Qty: {item.quantity}</Text>
                  </View>
                ))}

                {leg.qrCode && (
                  <>
                    <Pressable
                      style={styles.legQrHeader}
                      onPress={() => setQrOpenById((prev) => ({ ...prev, [leg.transactionId]: !prev[leg.transactionId] }))}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isQrOpen }}
                    >
                      <Icon name="qrCode" size={20} color={COLORS.primary} />
                      <Text style={styles.legQrTitle}>Product QR · scan to verify</Text>
                      <View style={styles.foldPillC}>
                        <Text style={styles.foldPillTextC}>{isQrOpen ? 'Hide QR' : 'Show QR'}</Text>
                        <View style={{ transform: [{ rotate: isQrOpen ? '180deg' : '0deg' }] }}>
                          <Icon name="caretDown" size={14} color="#0085F9" weight="bold" />
                        </View>
                      </View>
                    </Pressable>
                    {isQrOpen && (
                      <View style={styles.qrTile}>
                        <BrandedQRCode value={leg.qrCode} size={200} />
                      </View>
                    )}
                  </>
                )}
              </View>
            );
          })}

          {!isActiveTrip && (
            <View style={styles.noticeSlim}>
              <Icon name="warningTriangle" size={14} color={COLORS.error} />
              <Text style={styles.noticeSlimText}>Double check the details before delivering the stock.</Text>
            </View>
          )}
        </ScrollView>
        </BlurTargetView>

        <BottomActionBar key={isCancelDialogVisible ? "dim" : "clear"} variant="glass" blurTarget={blurTarget}>
          {isActiveTrip ? (
            <View style={styles.barStack}>
              <Button
                title="Track Delivery"
                variant="black"
                onPress={handleTrack}
                disabled={tripStatus === 'completed'}
                height={48}
                fontSize={16}
                borderRadius={24}
              />
              <Button
                title="Cancel Delivery"
                variant="outline"
                accentColor="#E5366B"
                onPress={() => setIsCancelDialogVisible(true)}
                disabled={tripStatus === 'completed'}
                height={48}
                fontSize={16}
                borderRadius={24}
                hasShadow={false}
              />
            </View>
          ) : (
            <Button
              title={isStarting ? 'Starting…' : 'Start Trip'}
              variant="black"
              onPress={handleStartTrip}
              loading={isStarting}
              height={48}
              fontSize={16}
              borderRadius={24}
            />
          )}
        </BottomActionBar>
      </View>

      <ConfirmationDialog
        visible={isCancelDialogVisible}
        onCancel={() => setIsCancelDialogVisible(false)}
        onConfirm={handleCancelTrip}
        title="Cancel Delivery?"
        description="This will cancel the remaining, undelivered stops on this trip. Deliveries already finished stay marked delivered."
        confirmLabel={isCancelling ? 'Cancelling…' : 'Yes, cancel delivery'}
        cancelLabel="Keep trip"
        destructive
      />

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
  container: { flex: 1, backgroundColor: COLORS.background },
  contentTarget: { flex: 1 },
  summaryCardC: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.sm + 2, borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 12, backgroundColor: '#FFFFFF' },
  summaryIconC: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#EAF4FF', alignItems: 'center', justifyContent: 'center' },
  summaryTextC: { flex: 1 },
  summaryTitleC: { fontSize: TYPOGRAPHY.fontSize.base, color: '#272632', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  summaryHintC: { marginTop: 1, fontSize: 12, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.regular },
  sectionLabelC: { marginTop: SPACING.xs, fontSize: 12, letterSpacing: 0.8, color: '#6B7280', fontFamily: TYPOGRAPHY.fontFamily.semibold, fontWeight: '600' },
  legCardC: { borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 12, backgroundColor: '#FFFFFF', padding: SPACING.sm + 2, gap: SPACING.sm },
  legPersonRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  legItemRow: { flexDirection: 'row', alignItems: 'center', paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  legQrHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  legQrTitle: { flex: 1, fontSize: TYPOGRAPHY.fontSize.sm, color: '#272632', fontFamily: TYPOGRAPHY.fontFamily.semibold, fontWeight: '600' },
  foldPillC: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: '#EAF4FF' },
  foldPillTextC: { fontSize: 12, color: '#0085F9', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  noticeSlim: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#FDECEC' },
  noticeSlimText: { flex: 1, fontSize: 12, color: '#BE123C', fontFamily: TYPOGRAPHY.fontFamily.medium },
  barStack: { gap: SPACING.sm },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: SPACING.lg, gap: SPACING.sm },
  sectionLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
    marginTop: SPACING.sm,
  },
  // Same From / To route rows as CollectorDeliveryDetailScreen, so the two
  // delivery screens read alike.
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 6,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeLabel: {
    fontSize: 12,
    color: COLORS.textTertiary,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    minWidth: 32,
  },
  routeValue: {
    flex: 1,
    fontSize: 14,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  personCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#EAEFF5',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F3F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personTextWrap: { flex: 1 },
  personName: { fontSize: 14, color: '#272632', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  personRole: { marginTop: 2, fontSize: 12, color: '#555353', fontFamily: TYPOGRAPHY.fontFamily.regular },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusPillActive: { backgroundColor: '#E3F2FF' },
  statusPillDone: { backgroundColor: '#EAFBF2' },
  statusPillText: { fontSize: 11, fontWeight: '700', color: COLORS.primary, fontFamily: TYPOGRAPHY.fontFamily.bold },
  legBlock: { gap: SPACING.sm, marginBottom: SPACING.sm },
  itemsCard: {
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', padding: SPACING.sm, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  itemRowFirst: { borderTopWidth: 0 },
  itemIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
    overflow: 'hidden',
  },
  itemIconImage: { width: '100%', height: '100%' },
  itemTextWrap: { flex: 1 },
  itemName: { fontSize: TYPOGRAPHY.fontSize.sm, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', color: '#272632' },
  itemMeta: { fontSize: 12, fontFamily: TYPOGRAPHY.fontFamily.regular, color: COLORS.textSecondary },
  qrSection: {
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 10,
  },
  qrTitle: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  qrTile: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  summaryText: { fontSize: 12, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.regular },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF1F2',
    borderRadius: 10,
    padding: 10,
    marginTop: SPACING.sm,
  },
  noticeText: { flex: 1, fontSize: 12, color: '#BE123C', fontFamily: TYPOGRAPHY.fontFamily.medium },
  buttonRow: { flexDirection: 'column', gap: SPACING.sm },
  actionButton: { width: '100%' },
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
    fontSize: 11,
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
