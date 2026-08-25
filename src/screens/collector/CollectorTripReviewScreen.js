// src/screens/collector/CollectorTripReviewScreen.js
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import Header from '../../components/common/Header';
import Icon from '../../components/common/Icon';
import Button from '../../components/common/Button';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import authService from '../../services/authService';
import deliveryService from '../../services/deliveryService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

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

  if (isLoading) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <Header
          showBackButton
          backButtonText="Accept Deliveries"
          title="Delivery Details"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
        />
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
          title="Delivery Details"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
        />

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
              <View style={styles.personCard}>
                <View style={styles.avatarCircle}>
                  <Icon name="person" size={20} color="#94a3b8" />
                </View>
                <View style={styles.personTextWrap}>
                  <Text style={styles.personName}>{leg.targetRecipientName || 'Sales Rep'}</Text>
                  <Text style={styles.personRole}>Sales Representative</Text>
                </View>
              </View>
              <View style={styles.itemsCard}>
                {(leg.items || []).map((item, index) => (
                  <View key={`${item.batchNumber}-${index}`} style={[styles.itemRow, index === 0 && styles.itemRowFirst]}>
                    <Text style={styles.itemName}>{item.productName}</Text>
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
              />
              <Button
                title="Track Delivery"
                variant="black"
                onPress={handleTrack}
                disabled={tripStatus === 'completed'}
                style={styles.actionButton}
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
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', padding: SPACING.sm, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  itemRowFirst: { borderTopWidth: 0 },
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
  buttonRow: { flexDirection: 'row', gap: SPACING.sm },
  actionButton: { flex: 1 },
});
