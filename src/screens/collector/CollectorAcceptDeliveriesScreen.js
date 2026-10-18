// src/screens/collector/CollectorAcceptDeliveriesScreen.js
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SubScreenSecondaryHeader from '../../components/common/SubScreenSecondaryHeader';
import Icon from '../../components/common/Icon';
import UserAvatar from '../../components/common/UserAvatar';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import authService from '../../services/authService';
import deliveryService from '../../services/deliveryService';
import { getInitials } from '../../utils/initials';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import friendlyError from '../../utils/friendlyError';
import requireOnline from '../../utils/requireOnline';

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
  const [returnCandidate, setReturnCandidate] = useState(null);
  const [isReturning, setIsReturning] = useState(false);

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
  const returning = deliveries.filter((d) => d.stage === 'returning');

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

  const handleReadyLongPress = (delivery) => {
    Alert.alert(delivery.targetRecipientName || 'Delivery', 'What would you like to do with this item?', [
      { text: 'Start Delivery', onPress: () => navigation.navigate('CollectorTripReview', { transactionIds: [delivery.transactionId] }) },
      { text: 'Return to Manager', style: 'destructive', onPress: () => setReturnCandidate(delivery) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleConfirmReturn = async () => {
    if (!agent || !returnCandidate || isReturning) return;
    if (!requireOnline('Returning stock to the branch')) return;
    setIsReturning(true);

    const result = await deliveryService.initiateCollectorReturn(agent.id, returnCandidate.transactionId);
    setIsReturning(false);

    if (!result.success) {
      setReturnCandidate(null);
      Alert.alert('Failed to Start Return', friendlyError(result.message));
      return;
    }

    const delivery = returnCandidate;
    setReturnCandidate(null);
    loadDeliveries();
    navigation.navigate('CollectorReturnQR', {
      qrCode: result.data?.qrCode,
      items: delivery.items,
      branchName: delivery.branchName,
    });
  };

  const handleReturningPress = (delivery) => {
    navigation.navigate('CollectorReturnQR', {
      qrCode: delivery.returnQrCode,
      items: delivery.items,
      branchName: delivery.branchName,
    });
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
      <SubScreenSecondaryHeader title="Accept Deliveries" />

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
              {pending.map((delivery) => {
                const itemCount = (delivery.items || []).length;
                const totalUnits = (delivery.items || []).reduce((s, it) => s + it.quantity, 0);
                return (
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

                    <View style={styles.pendingMetaBlock}>
                      <View style={styles.pendingMetaRow}>
                        <Icon name="package" size={11} color={COLORS.textSecondary} />
                        <Text style={styles.pendingMetaText} numberOfLines={1}>
                          {itemCount} item{itemCount === 1 ? '' : 's'} · {totalUnits} unit{totalUnits === 1 ? '' : 's'}
                        </Text>
                      </View>
                      {delivery.branchName ? (
                        <View style={styles.pendingMetaRow}>
                          <Icon name="building" size={11} color={COLORS.textSecondary} />
                          <Text style={styles.pendingMetaText} numberOfLines={1}>
                            {delivery.branchName}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <TouchableOpacity style={styles.viewButton} onPress={() => handleViewPending(delivery)}>
                      <Text style={styles.viewButtonText}>View</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          )}

          <View style={styles.readyHeaderRow}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionDot, { backgroundColor: COLORS.success }]} />
              <Text style={styles.sectionTitle}>Ready to Deliver</Text>
            </View>
          </View>

          <View style={styles.modeChipRow}>
            {SELECTION_MODES.map((mode) => {
              const active = selectionMode === mode.key;
              return (
                <Pressable
                  key={mode.key}
                  style={[styles.modeChip, active && styles.modeChipActive]}
                  onPress={() => handleSelectMode(mode.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[styles.modeChipText, active && styles.modeChipTextActive]}
                    numberOfLines={1}
                  >
                    {mode.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.sectionSubtitle}>
            {selectionMode === 'single'
              ? 'Tap a card to start · Hold for more options'
              : selectionMode === 'all'
              ? 'All ready deliveries selected — tap Next to review'
              : 'Tap cards to select multiple — then Next'}
          </Text>

          {ready.length === 0 ? (
            <Text style={styles.emptyText}>No deliveries ready to go out yet.</Text>
          ) : (
            <View style={styles.readyList}>
              {ready.map((delivery) => {
                const isSelected = selectedIds.includes(delivery.transactionId);
                const isMultiMode = selectionMode !== 'single';
                const itemCount = (delivery.items || []).length;
                const totalUnits = (delivery.items || []).reduce((s, it) => s + it.quantity, 0);
                return (
                  <TouchableOpacity
                    key={delivery.transactionId}
                    style={[styles.readyCard, isMultiMode && isSelected && styles.readyCardSelected]}
                    onPress={() => handleReadyPress(delivery)}
                    onLongPress={() => handleReadyLongPress(delivery)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityState={isMultiMode ? { selected: isSelected } : undefined}
                  >
                    {isMultiMode && (
                      <View style={[styles.selectDot, isSelected && styles.selectDotActive]}>
                        {isSelected && <Icon name="check" size={12} color="#FFFFFF" weight="bold" />}
                      </View>
                    )}

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
                      <View style={styles.readyMetaRow}>
                        <Icon name="package" size={11} color={COLORS.textSecondary} />
                        <Text style={styles.readyMetaText} numberOfLines={1}>
                          {itemCount} item{itemCount === 1 ? '' : 's'} · {totalUnits} unit{totalUnits === 1 ? '' : 's'}
                        </Text>
                      </View>
                    </View>
                    {!isMultiMode ? (
                      <>
                        <View style={styles.readyBadge}>
                          <Text style={styles.readyBadgeText}>Ready</Text>
                        </View>
                        <Icon name="arrowRight" size={16} color={COLORS.textSecondary} />
                      </>
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

          {returning.length > 0 && (
            <>
              <View style={[styles.sectionHeaderRow, { marginTop: SPACING.lg }]}>
                <View style={[styles.sectionDot, { backgroundColor: COLORS.accentOrange }]} />
                <Text style={styles.sectionTitle}>Returning to Manager</Text>
              </View>
              <Text style={styles.sectionSubtitle}>Waiting for your manager to scan the QR</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pendingRow}>
                {returning.map((delivery) => (
                  <Pressable
                    key={delivery.transactionId}
                    style={styles.pendingCard}
                    onPress={() => handleReturningPress(delivery)}
                  >
                    <UserAvatar
                      photoUrl={delivery.targetRecipientPhotoUrl}
                      fallbackText={getInitials(delivery.targetRecipientName)}
                      size={52}
                      backgroundColor="#F1F3F6"
                      fallbackTextColor={COLORS.primary}
                      style={styles.avatarCircleMargin}
                    />
                    <Text style={styles.pendingName} numberOfLines={1}>
                      {delivery.branchName || 'Branch'}
                    </Text>
                    <View style={[styles.pendingBadge, { backgroundColor: '#FFE9D6' }]}>
                      <Text style={[styles.pendingBadgeText, { color: '#B2560A' }]}>Returning</Text>
                    </View>
                    <Text style={styles.pendingRole}>Tap to show QR</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}

          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      {selectionMode !== 'single' && selectedIds.length > 0 && (
        <View style={styles.nextBar}>
          <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
            <Icon name="truck" size={16} color="#FFFFFF" />
            <Text style={styles.nextButtonText}>
              Review {selectedIds.length} Deliver{selectedIds.length === 1 ? 'y' : 'ies'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ConfirmationDialog
        visible={!!returnCandidate}
        onCancel={() => setReturnCandidate(null)}
        onConfirm={handleConfirmReturn}
        icon="arrowUUpLeft"
        title="Return to Manager?"
        description={
          returnCandidate
            ? `This will return the item(s) from ${returnCandidate.targetRecipientName || 'this delivery'} back to the manager instead of delivering them. You'll get a QR to show your manager.`
            : ''
        }
        confirmLabel={isReturning ? 'Starting…' : 'Return to Manager'}
      />
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
    width: 170,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    padding: SPACING.md,
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
  pendingMetaBlock: {
    alignSelf: 'stretch',
    gap: 4,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  pendingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pendingMetaText: {
    flexShrink: 1,
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
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
  modeChipRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  modeChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderNeutral,
    backgroundColor: COLORS.textWhite,
  },
  modeChipActive: {
    backgroundColor: COLORS.textPrimary,
    borderColor: COLORS.textPrimary,
  },
  modeChipText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textPrimary,
  },
  modeChipTextActive: {
    color: COLORS.textWhite,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
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
  readyCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '08',
  },
  selectDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#C0C0C0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectDotActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  readyTextCol: { flex: 1 },
  readyName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  readyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  readyMetaText: {
    flexShrink: 1,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', fontFamily: TYPOGRAPHY.fontFamily.bold },
});
