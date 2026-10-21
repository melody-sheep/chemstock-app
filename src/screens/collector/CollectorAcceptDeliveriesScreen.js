// src/screens/collector/CollectorAcceptDeliveriesScreen.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import Alert from '../../utils/appAlert';
import { StatusBar } from 'expo-status-bar';
import { BlurTargetView } from 'expo-blur';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SubScreenSecondaryHeader from '../../components/common/SubScreenSecondaryHeader';
import Icon from '../../components/common/Icon';
import UserAvatar from '../../components/common/UserAvatar';
import StockSectionHeader from '../../components/common/StockSectionHeader';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import CustomModal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import BottomActionBar, { useBottomActionBarHeight } from '../../components/common/BottomActionBar';
import authService from '../../services/authService';
import deliveryService from '../../services/deliveryService';
import { getInitials } from '../../utils/initials';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import friendlyError from '../../utils/friendlyError';
import requireOnline from '../../utils/requireOnline';

// Date filter on when each delivery was released to this Collector.
const DATE_FILTERS = [
  { key: 'all', label: 'All time', test: () => true },
  { key: 'today', label: 'Today', test: (d) => new Date(d.createdAt).toDateString() === new Date().toDateString() },
  { key: 'week', label: 'This week', test: (d) => (Date.now() - new Date(d.createdAt).getTime()) / 86400000 <= 7 },
  { key: 'month', label: 'This month', test: (d) => (Date.now() - new Date(d.createdAt).getTime()) / 86400000 <= 30 },
];

