// src/screens/collector/CollectorAcceptDeliveriesScreen.js
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SubScreenSecondaryHeader from '../../components/common/SubScreenSecondaryHeader';
import Icon from '../../components/common/Icon';
import UserAvatar from '../../components/common/UserAvatar';
import authService from '../../services/authService';
import deliveryService from '../../services/deliveryService';
import { getInitials } from '../../utils/initials';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const SELECTION_MODES = [
  { key: 'all', label: 'All' },
  { key: 'single', label: 'Single' },
  { key: 'batch', label: 'Batch' },
];

export default function CollectorAcceptDeliveriesScreen() {
  const navigation = useNavigation();
  const [agent, setAgent] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectionMode, setSelectionMode] = useState('single');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const loadDeliveries = useCallback(async () => {
    setIsLoading(true);
    const currentAgent = await authService.getCurrentUser();
    setAgent(currentAgent);
    const result = await deliveryService.getMyCollectorDeliveries(currentAgent?.id);
    setDeliveries(result.success ? result.data : []);
    setSelectedIds([]);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDeliveries();
    }, [loadDeliveries])
  );

  const pending = deliveries.filter((d) => d.stage === 'pending_pickup');
  const ready = deliveries.filter((d) => d.stage === 'ready_to_deliver');

  const handleSelectMode = (mode) => {
    setIsMenuOpen(false);
    setSelectionMode(mode);
    setSelectedIds(mode === 'all' ? ready.map((d) => d.transactionId) : []);
  };

  const handleViewPending = (delivery) => {
    navigation.navigate('CollectorDeliveryDetail', { delivery });
  };

  const handleReadyPress = (delivery) => {
    if (selectionMode === 'single') {
      navigation.navigate('CollectorTripReview', { transactionIds: [delivery.transactionId] });
      return;
    }
    setSelectedIds((prev) =>
      prev.includes(delivery.transactionId)
        ? prev.filter((id) => id !== delivery.transactionId)
        : [...prev, delivery.transactionId]
    );
  };

  const handleNext = () => {
    if (selectedIds.length === 0) return;
    navigation.navigate('CollectorTripReview', { transactionIds: selectedIds });
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Header
        showBackButton
        backButtonText="Collector Dashboard"
        height={56}
        backgroundColor="#03045E"
        textColor="#FFFFFF"
      />
      <SubScreenSecondaryHeader title="Accept Deliveries" syncStatus="online" />

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionDot, { backgroundColor: COLORS.accentGold }]} />
            <Text style={styles.sectionTitle}>Pending Deliveries</Text>
          </View>
          <Text style={styles.sectionSubtitle}>Delivery via Collector</Text>

          {pending.length === 0 ? (
            <Text style={styles.emptyText}>No pending pickups right now.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pendingRow}>
              {pending.map((delivery) => (
                <View key={delivery.transactionId} style={styles.pendingCard}>
                  <UserAvatar
                    photoUrl={delivery.targetRecipientPhotoUrl}
                    fallbackText={getInitials(delivery.targetRecipientName)}
                    size={52}
                    backgroundColor="#F1F3F6"
                    fallbackTextColor={COLORS.primary}
                    style={styles.avatarCircleMargin}
                  />
                  <Text style={styles.pendingName} numberOfLines={1}>
                    {delivery.targetRecipientName || 'Sales Rep'}
                  </Text>
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>Pending</Text>
                  </View>
                  <Text style={styles.pendingRole}>Sales Rep</Text>
                  <TouchableOpacity style={styles.viewButton} onPress={() => handleViewPending(delivery)}>
                    <Text style={styles.viewButtonText}>View</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={styles.readyHeaderRow}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionDot, { backgroundColor: COLORS.success }]} />
              <Text style={styles.sectionTitle}>Ready to Deliver</Text>
            </View>
            <View>
              <Pressable style={styles.filterButton} onPress={() => setIsMenuOpen((prev) => !prev)}>
                <Icon name="filter" size={20} color={COLORS.primary} />
              </Pressable>
              {isMenuOpen && (
                <View style={styles.filterMenu}>
                  {SELECTION_MODES.map((mode) => (
                    <Pressable
                      key={mode.key}
                      style={styles.filterMenuItem}
                      onPress={() => handleSelectMode(mode.key)}
                    >
                      <Text
                        style={[
                          styles.filterMenuItemText,
                          selectionMode === mode.key && styles.filterMenuItemTextActive,
                        ]}
                      >
                        {mode.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>
          <Text style={styles.sectionSubtitle}>Delivery via Collector</Text>

          {ready.length === 0 ? (
            <Text style={styles.emptyText}>No deliveries ready to go out yet.</Text>
          ) : (
            <View style={styles.readyList}>
              {ready.map((delivery) => {
                const isSelected = selectedIds.includes(delivery.transactionId);
                return (
                  <TouchableOpacity
                    key={delivery.transactionId}
                    style={styles.readyCard}
                    onPress={() => handleReadyPress(delivery)}
                    activeOpacity={0.7}
                  >
                    <UserAvatar
                      photoUrl={delivery.targetRecipientPhotoUrl}
                      fallbackText={getInitials(delivery.targetRecipientName)}
                      size={40}
                      backgroundColor="#F1F3F6"
                      fallbackTextColor={COLORS.primary}
                    />
                    <View style={styles.readyTextCol}>
                      <Text style={styles.readyName} numberOfLines={1}>
                        {delivery.targetRecipientName || 'Sales Rep'}
                      </Text>
                      <Text style={styles.readyRole}>Sales Representative</Text>
                    </View>
                    {selectionMode === 'single' ? (
                      <>
                        <View style={styles.readyBadge}>
                          <Text style={styles.readyBadgeText}>Ready</Text>
                        </View>
                        <Icon name="arrowRight" size={16} color={COLORS.textSecondary} />
                      </>
                    ) : isSelected ? (
                      <Icon name="checkCircle" size={22} color={COLORS.success} weight="fill" />
                    ) : (
                      <View style={styles.readyBadge}>
                        <Text style={styles.readyBadgeText}>Ready</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      {selectionMode !== 'single' && selectedIds.length > 0 && (
        <View style={styles.nextBar}>
          <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
            <Text style={styles.nextButtonText}>Next ({selectedIds.length})</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: SPACING.lg, gap: SPACING.sm },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  sectionSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  pendingRow: { marginBottom: SPACING.lg },
  pendingCard: {
    width: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    padding: SPACING.sm,
    marginRight: SPACING.sm,
    alignItems: 'center',
  },
  avatarCircleMargin: {
    marginBottom: SPACING.xs,
  },
  pendingName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
    textAlign: 'center',
  },
  pendingBadge: {
    backgroundColor: '#FFF1D6',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  pendingBadgeText: { fontSize: 10, fontWeight: '700', color: '#B26400', fontFamily: TYPOGRAPHY.fontFamily.bold },
  pendingRole: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
    marginBottom: SPACING.sm,
  },
  viewButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 8,
    width: '100%',
    alignItems: 'center',
  },
  viewButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', fontFamily: TYPOGRAPHY.fontFamily.bold },
  readyHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.sm },
  filterButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: '#757575',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7FEFF',
  },
  filterMenu: {
    position: 'absolute',
    top: 40,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    minWidth: 100,
    zIndex: 20,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  filterMenuItem: { paddingHorizontal: 14, paddingVertical: 10 },
  filterMenuItemText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: '#272632',
  },
  filterMenuItemTextActive: { fontFamily: TYPOGRAPHY.fontFamily.bold, color: COLORS.primary },
  readyList: { gap: SPACING.sm },
  readyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    padding: SPACING.sm,
  },
  readyTextCol: { flex: 1 },
  readyName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  readyRole: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  readyBadge: { backgroundColor: '#EAFBF2', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  readyBadgeText: { fontSize: 10, fontWeight: '700', color: '#1E7A3A', fontFamily: TYPOGRAPHY.fontFamily.bold },
  nextBar: {
    padding: SPACING.md,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  nextButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', fontFamily: TYPOGRAPHY.fontFamily.bold },
});
