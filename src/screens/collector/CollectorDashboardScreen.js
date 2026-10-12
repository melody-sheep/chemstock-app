// src/screens/collector/CollectorDashboardScreen.js
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Image, ScrollView, Animated, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import useConnectionStatus from '../../hooks/useConnectionStatus';
import useOutbox from '../../hooks/useOutbox';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import Icon from '../../components/common/Icon';
import StatCard from '../../components/common/StatCard';
import ActionCard from '../../components/common/ActionCard';
import LogListItem from '../../components/common/LogListItem';
import BottomNavBar from '../../components/common/BottomNavBar';
import SkeletonBlock from '../../components/ui/SkeletonBlock';
import { SkeletonList } from '../../components/ui/SkeletonCard';
import authService from '../../services/authService';
import deliveryService from '../../services/deliveryService';
import notificationService from '../../services/notificationService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { formatRelativeTime, formatClockTime } from '../../utils/formatters';

// Same layout/spec as ManagerDashboardScreen and SalesRepDashboardScreen —
// this constant intentionally matches theirs so the collapsing header
// behaves identically across all three dashboards.
const SECONDARY_HEADER_HEIGHT = 100;

// 2nd_header_collector.png is 364x408 natively, flush against the edge
// (no right margin) — matching the Manager dashboard's illustration
// treatment, not the Sales Rep dashboard's 16px-margin one.
const HEADER_ILLUSTRATION_ASPECT_RATIO = 364 / 408;
const HEADER_ILLUSTRATION_WIDTH = SECONDARY_HEADER_HEIGHT * HEADER_ILLUSTRATION_ASPECT_RATIO;

const MAIN_OPERATIONS = [
  { key: 'acceptDeliveries', icon: 'truck', iconColor: COLORS.colAcceptStroke, duotoneColor: COLORS.colAcceptFill, title: 'Accept Deliveries', screen: 'CollectorAcceptDeliveries' },
  { key: 'deliveredStock', icon: 'successCircle', iconColor: COLORS.iconReleaseStroke, duotoneColor: COLORS.iconReleaseFill, title: 'Delivered Stock', screen: 'CollectorDeliveredStock' },
];

