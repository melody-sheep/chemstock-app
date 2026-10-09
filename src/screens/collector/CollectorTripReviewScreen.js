// src/screens/collector/CollectorTripReviewScreen.js
import React, { useCallback, useState } from 'react';
import { getDeliveryParties } from '../../services/presenceService';
import { View, Text, Image, ScrollView, Pressable, ActivityIndicator, Alert, Linking, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import Header from '../../components/common/Header';
import SubScreenSecondaryHeader from '../../components/common/SubScreenSecondaryHeader';
import Icon from '../../components/common/Icon';
import UserAvatar from '../../components/common/UserAvatar';
import Button from '../../components/common/Button';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import CustomModal from '../../components/common/Modal';
import authService from '../../services/authService';
import deliveryService from '../../services/deliveryService';
import profileService from '../../services/profileService';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import { getInitials } from '../../utils/initials';
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
    setIsStarting(true);

    try {
      let coords = null;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const position = await Location.getCurrentPositionAsync({});
        coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
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
      Alert.alert('Failed to Start Trip', error.message || 'Please try again.');
    } finally {
      setIsStarting(false);
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
      navigation.navigate('CollectorAcceptDeliveries');
    } catch (error) {
      setIsCancelDialogVisible(false);
      Alert.alert('Failed to Cancel Trip', error.message || 'Please try again.');
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

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>Collector</Text>
          <View style={[styles.banner, styles.bannerCollector]}>
            <Text style={styles.bannerText}>From: {agent?.branchName || 'Branch'}</Text>
          </View>
          <View style={styles.personCard}>
            <View style={styles.avatarCircle}>
              <Icon name="truck" size={20} color={COLORS.primary} />
            </View>
            <View style={styles.personTextWrap}>
              <Text style={styles.personName}>{agent?.full_name || agent?.username}</Text>
              <Text style={styles.personRole}>Collector</Text>
            </View>
            {isActiveTrip && (
              <View style={[styles.statusPill, tripStatus === 'completed' ? styles.statusPillDone : styles.statusPillActive]}>
                <Text style={styles.statusPillText}>{tripStatus === 'completed' ? 'Completed' : 'In Transit'}</Text>
              </View>
            )}
          </View>

          <Text style={styles.sectionLabel}>Recipients</Text>
          {legs.map((leg) => (
            <View key={leg.transactionId} style={styles.legBlock}>
              <View style={[styles.banner, styles.bannerTarget]}>
                <Text style={styles.bannerText}>Deliver to: {leg.targetRecipientName || 'Sales Rep'}</Text>
              </View>
              <Pressable
                style={styles.personCard}
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
              <View style={styles.itemsCard}>
                {(leg.items || []).map((item, index) => (
                  <View key={`${item.batchNumber}-${index}`} style={[styles.itemRow, index === 0 && styles.itemRowFirst]}>
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
              </View>
            </View>
          ))}

          <View style={styles.summaryRow}>
            <Icon name="package" size={14} color={COLORS.textSecondary} />
            <Text style={styles.summaryText}>
              {legs.length} deliver{legs.length === 1 ? 'y' : 'ies'} · {totalUnits} units total
            </Text>
          </View>

          {!isActiveTrip && (
            <View style={styles.noticeBox}>
              <Icon name="warningTriangle" size={16} color={COLORS.error} />
              <Text style={styles.noticeText}>Double check the details before delivering the stock to avoid mistakes.</Text>
            </View>
          )}

          <View style={{ height: 8 }} />

          {isActiveTrip ? (
            <View style={styles.buttonRow}>
              <Button
                title="Cancel Delivery"
                variant="outline"
                onPress={() => setIsCancelDialogVisible(true)}
                disabled={tripStatus === 'completed'}
                style={styles.actionButton}
                height={44}
                fontSize={15}
              />
              <Button
                title="Track Delivery"
                variant="black"
                onPress={handleTrack}
                disabled={tripStatus === 'completed'}
                style={styles.actionButton}
                height={44}
                fontSize={15}
              />
            </View>
          ) : (
            <Button title={isStarting ? 'Starting…' : 'Start Trip'} variant="black" onPress={handleStartTrip} loading={isStarting} />
          )}

          <View style={{ height: 24 }} />
        </ScrollView>
      </View>

      <ConfirmationDialog
        visible={isCancelDialogVisible}
        onCancel={() => setIsCancelDialogVisible(false)}
        onConfirm={handleCancelTrip}
        title="Cancel Delivery?"
        description="This will cancel the remaining, undelivered stops on this trip. Deliveries already finished stay marked delivered."
        confirmLabel={isCancelling ? 'Cancelling…' : 'Cancel Delivery'}
        cancelLabel="Keep Trip"
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
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: SPACING.lg, gap: SPACING.sm },
  sectionLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
    marginTop: SPACING.sm,
  },
  banner: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  bannerCollector: { backgroundColor: '#03045E' },
  bannerTarget: { backgroundColor: '#FF7800' },
  bannerText: { color: '#FFFFFF', fontSize: 12, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
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
  statusPillText: { fontSize: 10, fontWeight: '700', color: COLORS.primary, fontFamily: TYPOGRAPHY.fontFamily.bold },
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
  noticeText: { flex: 1, fontSize: 11, color: '#BE123C', fontFamily: TYPOGRAPHY.fontFamily.medium },
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
