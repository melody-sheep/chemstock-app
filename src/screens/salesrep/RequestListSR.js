// src/screens/salesrep/RequestListSR.js
import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import Header from '../../components/common/Header';
import SubScreenSecondaryHeader from '../../components/common/SubScreenSecondaryHeader';
import Icon from '../../components/common/Icon';
import Button from '../../components/common/Button';
import authService from '../../services/authService';
import requestService from '../../services/requestService';
import outboxService from '../../services/outboxService';
import { getConnectionStatus } from '../../services/connectionStatus';
import useOutbox from '../../hooks/useOutbox';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

export default function RequestListSR() {
  const navigation = useNavigation();
  const route = useRoute();

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
  const { pendingCount, retryNow } = useOutbox('stock_request');
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

  const deviceLabel = [Device.modelName, Device.osName, Device.osVersion].filter(Boolean).join(' - ');

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
      deviceOs: `${Device.osName || ''} ${Device.osVersion || ''}`.trim(),
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

      setIsSent(true);
    } catch (error) {
      Alert.alert('Failed to Send Request', error.message || 'Please try again.');
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

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {pendingCount > 0 && (
            <View style={styles.pendingBanner}>
              <View style={styles.pendingIconCircle}>
                <Icon name="clock" size={14} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingBannerTitle}>
                  Pending — {pendingCount} waiting to sync
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

          <Text style={styles.sectionTitle}>Sending to {branchName || 'branch'}</Text>

          <Text style={styles.sectionTitle}>Requested Items</Text>

          {items.length === 0 ? (
            <View style={styles.emptyBox}>
              <Icon name="boxPackage" size={28} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>No items in your request.</Text>
            </View>
          ) : (
            <View style={styles.itemsCard}>
              {items.map((item, index) => (
                <View key={item.productCode} style={[styles.itemRow, index === 0 && styles.itemRowFirst]}>
                  <View style={styles.thumbnail}>
                    {PRODUCT_CATALOG.find((p) => p.code === item.productCode)?.image ? (
                      <Image
                        source={PRODUCT_CATALOG.find((p) => p.code === item.productCode).image}
                        style={styles.thumbnailImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <Icon name="boxPackage" size={22} color="#94a3b8" />
                    )}
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.productName}</Text>
                    <Text style={styles.itemMeta}>Code: {item.productCode}</Text>
                    {isShortAtBranch(item) && (
                      <Text style={styles.shortText}>
                        Only {availableAt(item.productCode, selectedBranchId)} pcs at this branch
                      </Text>
                    )}
                  </View>
                  <View style={styles.stepperInline}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => handleAdjustQty(item.productCode, -1)}
                      accessibilityLabel={`Decrease ${item.productName} quantity`}
                    >
                      <Icon name="minus" size={14} color={COLORS.primary} />
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
                      style={styles.stepperBtn}
                      onPress={() => handleAdjustQty(item.productCode, 1)}
                      accessibilityLabel={`Increase ${item.productName} quantity`}
                    >
                      <Icon name="plus" size={14} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity onPress={() => handleRemove(item.productCode)} style={styles.removeBtn}>
                    <Icon name="trash" size={16} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {items.length > 0 && (
            <Text style={styles.summaryText}>
              📦 {items.length} item{items.length === 1 ? '' : 's'}, {totalUnits} units to request
            </Text>
          )}

          <Text style={styles.sectionTitle}>Request Details</Text>
          <View style={styles.metaCard}>
            <View style={styles.metaRow}>
              <Icon name="location" size={16} color={COLORS.error} />
              <Text style={styles.metaText}>
                {coords ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` : locationError || 'Locating…'}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Icon name="building" size={16} color={COLORS.primary} />
              <Text style={styles.metaText}>{branchName || 'Loading branch…'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Icon name="package" size={16} color={COLORS.textSecondary} />
              <Text style={styles.metaText}>{deviceLabel || 'Unknown device'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Icon name="calendar" size={16} color={COLORS.textSecondary} />
              <Text style={styles.metaText}>{capturedAt.toLocaleString()}</Text>
            </View>
          </View>

          <Button
            title={isSubmitting ? 'Sending…' : 'Send Request'}
            variant="black"
            onPress={handleSend}
            loading={isSubmitting}
            disabled={isSubmitting || !agent || items.length === 0 || !selectedBranchId}
            style={styles.sendButton}
          />
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 48, gap: SPACING.md },
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
    fontSize: 11,
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
    fontSize: 11,
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    padding: SPACING.md,
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
  itemName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  itemMeta: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  stepperInline: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  stepperBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
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
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.error,
  },
  qtyInput: {
    minWidth: 52,
    height: 34,
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
    padding: SPACING.md,
    gap: SPACING.sm,
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