export default function CollectorDashboardScreen() {
  const navigation = useNavigation();
  const connection = useConnectionStatus();
  const { pendingCount: outboxCount, retryNow } = useOutbox();
  const { pending: queuedFinishes } = useOutbox('finish_delivery_leg');
  const [user, setUser] = useState(null);
  const [pendingCount, setPendingCount] = useState(null);
  const [activeTrips, setActiveTrips] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Same FB/IG-style collapsing header as the other dashboards — see
  // ManagerDashboardScreen for why it's JS-driven (diffClamp + transform).
  const scrollY = useRef(new Animated.Value(0)).current;
  const clampedScrollY = useRef(
    Animated.diffClamp(scrollY, 0, SECONDARY_HEADER_HEIGHT)
  ).current;
  const secondaryHeaderTranslateY = clampedScrollY.interpolate({
    inputRange: [0, SECONDARY_HEADER_HEIGHT],
    outputRange: [0, -SECONDARY_HEADER_HEIGHT],
    extrapolate: 'clamp',
  });

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);

    const currentUser = await authService.getCurrentUser();
    setUser(currentUser);

    const [result, notificationsResult] = await Promise.all([
      deliveryService.getMyCollectorDeliveries(currentUser?.id),
      notificationService.getMyNotifications(currentUser?.id),
    ]);
    const all = result.success ? result.data : [];
    if (notificationsResult.success) {
      setNotificationCount(notificationsResult.unreadCount || 0);
    }

    setPendingCount(all.filter((d) => d.stage === 'pending_pickup').length);

    // One row per distinct active trip, not per leg — a batch trip with 2
    // undelivered legs should show once on the dashboard.
    const inTransit = all.filter((d) => d.stage === 'in_transit');
    const tripsById = new Map();
    inTransit.forEach((leg) => {
      if (!tripsById.has(leg.tripId)) {
        tripsById.set(leg.tripId, { tripId: leg.tripId, legs: [leg] });
      } else {
        tripsById.get(leg.tripId).legs.push(leg);
      }
    });
    setActiveTrips(Array.from(tripsById.values()));

    setRecentLogs(
      all
        .filter((d) => d.stage === 'delivered')
        .sort((a, b) => new Date(b.deliveredAt || b.createdAt).getTime() - new Date(a.deliveredAt || a.createdAt).getTime())
        .slice(0, 3)
    );

    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [loadDashboardData])
  );

  // A queued delivery just synced, so the server list has changed.
  const previousQueuedCount = useRef(queuedFinishes.length);
  useEffect(() => {
    if (queuedFinishes.length < previousQueuedCount.current) {
      loadDashboardData();
    }
    previousQueuedCount.current = queuedFinishes.length;
  }, [queuedFinishes.length, loadDashboardData]);

  const collectorName = user?.full_name || user?.username || '';
  const branchName = user?.branchName || '';

  // A stop marked delivered while offline is still "in transit" on the
  // server until the outbox syncs. Hide it from Active so it can't be marked
  // a second time, and list it under Recent Logs as waiting instead.
  const queuedTransactionIds = new Set(queuedFinishes.map((entry) => entry.payload?.transactionId));
  const visibleActiveTrips = activeTrips
    .map((trip) => ({ ...trip, legs: trip.legs.filter((leg) => !queuedTransactionIds.has(leg.transactionId)) }))
    .filter((trip) => trip.legs.length > 0);

  const displayedStats = [
    {
      key: 'pendingDelivery',
      icon: 'truck',
      iconColor: COLORS.accentGold,
      accentColor: COLORS.accentGold,
      backgroundColor: '#FFFDF5',
      borderLeftColor: COLORS.accentGold,
      value: pendingCount === null ? '—' : String(pendingCount),
      label: 'Pending Delivery',
      onPress: () => navigation.navigate('CollectorAcceptDeliveries'),
    },
    {
      key: 'activeDeliveries',
      icon: 'truck',
      iconColor: COLORS.accentPink,
      accentColor: COLORS.accentPink,
      backgroundColor: '#FFF5F8',
      borderLeftColor: COLORS.accentPink,
      value: `${visibleActiveTrips.length} Active`,
      label: 'Deliveries',
    },
  ];

  const handleTabPress = (key) => {
    if (key === 'settings') {
      navigation.navigate('CollectorSettings');
    } else if (key !== 'dashboard') {
      navigation.navigate('ComingSoon', { tabKey: key, role: 'collector' });
    }
  };

  const handleFabPress = () => {
    navigation.navigate('CollectorAcceptDeliveries');
  };

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false }
  );

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showProfileIcon={true}
          onProfilePress={() => navigation.navigate('CollectorSettings')}
          profilePhotoUrl={user?.profilePhotoUrl}
          title="Collector Dashboard"
          showDocumentIcon={true}
          onDocumentPress={() => navigation.navigate('CollectorDeliveredStock')}
          showNotificationIcon={true}
          onNotificationPress={() => navigation.navigate('Notifications')}
          notificationCount={notificationCount}
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
        />

        <View style={styles.body}>
          <Animated.View
            style={[
              styles.secondaryHeaderWrapper,
              { transform: [{ translateY: secondaryHeaderTranslateY }] },
            ]}
          >
            <SecondaryHeader
              height={SECONDARY_HEADER_HEIGHT}
              illustration={require('../../../assets/collector_assets/2nd_header_collector.png')}
              illustrationWidth={HEADER_ILLUSTRATION_WIDTH}
            >
              <View style={styles.secondaryContent}>
                {isLoading ? (
                  <SkeletonBlock width={180} height={25} borderRadius={4} />
                ) : (
                  <Text style={styles.welcomeText} numberOfLines={1}>
                    Welcome, <Text style={styles.welcomeName}>{collectorName}</Text>!
                  </Text>
                )}

                <View style={styles.statusRow}>
                  <Text style={styles.statusText}>Status</Text>

                  <View style={styles.statusGroup}>
                    <View style={[styles.onlineDot, !connection.online && styles.onlineDotOffline]} />
                    <Text style={[styles.statusText, !connection.online && styles.onlineTextOffline]}>
                      {connection.online ? 'Online' : `Offline · ${formatClockTime(connection.lastOnlineAt)}`}
                    </Text>
                  </View>

                  <View style={styles.statusGroup}>
                    <Icon
                      name="location"
                      size={16}
                      color="#FF0000"
                      weight="duotone"
                      duotoneColor="#FCB8B8"
                      duotoneOpacity={1}
                    />
                    {isLoading ? (
                      <SkeletonBlock width={90} height={14} borderRadius={4} />
                    ) : (
                      <Text style={styles.statusText}>{branchName}</Text>
                    )}
                  </View>
                </View>
              </View>
            </SecondaryHeader>
          </Animated.View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
          {outboxCount > 0 && (
            <View style={styles.pendingBanner}>
              <View style={styles.pendingIconCircle}>
                <Icon name="clock" size={14} color={COLORS.textWhite} />
              </View>
              <View style={styles.pendingTextCol}>
                <Text style={styles.pendingBannerTitle}>Pending — {outboxCount} waiting to sync</Text>
                <Text style={styles.pendingBannerText}>
                  Saved on this device. Sends automatically once you're back online.
                </Text>
              </View>
              <Pressable onPress={retryNow} style={styles.pendingRetryButton}>
                <Text style={styles.pendingRetryText}>Retry</Text>
              </Pressable>
            </View>
          )}

          <Text style={styles.sectionTitle}>Quick Stats</Text>
          {isLoading ? (
            <View style={styles.statsRow}>
              <SkeletonBlock width="48%" height={84} borderRadius={12} />
              <SkeletonBlock width="48%" height={84} borderRadius={12} />
            </View>
          ) : (
            <View style={styles.statsRow}>
              {displayedStats.map((stat) => {
                const card = (
                  <StatCard
                    icon={stat.icon}
                    iconColor={stat.iconColor}
                    accentColor={stat.accentColor}
                    backgroundColor={stat.backgroundColor}
                    borderLeftColor={stat.borderLeftColor}
                    value={stat.value}
                    label={stat.label}
                  />
                );
                if (stat.onPress) {
                  return (
                    <TouchableOpacity key={stat.key} style={styles.statTouchable} onPress={stat.onPress} activeOpacity={0.7}>
                      {card}
                    </TouchableOpacity>
                  );
                }
                return <View key={stat.key} style={styles.statTouchable}>{card}</View>;
              })}
            </View>
          )}

          {visibleActiveTrips.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Active</Text>
              <View style={styles.activeList}>
                {visibleActiveTrips.map((trip) => (
                  <TouchableOpacity
                    key={trip.tripId}
                    style={styles.activeCard}
                    onPress={() => navigation.navigate('CollectorTripReview', { tripId: trip.tripId })}
                    activeOpacity={0.7}
                  >
                    <View style={styles.activeIconBadge}>
                      <Icon name="truck" size={18} color={COLORS.primary} />
                    </View>
                    <View style={styles.activeTextCol}>
                      <Text style={styles.activeTitle} numberOfLines={1}>
                        {trip.legs.map((leg) => leg.targetRecipientName || 'Sales Rep').join(', ')}
                      </Text>
                      <Text style={styles.activeMeta}>
                        {trip.legs.length} stop{trip.legs.length === 1 ? '' : 's'} · In Transit
                      </Text>
                    </View>
                    <Icon name="arrowRight" size={16} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <Text style={styles.sectionTitle}>Main Operations</Text>
          <View style={styles.operationsGrid}>
            {MAIN_OPERATIONS.map((operation) => (
              <ActionCard
                key={operation.key}
                icon={operation.icon}
                iconColor={operation.iconColor}
                duotoneColor={operation.duotoneColor}
                title={operation.title}
                onPress={() => navigation.navigate(operation.screen)}
                style={styles.operationCard}
              />
            ))}
          </View>

          <Text style={styles.sectionTitle}>Recent Logs</Text>
          <View style={styles.logsList}>
            {isLoading ? (
              <SkeletonList count={3} lines={1} thumbSize={36} />
            ) : queuedFinishes.length > 0 || recentLogs.length > 0 ? (
              <>
                {queuedFinishes.map((entry) => (
                  <LogListItem
                    key={entry.id}
                    icon="clock"
                    iconColor={COLORS.warning}
                    text={`${entry.payload?.label || 'Delivery'} — waiting for network`}
                    onPress={() => navigation.navigate('CollectorDeliveredStock')}
                  />
                ))}
                {recentLogs.map((log) => (
                  <LogListItem
                    key={log.transactionId}
                    icon="checkCircle"
                    iconColor={COLORS.success}
                    text={`Delivered to ${log.targetRecipientName || 'Sales Rep'} — ${formatRelativeTime(log.deliveredAt || log.createdAt)}`}
                    onPress={() => navigation.navigate('CollectorDeliveredStock')}
                  />
                ))}
              </>
            ) : (
              <View style={styles.emptyLogs}>
                <Image
                  source={require('../../../assets/image/empty_box1.png')}
                  style={styles.emptyLogsImage}
                  resizeMode="contain"
                />
                <Text style={styles.emptyLogsText}>No recent activity yet.</Text>
              </View>
            )}
          </View>
          </ScrollView>
        </View>

        <BottomNavBar
          activeTab="dashboard"
          onTabPress={handleTabPress}
          onFabPress={handleFabPress}
          hiddenKeys={['stock', 'reports']}
          fabIcon="truck"
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  body: {
    flex: 1,
    position: 'relative',
  },
  secondaryHeaderWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 10,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SECONDARY_HEADER_HEIGHT + SPACING.md,
    paddingBottom: 96,
  },
  secondaryContent: {
    paddingHorizontal: SPACING.md,
  },
  welcomeText: {
    fontSize: 25,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    letterSpacing: -0.75,
    color: '#272632',
  },
  welcomeName: {
    color: '#03045E',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: SPACING.sm,
  },
  statusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#B7FFD6',
    borderWidth: 2,
    borderColor: '#00FF6E',
  },
  onlineDotOffline: {
    backgroundColor: '#FFE6AD',
    borderColor: COLORS.warning,
  },
  statusText: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: '#555353',
  },
  onlineTextOffline: { color: COLORS.warning },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF1D6',
    borderWidth: 1,
    borderColor: COLORS.accentGold,
    borderRadius: 8,
    padding: 12,
    marginBottom: SPACING.md,
  },
  pendingIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#B26400',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingTextCol: { flex: 1 },
  pendingBannerTitle: {
    fontSize: 13,
    color: '#7A4A00',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
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
    color: COLORS.textWhite,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
    marginBottom: SPACING.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  statTouchable: {
    flex: 1,
  },
  activeList: {
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  activeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    padding: SPACING.sm,
  },
  activeIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.iconTrackFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTextCol: { flex: 1 },
  activeTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  activeMeta: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  operationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: SPACING.xl,
  },
  operationCard: {
    width: '48%',
    minHeight: 72,
  },
  logsList: {
    gap: SPACING.sm,
  },
  emptyLogs: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    gap: SPACING.xs,
  },
  emptyLogsImage: {
    width: 90,
    height: 90,
  },
  emptyLogsText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
});
