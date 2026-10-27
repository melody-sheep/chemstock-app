// src/screens/salesrep/RequestListSR.js
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import Alert from '../../utils/appAlert';
import { StatusBar } from 'expo-status-bar';
import { BlurTargetView } from 'expo-blur';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import Header from '../../components/common/Header';
import SubScreenSecondaryHeader from '../../components/common/SubScreenSecondaryHeader';
import Icon from '../../components/common/Icon';
import OutboxFailedNotice from '../../components/common/OutboxFailedNotice';
import Button from '../../components/common/Button';
import BottomActionBar, { useBottomActionBarHeight } from '../../components/common/BottomActionBar';
import authService from '../../services/authService';
import requestService from '../../services/requestService';
import outboxService from '../../services/outboxService';
import { getConnectionStatus } from '../../services/connectionStatus';
import useOutbox from '../../hooks/useOutbox';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import { STOCK_HEALTHY_THRESHOLD } from '../../constants/inventory';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import friendlyError from '../../utils/friendlyError';
import KeyboardAwareScrollView from '../../components/common/KeyboardAwareScrollView';
import { getDeviceLabel, getDeviceOs } from '../../utils/deviceInfo';

export default function RequestListSR() {
  const navigation = useNavigation();
  const route = useRoute();
  const blurTarget = useRef(null);
  // Items and details can be folded away, like the release summary on the Manager side. Both start open.
  const [itemsOpen, setItemsOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const bottomActionBarHeight = useBottomActionBarHeight();

  const [items, setItems] = useState(route.params?.items || []);
  // Branch stock rows passed from Request Stock. The cap follows the branch
  // picked on this screen, because stock is per branch.
  const stockRows = route.params?.stock || [];
  const availableAt = (productCode, branchId) =>
    stockRows
      .filter((row) => row.product_code === productCode && row.branch_id === branchId)
      .reduce((sum, row) => sum + row.quantity, 0);
  const capQty = (productCode, quantity) =>
    selectedBranchId ? Math.min(quantity, availableAt(productCode, selectedBranchId)) : quantity;

  const isShortAtBranch = (item) => !!selectedBranchId && item.quantity > availableAt(item.productCode, selectedBranchId);
  const [agent, setAgent] = useState(null);
  const [coords, setCoords] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [capturedAt] = useState(() => new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const { pendingCount, failed: failedItems, retryNow, discard } = useOutbox('stock_request', agent?.id ?? null);
  // Chosen on Request Stock, so this list only ever sends to that branch.
  const selectedBranchId = route.params?.branchId || null;
  const branchName = route.params?.branchName || '';

  useEffect(() => {
    authService.getCurrentUser().then(setAgent);

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('Location permission denied');
          return;
        }
        const position = await Location.getCurrentPositionAsync({});
        setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      } catch (error) {
        console.error('[ERROR] [RequestListSR] Location error:', error);
        setLocationError('Unable to determine location');
      }
    })();
  }, []);

  const deviceLabel = getDeviceLabel(agent?.full_name || agent?.username);

  const handleAdjustQty = (productCode, delta) => {
    setItems((prev) =>
      prev
        .map((item) =>
          item.productCode === productCode ? { ...item, quantity: capQty(productCode, item.quantity + delta) } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  // Typed quantity. Clearing the box shows 0 while editing; leaving it empty
  // snaps back to 1, so a row can never be sent with 0 units.
  const handleSetQty = (productCode, quantity) => {
    setItems((prev) =>
      prev.map((item) => (item.productCode === productCode ? { ...item, quantity: capQty(productCode, quantity) } : item))
    );
  };

  const handleRemove = (productCode) => {
    setItems((prev) => prev.filter((item) => item.productCode !== productCode));
  };

  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);

  const handleSend = async () => {
    if (!agent || items.length === 0 || isSubmitting) return;
    if (!selectedBranchId) {
      Alert.alert('Choose a branch', 'Pick which branch this request is for.');
      return;
    }
    const overStock = items.find((item) => item.quantity > availableAt(item.productCode, selectedBranchId));
    if (overStock) {
      Alert.alert(
        'Not enough stock',
        `${overStock.productName} has ${availableAt(overStock.productCode, selectedBranchId)} pcs at the selected branch. Lower the quantity to send the request.`
      );
      return;
    }
    setIsSubmitting(true);

    const requestPayload = {
      agentId: agent.id,
      latitude: coords?.latitude,
      longitude: coords?.longitude,
      deviceModel: Device.modelName,
      deviceOs: getDeviceOs(),
      items,
      // Required for multi-branch agents (e.g. Clint: Iponan + Butuan) —
      // this screen already shows "Sending to {branchName}", it just
      // wasn't being sent to the server. See 2026-10-08c SQL.
      branchId: selectedBranchId,
    };

    try {
      // Already known offline — don't even attempt the live call. No photo
      // on this flow, so there's nothing to persist beyond the payload.
      if (!getConnectionStatus().online) {
        await outboxService.enqueue('stock_request', requestPayload);
        Alert.alert(
          'Saved — Will Send Later',
          "You're offline. Your stock request is saved on this device and will send automatically once you're back online.",
          [{ text: 'OK', onPress: () => navigation.navigate('SalesRepDashboard') }]
        );
        return;
      }

      try {
        const result = await requestService.submitStockRequest(requestPayload);
        if (!result.success) {
          throw new Error(result.message);
        }
      } catch (liveError) {
        // A failure that leaves us offline is a network problem, not a real
        // rejection — queue it instead of showing an error. Anything else
        // (still online) is a genuine failure, handled below as before.
        if (!getConnectionStatus().online) {
          await outboxService.enqueue('stock_request', requestPayload);
          Alert.alert(
            'Saved — Will Send Later',
            "Connection dropped mid-submit. Your stock request is saved on this device and will send automatically once you're back online.",
            [{ text: 'OK', onPress: () => navigation.navigate('SalesRepDashboard') }]
          );
          return;
        }
        throw liveError;
      }

      Alert.alert(
        'Request sent',
        `${items.length} item${items.length === 1 ? '' : 's'}, ${totalUnits} units sent to your branch manager.`,
        [{ text: 'OK', onPress: handleDone }],
        { cancelable: false }
      );
    } catch (error) {
      Alert.alert('Failed to Send Request', friendlyError(error.message) || 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDone = () => navigation.navigate('SalesRepDashboard');

  if (isSent) {
    return (
      <>
        <StatusBar style="light" />
        <View style={styles.container}>
          <Header title="Request Sent" height={56} backgroundColor="#03045E" textColor="#FFFFFF" paddingHorizontal={SPACING.md} />
          <View style={styles.successWrap}>
            <Icon name="checkCircle" size={48} color={COLORS.success} weight="fill" />
            <Text style={styles.successTitle}>Request Sent Successfully</Text>
            <Text style={styles.successSubtitle}>
              {items.length} item{items.length === 1 ? '' : 's'}, {totalUnits} units sent to your branch manager
            </Text>
            <Button title="Done" variant="black" onPress={handleDone} style={styles.doneButton} />
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header showBackButton backButtonText="Request Stock" height={56} backgroundColor="#03045E" textColor="#FFFFFF" paddingHorizontal={SPACING.md} />
        <SubScreenSecondaryHeader title="Request List" />

        <BlurTargetView ref={blurTarget} style={styles.contentTarget}>
        <KeyboardAwareScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomActionBarHeight + SPACING.lg }]} showsVerticalScrollIndicator={false}>
          {pendingCount > 0 && (
            <View style={styles.pendingBanner}>
              <View style={styles.pendingIconCircle}>
                <Icon name="clock" size={14} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingBannerTitle}>
                  Pending — {pendingCount} waiting to send
                </Text>
                <Text style={styles.pendingBannerText}>
                  Saved on this device. Sends automatically once you're back online.
                </Text>
              </View>
              <TouchableOpacity onPress={retryNow} style={styles.pendingRetryButton}>
                <Text style={styles.pendingRetryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          <OutboxFailedNotice failed={failedItems} agentId={agent?.id} onRetry={retryNow} onDiscard={discard} />

          <View style={styles.summaryCard}>
            <View style={styles.summaryIcon}>
              <Icon name="building" size={20} color={COLORS.primary} />
            </View>
            <View style={styles.summaryTextCol}>
              <Text style={styles.summaryLabel}>SENDING TO</Text>
              <Text style={styles.summaryBranch} numberOfLines={1}>{branchName || 'branch'}</Text>
            </View>
            <View style={styles.summaryCount}>
              <Text style={styles.summaryCountText}>
                {items.length} item{items.length === 1 ? '' : 's'} · {totalUnits} pcs
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.foldHeader}
            onPress={() => setItemsOpen((value) => !value)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={itemsOpen ? 'Collapse items' : 'Expand items'}
            accessibilityState={{ expanded: itemsOpen }}
          >
            <Text style={styles.foldLabel}>ITEMS</Text>
            <View style={{ flex: 1 }} />
            <View style={styles.foldPill}>
              <Text style={styles.foldPillText}>{itemsOpen ? 'Show less' : `Show all (${items.length})`}</Text>
              <View style={{ transform: [{ rotate: itemsOpen ? '180deg' : '0deg' }] }}>
                <Icon name="caretDown" size={14} color="#0085F9" weight="bold" />
              </View>
            </View>
          </TouchableOpacity>

          {items.length === 0 ? (
            <View style={styles.emptyBox}>
              <Icon name="package" size={28} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>No items in your request.</Text>
            </View>
          ) : (
            <View style={styles.itemsCard}>
              {(itemsOpen ? items : items.slice(0, 1)).map((item, index) => {
                const atBranch = availableAt(item.productCode, selectedBranchId);
                const short = isShortAtBranch(item);
                const pill = short || atBranch === 0
                  ? { bg: '#FDECEC', color: '#B91C1C' }
                  : atBranch < STOCK_HEALTHY_THRESHOLD
                  ? { bg: '#FFF1D6', color: '#B26400' }
                  : { bg: '#E1F4E8', color: '#1E7A3A' };
                const catalogImage = PRODUCT_CATALOG.find((p) => p.code === item.productCode)?.image;
                return (
                  <View key={item.productCode} style={[styles.itemRow, index === 0 && styles.itemRowFirst]}>
                    <View style={styles.thumbnail}>
                      {catalogImage ? (
                        <Image source={catalogImage} style={styles.thumbnailImage} resizeMode="contain" />
                      ) : (
                        <Icon name="package" size={22} color="#94a3b8" />
                      )}
                    </View>
                    <View style={styles.itemInfo}>
                      <View style={styles.itemTitleRow}>
                        <Text style={styles.itemName} numberOfLines={1}>{item.productName}</Text>
                        <TouchableOpacity
                          onPress={() => handleRemove(item.productCode)}
                          style={styles.removeBtn}
                          hitSlop={8}
                          accessibilityLabel={`Remove ${item.productName}`}
                        >
                          <Icon name="trash" size={18} color={COLORS.error} />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.itemBottomRow}>
                      <View style={[styles.stockPill, { backgroundColor: pill.bg }]}>
                        <Text style={[styles.stockPillText, { color: pill.color }]}>
                          {short ? `Only ${atBranch} left` : `${atBranch} pcs at branch`}
                        </Text>
                      </View>
                      <View style={styles.stepperInline}>
                        <TouchableOpacity
                          style={styles.stepperBtn}
                          onPress={() => handleAdjustQty(item.productCode, -1)}
                          accessibilityLabel={`Decrease ${item.productName} quantity`}
                        >
                          <Icon name="minus" size={14} color={COLORS.primary} weight="bold" />
                        </TouchableOpacity>
                        <TextInput
                          style={styles.qtyInput}
                          value={String(item.quantity)}
                          keyboardType="number-pad"
                          selectTextOnFocus
                          maxLength={5}
                          onChangeText={(text) =>
                            handleSetQty(item.productCode, parseInt(text.replace(/\D/g, ''), 10) || 0)
                          }
                          onEndEditing={() => handleSetQty(item.productCode, Math.max(1, item.quantity))}
                          accessibilityLabel={`${item.productName} quantity`}
                        />
                        <TouchableOpacity
                          style={[styles.stepperBtn, styles.stepperBtnPlus]}
                          onPress={() => handleAdjustQty(item.productCode, 1)}
                          accessibilityLabel={`Increase ${item.productName} quantity`}
                        >
                          <Icon name="plus" size={14} color="#FFFFFF" weight="bold" />
                        </TouchableOpacity>
                      </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <TouchableOpacity
            style={styles.foldHeader}
            onPress={() => setDetailsOpen((value) => !value)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={detailsOpen ? 'Collapse request details' : 'Expand request details'}
            accessibilityState={{ expanded: detailsOpen }}
          >
            <Text style={styles.foldLabel}>REQUEST DETAILS</Text>
            <View style={{ flex: 1 }} />
            <View style={styles.foldPill}>
              <Text style={styles.foldPillText}>{detailsOpen ? 'Show less' : 'Show all'}</Text>
              <View style={{ transform: [{ rotate: detailsOpen ? '180deg' : '0deg' }] }}>
                <Icon name="caretDown" size={14} color="#0085F9" weight="bold" />
              </View>
            </View>
          </TouchableOpacity>
          <View style={styles.metaCard}>
            <View style={styles.metaRow}>
              <View style={[styles.metaIcon, { backgroundColor: '#FDECEC' }]}>
                <Icon name="location" size={16} color={COLORS.error} />
              </View>
              <Text style={styles.metaText}>
                {coords ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` : locationError || 'Locating…'}
              </Text>
            </View>
            {detailsOpen && (
            <>
            <View style={styles.metaRow}>
              <View style={[styles.metaIcon, { backgroundColor: '#EAF4FF' }]}>
                <Icon name="package" size={16} color={COLORS.primary} />
              </View>
              <Text style={styles.metaText}>{deviceLabel || 'Unknown device'}</Text>
            </View>
            <View style={styles.metaRow}>
              <View style={[styles.metaIcon, { backgroundColor: '#F1F3F6' }]}>
                <Icon name="calendar" size={16} color={COLORS.textSecondary} />
              </View>
              <Text style={styles.metaText}>{capturedAt.toLocaleString()}</Text>
            </View>
            </>
            )}
          </View>
        </KeyboardAwareScrollView>
        </BlurTargetView>

        <BottomActionBar variant="glass" blurTarget={blurTarget}>
          <Button
            title={isSubmitting ? 'Sending…' : 'Send Request'}
            variant="black"
            onPress={handleSend}
            loading={isSubmitting}
            disabled={isSubmitting || !agent || items.length === 0 || !selectedBranchId}
            height={48}
            fontSize={16}
            borderRadius={24}
          />
        </BottomActionBar>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  contentTarget: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: 48, gap: SPACING.sm },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  summaryIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EAF4FF', alignItems: 'center', justifyContent: 'center' },
  summaryTextCol: { flex: 1 },
  summaryLabel: { fontSize: 11, letterSpacing: 0.8, color: COLORS.textTertiary, fontFamily: TYPOGRAPHY.fontFamily.semibold, fontWeight: '600' },
  summaryBranch: { marginTop: 1, fontSize: TYPOGRAPHY.fontSize.base, color: '#272632', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  summaryCount: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, backgroundColor: '#EAF4FF' },
  summaryCountText: { fontSize: TYPOGRAPHY.fontSize.xs, color: '#0085F9', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  foldHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm, paddingVertical: 4 },
  foldLabel: { fontSize: 12, letterSpacing: 0.8, color: COLORS.textTertiary, fontFamily: TYPOGRAPHY.fontFamily.semibold, fontWeight: '600' },
  foldPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, backgroundColor: '#EAF4FF' },
  foldPillText: { fontSize: 12, color: '#0085F9', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  foldHint: { fontSize: 12, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.regular },
  sectionLabel: { marginTop: SPACING.sm, fontSize: 12, letterSpacing: 0.8, color: COLORS.textTertiary, fontFamily: TYPOGRAPHY.fontFamily.semibold, fontWeight: '600' },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  itemBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.xs, marginTop: 6 },
  stockPill: { flexShrink: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  stockPillText: { fontSize: 12, fontFamily: TYPOGRAPHY.fontFamily.semibold, fontWeight: '600' },
  stepperBtnPlus: { backgroundColor: COLORS.primary },
  metaIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF1D6',
    borderWidth: 1,
    borderColor: '#F2C94C',
    borderRadius: 14,
    padding: 12,
  },
  pendingIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#B26400',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingBannerTitle: {
    fontSize: 13,
    color: '#7A4A00',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  pendingBannerText: {
    fontSize: 12,
    color: '#7A4A00',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  pendingRetryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#B26400',
  },
  pendingRetryText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  emptyBox: {
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  itemsCard: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  itemRowFirst: { borderTopWidth: 0 },
  thumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F1F3F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailImage: {
    width: '70%',
    height: '70%',
  },
  itemInfo: { flex: 1 },
  itemNameFlex: { flex: 1 },
  itemName: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  itemMeta: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  stepperInline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepperBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  stepperValue: {
    minWidth: 26,
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: '#272632',
  },
  removeBtn: { padding: 4 },
  shortText: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.error,
  },
  qtyInput: {
    minWidth: 44,
    height: 30,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: '#272632',
    backgroundColor: '#FFFFFF',
    paddingVertical: 0,
  },
  summaryText: {
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: '#272632',
  },
  metaCard: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    gap: 6,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  metaText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: '#272632',
  },
  sendButton: { marginTop: SPACING.sm },
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: SPACING.sm,
  },
  successTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  doneButton: { width: '100%' },
  branchChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  branchChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: '#FFFFFF',
  },
  branchChipActive: { backgroundColor: COLORS.primary },
  branchChipText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.primary,
  },
  branchChipTextActive: { color: '#FFFFFF' },
});
