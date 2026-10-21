// src/screens/salesrep/ReceiveStockTypeSR.js
import React, { useState, useCallback } from 'react';
import { View, Text, Image, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import Alert from '../../utils/appAlert';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../../components/common/Icon';
import LiveStatusPill from '../../components/common/LiveStatusPill';
import authService from '../../services/authService';
import deliveryService from '../../services/deliveryService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { RADIUS } from '../../styles/radius';
import { TYPOGRAPHY } from '../../styles/typography';
import friendlyError, { isNetworkError } from '../../utils/friendlyError';
import { savedReceivableDeliveries } from '../../utils/srDeliveries';
import { getConnectionStatus } from '../../services/connectionStatus';
import Header from '../../components/common/Header';
import SectionHeader from '../../components/common/SectionHeader';

export default function ReceiveStockTypeSR() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [pendingCount, setPendingCount] = useState(0);
  const [isChecking, setIsChecking] = useState(false);

  // Refresh the pending count every time the screen comes into focus.
  // The badge remains hidden when the lookup fails.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const agent = await authService.getCurrentUser();
          if (!agent?.id) {
            throw new Error('Current account is unavailable.');
          }
          const result = await deliveryService.getMyPendingHandoffs(agent.id);
          if (!result.success) {
            throw new Error(result.message || 'Could not load pending deliveries.');
          }
          if (active) setPendingCount((result.data || []).length);
        } catch (error) {
          console.warn('[WARN] [ReceiveStockTypeSR] Failed to refresh pending handoff count:', error);
          // Offline: count from the deliveries saved on this phone.
          const agent = await authService.getCurrentUser().catch(() => null);
          const saved = agent?.id ? await savedReceivableDeliveries(agent.id) : [];
          if (active) setPendingCount(saved.length);
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );


  const handleSelectType = async (handoffType) => {
    if (isChecking) return;
    if (handoffType === 'manager') {
      // Direct release — the SR scans the QR on the confirm screen itself.
      navigation.navigate('SalesRepConfirmHandoff', {});
      return;
    }

    // Via Collector Delivery — check pending handoffs before routing.
    setIsChecking(true);
    try {
      const agent = await authService.getCurrentUser();
      if (!agent?.id) {
        throw new Error('Your account could not be loaded. Please try again.');
      }
      const result = await deliveryService.getMyPendingHandoffs(agent.id);
      if (!result.success) {
        throw new Error(result.message || 'Could not load your pending deliveries.');
      }
      const count = (result.data || []).length;
      navigation.navigate('SalesRepTrackDeliveries', {
        filterPending: true,
        pendingCount: count,
      });
    } catch (error) {
      // Offline: show the deliveries saved on this phone instead of a dead end.
      if (!getConnectionStatus().online || isNetworkError(error.message)) {
        navigation.navigate('SalesRepTrackDeliveries', { filterPending: true });
        return;
      }
      Alert.alert(
        'Unable to Check',
        friendlyError(error.message) || 'Could not load your pending deliveries. Please try again.'
      );
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.screen}>
        {/* Header */}
        <Header
          showBackButton
          backButtonText="Sales Rep Dashboard"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          showDocumentIcon
          onDocumentPress={() => navigation.navigate('SalesRepLogs')}
        />

        {/* Secondary summary bar */}
        <View style={styles.summaryBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryTitle}>Receive Stock</Text>
            <Text style={styles.summarySubtitle}>How did the stock reach you?</Text>
          </View>
          <LiveStatusPill pillStyle={styles.statusPill} dotStyle={styles.statusDot} textStyle={styles.statusText} />
        </View>

        {/* Main content */}
        <View style={styles.content}>
          <SectionHeader icon="package" size="md" label="Choose the handover type" style={styles.labelFirst} />

          {/* Direct From Manager card */}
          <Pressable
            style={({ pressed }) => [styles.card, styles.cardDirect, pressed && styles.cardPressed]}
            onPress={() => handleSelectType('manager')}
            accessibilityRole="button"
            accessibilityLabel="Receive stock directly from manager"
          >
            <View style={styles.cardTop}>
              <View style={[styles.cardIconWrap, styles.cardIconWrapDirect]}>
                <Icon name="package" size={22} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Direct From Manager</Text>
                <Text style={styles.cardSubtitle}>You pick it up at the branch and scan its QR.</Text>
              </View>
              <Icon name="arrowRight" size={20} color={COLORS.primary} />
            </View>
          </Pressable>

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>or</Text>
            <View style={styles.orLine} />
          </View>

          {/* Via Collector Delivery card */}
          <Pressable
            style={({ pressed }) => [styles.card, styles.cardCollector, pressed && styles.cardPressed]}
            onPress={() => handleSelectType('rider')}
            disabled={isChecking}
            accessibilityRole="button"
            accessibilityLabel={
              pendingCount > 0
                ? `Receive stock via collector delivery, ${pendingCount} pending`
                : 'Receive stock via collector delivery'
            }
          >
            <View style={styles.cardTop}>
              <View style={[styles.cardIconWrap, styles.cardIconWrapCollector]}>
                <Icon name="truck" size={22} color={COLORS.accentPink} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Via Collector Delivery</Text>
                <Text style={styles.cardSubtitle}>A collector brought the batch to you.</Text>
                {pendingCount > 0 && (
                  <Text style={styles.cardPending}>{pendingCount} waiting for you</Text>
                )}
              </View>
              {isChecking ? (
                <ActivityIndicator size="small" color={COLORS.accentPink} />
              ) : (
                <Icon name="arrowRight" size={20} color={COLORS.accentPink} />
              )}
            </View>
          </Pressable>

          {/* Helper text */}
          <View style={styles.hintRow}>
            <Icon name="question" size={14} color={COLORS.textTertiary} />
            <Text style={styles.hintText}>
              Not sure? Check the waybill. A collector brings the stock to you; a direct release you pick up yourself.
            </Text>
          </View>
        </View>

        {/* Bottom-right illustration */}
        <Image
          source={require('../../../assets/sales_rep_assets/receive_stock_rider_illustration.png')}
          style={[styles.illustration, { bottom: Math.max(insets.bottom, SPACING.lg) }]}
          resizeMode="contain"
          pointerEvents="none"
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topBar: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: SPACING.sm,
  },
  summaryBar: {
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  summarySubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' },
  statusText: {
    color: COLORS.success,
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  // Offline look: same values as ReceiveStockSR.js's pill, the next screen in this flow.
  statusPillOffline: {
    backgroundColor: '#FBDCDC',
    borderColor: COLORS.error,
  },
  statusDotOffline: {
    backgroundColor: COLORS.error,
  },
  statusTextOffline: {
    color: '#B91C1C',
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    gap: SPACING.sm,
  },
  labelFirst: { marginTop: SPACING.sm, marginBottom: 2 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginVertical: SPACING.xs },
  orLine: { flex: 1, height: 1, backgroundColor: 'rgba(39,38,50,0.1)' },
  orText: { fontSize: TYPOGRAPHY.fontSize.sm, fontFamily: TYPOGRAPHY.fontFamily.medium, color: COLORS.textSecondary },
  cardDirect: { borderLeftWidth: 4, borderLeftColor: COLORS.primary },
  cardCollector: { borderLeftWidth: 4, borderLeftColor: COLORS.accentPink },
  cardPending: {
    marginTop: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#FFECF3',
    color: COLORS.accentPink,
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    overflow: 'hidden',
  },
  sectionHeading: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.textPrimary,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    letterSpacing: 0.2,
    marginBottom: SPACING.xs,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    padding: SPACING.md,
    gap: SPACING.md,
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  cardIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconWrapDirect: {
    backgroundColor: COLORS.primaryLight,
  },
  cardIconWrapCollector: {
    backgroundColor: '#FFECF3',
  },
  cardTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
  },
  cardSubtitle: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  cardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.dividerSubtle,
    paddingTop: SPACING.sm,
  },
  cardActionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.primary,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 5,
    backgroundColor: COLORS.accentPink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#FFFFFF',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    padding: SPACING.sm,
    borderRadius: 10,
    backgroundColor: '#F1F3F6',
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  hintText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  illustration: {
    position: 'absolute',
    right: 0,
    width: 210,
    height: 210,
    opacity: 0.95,
  },
});