// "Today · 3:12 AM", "Yesterday · 7:49 PM", "Oct 18 · 3:58 PM".
function formatStamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === new Date().toDateString()) return `Today · ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday · ${time}`;
  return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${time}`;
}

const SELECTION_MODES = [
  { key: 'all', label: 'All' },
  { key: 'single', label: 'Single' },
  { key: 'batch', label: 'Batch' },
];

export default function CollectorAcceptDeliveriesScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  // Two ways in: back from "Stock accepted" (highlightId), or a "New delivery assigned" notification
  // (focusId). Either way that delivery is marked for a few seconds.
  const highlightId = route.params?.highlightId || route.params?.focusId || null;
  const [highlightedId, setHighlightedId] = useState(null);
  const scrollRef = useRef(null);
  const readyListYRef = useRef(0);
  const readyCardYRef = useRef({});
  const pendingRowRef = useRef(null);
  const pendingCardXRef = useRef({});
  const [agent, setAgent] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectionMode, setSelectionMode] = useState('single');
  const [dateFilter, setDateFilter] = useState('all');
  const blurTarget = useRef(null);
  const bottomActionBarHeight = useBottomActionBarHeight();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [returnCandidate, setReturnCandidate] = useState(null);
  // Hold on a ready card: the options for that delivery, shown as a bottom sheet.
  const [actionDelivery, setActionDelivery] = useState(null);
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

  const activeDateFilter = DATE_FILTERS.find((option) => option.key === dateFilter) || DATE_FILTERS[0];
  const pending = deliveries.filter((d) => d.stage === 'pending_pickup' && activeDateFilter.test(d));
  const ready = deliveries.filter((d) => d.stage === 'ready_to_deliver' && activeDateFilter.test(d));
  const returning = deliveries.filter((d) => d.stage === 'returning' && activeDateFilter.test(d));

  useEffect(() => {
    if (!highlightId || isLoading) return undefined;
    if (!deliveries.some((d) => d.transactionId === highlightId)) return undefined;
    setHighlightedId(highlightId);
    const scrollTimer = setTimeout(() => {
      const x = pendingCardXRef.current[highlightId];
      if (x != null) pendingRowRef.current?.scrollTo({ x: Math.max(0, x - 16), animated: true });
      const y = readyCardYRef.current[highlightId];
      if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, readyListYRef.current + y - 120), animated: true });
    }, 350);
    const fadeTimer = setTimeout(() => {
      setHighlightedId(null);
      navigation.setParams({ highlightId: undefined, focusId: undefined });
    }, 4500);
    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(fadeTimer);
    };
  }, [highlightId, isLoading, deliveries]);

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
    setActionDelivery(delivery);
  };

  const handleStartFromSheet = () => {
    const delivery = actionDelivery;
    setActionDelivery(null);
    if (delivery) navigation.navigate('CollectorTripReview', { transactionIds: [delivery.transactionId] });
  };

  const handleReturnFromSheet = () => {
    const delivery = actionDelivery;
    setActionDelivery(null);
    if (delivery) setReturnCandidate(delivery);
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

  const showNextBar = selectionMode !== 'single' && selectedIds.length > 0;

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
        <BlurTargetView ref={blurTarget} style={styles.contentTarget}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.content, showNextBar && { paddingBottom: bottomActionBarHeight + SPACING.lg }]}
          showsVerticalScrollIndicator={false}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateChipRow}>
            {DATE_FILTERS.map((option) => {
              const active = option.key === dateFilter;
              return (
                <Pressable
                  key={option.key}
                  style={[styles.modeChip, active && styles.modeChipActive]}
                  onPress={() => {
                    setDateFilter(option.key);
                    setSelectedIds([]); // a selection never carries over to deliveries that are now hidden
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <StockSectionHeader
            dotColor={COLORS.accentGold}
            label="Pending Deliveries"
            count={pending.length}
            tooltip="Deliveries released to you that you still need to pick up from the manager."
          />

          {pending.length === 0 ? (
            <Text style={styles.emptyText}>{dateFilter === 'all' ? 'No pending pickups right now.' : 'No pending pickups in this period.'}</Text>
          ) : (
            <ScrollView ref={pendingRowRef} horizontal showsHorizontalScrollIndicator={false} style={styles.pendingRow}>
              {pending.map((delivery) => {
                const itemCount = (delivery.items || []).length;
                const totalUnits = (delivery.items || []).reduce((s, it) => s + it.quantity, 0);
                return (
                  <View
                    key={delivery.transactionId}
                    style={[styles.pendingCardC, highlightedId === delivery.transactionId && styles.pendingCardHighlight]}
                    onLayout={(event) => { pendingCardXRef.current[delivery.transactionId] = event.nativeEvent.layout.x; }}
                  >
                    <View style={styles.cardTopC}>
                      <UserAvatar
                        photoUrl={delivery.targetRecipientPhotoUrl}
                        fallbackText={getInitials(delivery.targetRecipientName)}
                        size={40}
                        backgroundColor="#F1F3F6"
                        fallbackTextColor={COLORS.primary}
                      />
                      <View style={styles.cardTextC}>
                        <Text style={styles.cardNameC} numberOfLines={1}>
                          {delivery.targetRecipientName || 'Sales Rep'}
                        </Text>
                        <View style={styles.pendingMetaRow}>
                          <Icon name="package" size={11} color={COLORS.textSecondary} />
                          <Text style={styles.pendingMetaText} numberOfLines={1}>
                            {itemCount} item{itemCount === 1 ? '' : 's'} · {totalUnits} unit{totalUnits === 1 ? '' : 's'}
                          </Text>
                        </View>
                        {!!formatStamp(delivery.createdAt) && (
                          <View style={styles.pendingMetaRow}>
                            <Icon name="clock" size={11} color={COLORS.textSecondary} />
                            <Text style={styles.pendingMetaText} numberOfLines={1}>{formatStamp(delivery.createdAt)}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.pendingBadge}>
                        <Text style={styles.pendingBadgeText}>Pending</Text>
                      </View>
                    </View>
                    <View style={styles.cardBottomC}>
                      <View style={styles.cardBranchC}>
                        <Icon name="building" size={12} color={COLORS.textSecondary} />
                        <Text style={styles.pendingMetaText} numberOfLines={1}>
                          {delivery.branchName || 'Branch'}
                        </Text>
                      </View>
                      <TouchableOpacity style={styles.viewButtonC} onPress={() => handleViewPending(delivery)}>
                        <Text style={styles.viewButtonText}>View</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}

          <View style={styles.readyHeaderRow}>
            <StockSectionHeader
              dotColor={COLORS.success}
              label="Ready to Deliver"
              count={ready.length}
              tooltip="Stock you have already accepted. Tap one to start its trip."
            />
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
            <Text style={styles.emptyText}>{dateFilter === 'all' ? 'No deliveries ready to go out yet.' : 'No ready deliveries in this period.'}</Text>
          ) : (
            <View style={styles.readyList} onLayout={(event) => { readyListYRef.current = event.nativeEvent.layout.y; }}>
              {ready.map((delivery) => {
                const isSelected = selectedIds.includes(delivery.transactionId);
                const isMultiMode = selectionMode !== 'single';
                const itemCount = (delivery.items || []).length;
                const totalUnits = (delivery.items || []).reduce((s, it) => s + it.quantity, 0);
                return (
                  <TouchableOpacity
                    key={delivery.transactionId}
                    style={[styles.readyCard, isMultiMode && isSelected && styles.readyCardSelected, highlightedId === delivery.transactionId && styles.readyCardHighlight]}
                    onLayout={(event) => { readyCardYRef.current[delivery.transactionId] = event.nativeEvent.layout.y; }}
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
                      {!!formatStamp(delivery.createdAt) && (
                        <View style={styles.readyMetaRow}>
                          <Icon name="clock" size={11} color={COLORS.textSecondary} />
                          <Text style={styles.readyMetaText} numberOfLines={1}>{formatStamp(delivery.createdAt)}</Text>
                        </View>
                      )}
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
              <StockSectionHeader
                dotColor={COLORS.accentOrange}
                label="Returning to Manager"
                count={returning.length}
                tooltip="Waiting for your manager to scan the return QR."
                style={{ marginTop: SPACING.lg }}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pendingRow}>
                {returning.map((delivery) => (
                  <Pressable
                    key={delivery.transactionId}
                    style={styles.pendingCardC}
                    onPress={() => handleReturningPress(delivery)}
                  >
                    <View style={styles.cardTopC}>
                      <UserAvatar
                        photoUrl={delivery.targetRecipientPhotoUrl}
                        fallbackText={getInitials(delivery.targetRecipientName)}
                        size={40}
                        backgroundColor="#F1F3F6"
                        fallbackTextColor={COLORS.primary}
                      />
                      <View style={styles.cardTextC}>
                        <Text style={styles.cardNameC} numberOfLines={1}>
                          {delivery.branchName || 'Branch'}
                        </Text>
                        <Text style={styles.pendingMetaText}>Tap to show QR</Text>
                      </View>
                      <View style={[styles.pendingBadge, { backgroundColor: '#FFE9D6' }]}>
                        <Text style={[styles.pendingBadgeText, { color: '#B2560A' }]}>Returning</Text>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}

          <View style={{ height: 24 }} />
        </ScrollView>
        </BlurTargetView>
      )}

      {showNextBar && (
        <BottomActionBar variant="glass" blurTarget={blurTarget}>
          <Button
            title={`Review ${selectedIds.length} Deliver${selectedIds.length === 1 ? 'y' : 'ies'}`}
            variant="black"
            icon="truck"
            onPress={handleNext}
            height={48}
            fontSize={16}
            borderRadius={24}
          />
        </BottomActionBar>
      )}

      <CustomModal visible={!!actionDelivery} onClose={() => setActionDelivery(null)} height="auto">
        {actionDelivery && (() => {
          const units = (actionDelivery.items || []).reduce((sum, it) => sum + it.quantity, 0);
          const count = (actionDelivery.items || []).length;
          return (
            <>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <UserAvatar
                  photoUrl={actionDelivery.targetRecipientPhotoUrl}
                  fallbackText={getInitials(actionDelivery.targetRecipientName)}
                  size={48}
                  backgroundColor="#F1F3F6"
                  fallbackTextColor={COLORS.primary}
                />
                <View style={styles.sheetHeaderText}>
                  <Text style={styles.sheetTitle} numberOfLines={1}>{actionDelivery.targetRecipientName || 'Sales Rep'}</Text>
                  <Text style={styles.sheetMeta}>
                    {count} item{count === 1 ? '' : 's'} · {units} unit{units === 1 ? '' : 's'}
                    {formatStamp(actionDelivery.createdAt) ? `  ·  ${formatStamp(actionDelivery.createdAt)}` : ''}
                  </Text>
                </View>
                <View style={styles.readyBadge}>
                  <Text style={styles.readyBadgeText}>Ready</Text>
                </View>
              </View>

              <Text style={styles.sheetLabel}>WHAT WOULD YOU LIKE TO DO?</Text>
              <Pressable style={styles.optionRow} onPress={handleStartFromSheet} accessibilityRole="button">
                <View style={[styles.optionIcon, { backgroundColor: '#EAF4FF' }]}>
                  <Icon name="truck" size={20} color="#0085F9" />
                </View>
                <View style={styles.optionTextCol}>
                  <Text style={styles.optionTitle}>Start Delivery</Text>
                  <Text style={styles.optionHint}>Review this item and start its trip</Text>
                </View>
                <Icon name="arrowRight" size={16} color="#94a3b8" />
              </Pressable>
              <Pressable style={styles.optionRow} onPress={handleReturnFromSheet} accessibilityRole="button">
                <View style={[styles.optionIcon, { backgroundColor: '#FDEBF1' }]}>
                  <Icon name="arrowUUpLeft" size={20} color="#E5366B" />
                </View>
                <View style={styles.optionTextCol}>
                  <Text style={[styles.optionTitle, { color: '#E5366B' }]}>Return to Manager</Text>
                  <Text style={styles.optionHint}>Send it back instead of delivering it</Text>
                </View>
                <Icon name="arrowRight" size={16} color="#94a3b8" />
              </Pressable>

              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setActionDelivery(null)}
                hasShadow={false}
                height={48}
                fontSize={16}
                borderRadius={24}
                width="100%"
                style={styles.sheetCancel}
              />
            </>
          );
        })()}
      </CustomModal>

      <ConfirmationDialog
        visible={!!returnCandidate}
        onCancel={() => setReturnCandidate(null)}
        onConfirm={handleConfirmReturn}
        icon="arrowUUpLeft"
        destructive
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
  contentTarget: { flex: 1 },
  sheetHandle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#DADDE3', marginTop: -8, marginBottom: 14 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetHeaderText: { flex: 1 },
  sheetTitle: { fontSize: TYPOGRAPHY.fontSize.lg, color: '#272632', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  sheetMeta: { marginTop: 1, fontSize: 12, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.regular },
  sheetLabel: { marginTop: 18, marginBottom: 8, fontSize: 12, letterSpacing: 0.8, color: '#6B7280', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 12, backgroundColor: '#FFFFFF' },
  optionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  optionTextCol: { flex: 1 },
  optionTitle: { fontSize: TYPOGRAPHY.fontSize.base, color: '#272632', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  optionHint: { marginTop: 1, fontSize: 12, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.regular },
  sheetCancel: { marginTop: 6 },
  dateChipRow: { gap: SPACING.sm, paddingRight: SPACING.lg },
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
  pendingRow: { marginBottom: SPACING.md },
  pendingCardC: { width: 280, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E5E5E5', padding: SPACING.sm + 2, marginRight: SPACING.sm, gap: 10 },
  cardTopC: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  cardTextC: { flex: 1 },
  cardNameC: { fontSize: TYPOGRAPHY.fontSize.sm, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: TYPOGRAPHY.fontWeight.bold, color: '#272632' },
  cardBottomC: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  cardBranchC: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewButtonC: { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 7, paddingHorizontal: 18 },
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
  pendingBadgeText: { fontSize: 11, fontWeight: '700', color: '#B26400', fontFamily: TYPOGRAPHY.fontFamily.bold },
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
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  pendingRole: {
    fontSize: 12,
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
    backgroundColor: '#EAF4FF',
    borderColor: '#0085F9',
  },
  modeChipText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textPrimary,
  },
  modeChipTextActive: {
    color: '#0085F9',
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
  pendingCardHighlight: { borderColor: '#0085F9', borderWidth: 2, backgroundColor: '#F1F7FF' },
  readyCardHighlight: { borderColor: '#0085F9', borderWidth: 2, backgroundColor: '#F1F7FF' },
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
  readyBadgeText: { fontSize: 11, fontWeight: '700', color: '#1E7A3A', fontFamily: TYPOGRAPHY.fontFamily.bold },
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
