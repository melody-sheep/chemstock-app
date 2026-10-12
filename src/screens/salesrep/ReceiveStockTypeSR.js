// src/screens/salesrep/ReceiveStockTypeSR.js
import React, { useState, useCallback } from 'react';
import { View, Text, Image, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
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
          if (active) setPendingCount(0);
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const handleBack = () => navigation.goBack();

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
      Alert.alert(
        'Unable to Check',
        error.message || 'Could not load your pending deliveries. Please try again.'
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
        <View style={[styles.topBar, { height: 56 + insets.top, paddingTop: insets.top }]}>
          <Pressable onPress={handleBack} style={styles.iconButton} accessibilityLabel="Go back">
            <Icon name="arrowLeft" size={20} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.topBarTitle}>Sales Rep Dashboard</Text>
          <View style={styles.iconButton}>
            <Icon name="document" size={20} color="#FFFFFF" weight="fill" />
          </View>
        </View>

        {/* Secondary summary bar */}
        <View style={styles.summaryBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryTitle}>Receive Stock</Text>
            <Text style={styles.summarySubtitle}>Handoff Verification</Text>
          </View>
          <LiveStatusPill
            pillStyle={styles.statusPill}
            dotStyle={styles.statusDot}
            textStyle={styles.statusText}
            offlinePillStyle={styles.statusPillOffline}
            offlineDotStyle={styles.statusDotOffline}
            offlineTextStyle={styles.statusTextOffline}
          />
        </View>

        {/* Main content */}
        <View style={styles.content}>
          <Text style={styles.sectionHeading}>Select Handover Type</Text>

          {/* Direct From Manager card */}
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
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
                <Text style={styles.cardSubtitle}>Pick up directly from the main branch.</Text>
              </View>
            </View>
            <View style={styles.cardAction}>
              <Text style={styles.cardActionText}>Continue</Text>
              <Icon name="arrowRight" size={18} color={COLORS.primary} />
            </View>
          </Pressable>

          {/* Via Collector Delivery card */}
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
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
                <Text style={styles.cardSubtitle}>
                  A rider brought the batch to your zone.
                </Text>
              </View>
              {pendingCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.cardAction}>
              <Text style={[styles.cardActionText, { color: COLORS.accentPink }]}>
                {isChecking ? 'Checking…' : 'View pending'}
              </Text>
              {isChecking ? (
                <ActivityIndicator size="small" color={COLORS.accentPink} />
              ) : (
                <Icon name="arrowRight" size={18} color={COLORS.accentPink} />
              )}
            </View>
          </Pressable>

          {/* Helper text */}
          <View style={styles.hintRow}>
            <Icon name="question" size={14} color={COLORS.textTertiary} />
            <Text style={styles.hintText}>
              Not sure which one? Check the waybill — a collector brings the stock to you, a direct
              release you pick up from the branch.
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
    fontSize: TYPOGRAPHY.fontSize.xl,
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  summarySubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAFBF2',
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#A7E8C4',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#1E7A3A',
    marginRight: 5,
  },
  statusText: {
    color: '#1E7A3A',
    fontSize: 10,
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
    paddingTop: SPACING.lg,
    gap: SPACING.md,
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
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
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
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
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
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#FFFFFF',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.xs,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  hintText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textTertiary,
    lineHeight: 16,
  },
  illustration: {
    position: 'absolute',
    right: 0,
    width: 160,
    height: 160,
    opacity: 0.9,
  },
});
