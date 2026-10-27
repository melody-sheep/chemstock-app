// src/screens/collector/CollectorDashboardScreen.js
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, ScrollView, Animated, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import useConnectionStatus from '../../hooks/useConnectionStatus';
import useCachedFocusLoader from '../../hooks/useCachedFocusLoader';
import useOnlineLabel from '../../hooks/useOnlineLabel';
import useUnreadNotificationCount from '../../hooks/useUnreadNotificationCount';
import useUnseenLogCount from '../../hooks/useUnseenLogCount';
import useOutbox from '../../hooks/useOutbox';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import Icon from '../../components/common/Icon';
import OutboxFailedNotice from '../../components/common/OutboxFailedNotice';
import StatCard from '../../components/common/StatCard';
import FocusCard from '../../components/common/FocusCard';
import ActionCard from '../../components/common/ActionCard';
import LogListItem from '../../components/common/LogListItem';
import UserAvatar from '../../components/common/UserAvatar';
import BottomNavBar, { useBottomNavBarHeight } from '../../components/common/BottomNavBar';
import SkeletonBlock from '../../components/ui/SkeletonBlock';
import { SkeletonList } from '../../components/ui/SkeletonCard';
import authService from '../../services/authService';
import deliveryService from '../../services/deliveryService';
import notificationService from '../../services/notificationService';
import HintChip from '../../components/common/HintChip';
import DashboardTour from '../../components/common/DashboardTour';
import WelcomeOverview from '../../components/common/WelcomeOverview';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { formatRelativeTime } from '../../utils/formatters';
import { formatBranchLabel } from '../../utils/branchLabel';
import { getInitials } from '../../utils/initials';

// Same layout/spec as ManagerDashboardScreen and SalesRepDashboardScreen —
// this constant intentionally matches theirs so the collapsing header
// behaves identically across all three dashboards.
const SECONDARY_HEADER_HEIGHT = 108;

// 2nd_header_collector.png is 364x408 natively, flush against the edge
// (no right margin) — matching the Manager dashboard's illustration
// treatment, not the Sales Rep dashboard's 16px-margin one.
const HEADER_ILLUSTRATION_ASPECT_RATIO = 364 / 408;
const HEADER_ILLUSTRATION_WIDTH = SECONDARY_HEADER_HEIGHT * HEADER_ILLUSTRATION_ASPECT_RATIO;

// Same branch label rule as ManagerDashboardScreen / SalesRepDashboardScreen:

const MAIN_OPERATIONS = [
  { key: 'acceptDeliveries', icon: 'truck', iconColor: COLORS.colAcceptStroke, duotoneColor: COLORS.colAcceptFill, title: 'Accept Deliveries', screen: 'CollectorAcceptDeliveries' },
  { key: 'deliveredStock', icon: 'successCircle', iconColor: COLORS.iconReleaseStroke, duotoneColor: COLORS.iconReleaseFill, title: 'Delivered Stock', screen: 'CollectorDeliveredStock' },
];

export default function CollectorDashboardScreen() {
  const navigation = useNavigation();
  const bottomNavHeight = useBottomNavBarHeight();
  const connection = useConnectionStatus();
  const onlineLabel = useOnlineLabel();
  const { pending: queuedFinishes } = useOutbox('finish_delivery_leg');

  // Same FB/IG-style collapsing header as the other dashboards — see
  // ManagerDashboardScreen for why it's JS-driven (diffClamp + transform).
  const scrollY = useRef(new Animated.Value(0)).current;
  // First-time tour of this dashboard (DashboardTour): the scroll view and the four highlighted parts.
  const tourScrollRef = useRef(null);
  const tourRefs = { focus: useRef(null), stats: useRef(null), ops: useRef(null), fab: useRef(null) };
  const [welcomeOpen, setWelcomeOpen] = useState(null);
  const clampedScrollY = useRef(
    Animated.diffClamp(scrollY, 0, SECONDARY_HEADER_HEIGHT)
  ).current;
  const secondaryHeaderTranslateY = clampedScrollY.interpolate({
    inputRange: [0, SECONDARY_HEADER_HEIGHT],
    outputRange: [0, -SECONDARY_HEADER_HEIGHT],
    extrapolate: 'clamp',
  });

  // Returns the full dashboard snapshot, saved per account and shown straight away when
  // the screen is opened again (no skeleton) — same pattern as the Manager dashboard.
  const loadDashboardData = async (previous) => {
    const currentUser = await authService.getCurrentUser();
    // A different account must never see the last account's numbers.
    const prev = previous?.user?.id === currentUser?.id ? previous : null;

    const [result, notificationsResult] = await Promise.all([
      deliveryService.getMyCollectorDeliveries(currentUser?.id),
      notificationService.getMyNotifications(currentUser?.id),
    ]);
    // A failed request keeps the last snapshot instead of blanking the cards.
    if (!result.success && prev) {
      return {
        ...prev,
        user: currentUser,
        notificationCount: notificationsResult.success ? notificationsResult.unreadCount || 0 : prev.notificationCount,
      };
    }
    const all = result.success ? result.data : [];

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
    const delivered = all.filter((d) => d.stage === 'delivered');

    return {
      user: currentUser,
      pendingCount: all.filter((d) => d.stage === 'pending_pickup').length,
      readyDeliveries: all
        .filter((d) => d.stage === 'ready_to_deliver')
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
      // total = every stop of the trip (delivered ones are no longer in transit), for the progress bar.
      activeTrips: Array.from(tripsById.values()).map((trip) => ({
        ...trip,
        total: Math.max(trip.legs.length, all.filter((d) => d.tripId === trip.tripId).length),
      })),
      logTimes: delivered.map((d) => d.deliveredAt || d.createdAt),
      recentLogs: [...delivered]
        .sort((a, b) => new Date(b.deliveredAt || b.createdAt).getTime() - new Date(a.deliveredAt || a.createdAt).getTime())
        .slice(0, 3),
      notificationCount: notificationsResult.success ? notificationsResult.unreadCount || 0 : prev?.notificationCount ?? 0,
    };
  };

  const { data: snapshot, isLoading, refresh, refreshControlAt } = useCachedFocusLoader('collector-dashboard', loadDashboardData);
  const user = snapshot?.user ?? null;
  const pendingCount = snapshot?.pendingCount ?? null;
  const activeTrips = snapshot?.activeTrips ?? [];
  // Accepted and waiting to be started (the "Ready to Deliver" list on Accept Deliveries).
  const readyDeliveries = snapshot?.readyDeliveries ?? [];
  const recentLogs = snapshot?.recentLogs ?? [];
  const unseenLogCount = useUnseenLogCount(user?.id ?? null, snapshot?.logTimes);
  const liveUnreadCount = useUnreadNotificationCount(user?.id ?? null, !!user?.id);
  const notificationCount = liveUnreadCount ?? snapshot?.notificationCount ?? 0;
  const { pendingCount: outboxCount, failed: failedItems, retryNow, discard } = useOutbox(null, user?.id ?? null);

  // A queued delivery just synced, so the server list has changed.
  const previousQueuedCount = useRef(queuedFinishes.length);
  useEffect(() => {
    if (queuedFinishes.length < previousQueuedCount.current) {
      refresh({ force: true });
    }
    previousQueuedCount.current = queuedFinishes.length;
  }, [queuedFinishes.length, refresh]);

  const collectorName = user?.full_name || user?.username || '';
  const branchName = user?.branchName || '';
  const branchLabel = formatBranchLabel(branchName);

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
      icon: 'clockCountdown',
      iconColor: COLORS.accentGold,
      accentColor: COLORS.accentGold,
      backgroundColor: '#FFFDF5',
      borderLeftColor: COLORS.accentGold,
      value: pendingCount === null ? '—' : String(pendingCount),
      label: 'Pending',
      onPress: () => navigation.navigate('CollectorAcceptDeliveries'),
    },
    {
      key: 'readyDeliveries',
      icon: 'package',
      iconColor: COLORS.success,
      accentColor: COLORS.success,
      backgroundColor: '#F4FBF7',
      borderLeftColor: COLORS.success,
      value: String(readyDeliveries.length),
      label: 'Ready',
      onPress: () => navigation.navigate('CollectorAcceptDeliveries'),
    },
    {
      key: 'activeDeliveries',
      icon: 'navigation',
      iconColor: COLORS.accentPink,
      accentColor: COLORS.accentPink,
      backgroundColor: '#FFF5F8',
      borderLeftColor: COLORS.accentPink,
      value: String(visibleActiveTrips.length),
      label: 'Active',
      onPress:
        visibleActiveTrips.length > 0
          ? () => navigation.navigate('CollectorTripReview', { tripId: visibleActiveTrips[0].tripId })
          : undefined,
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
          documentCount={unseenLogCount}
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
                  {/* A long branch line (several branches) needs the room, so the word "Status" steps aside. */}
                  {branchLabel.length <= 14 && <Text style={styles.statusText}>Status</Text>}

                  <View style={styles.statusGroup}>
                    <View style={[styles.onlineDot, !connection.online && styles.onlineDotOffline]} />
                    <Text style={[styles.statusText, !connection.online && styles.onlineTextOffline]}>
                      {onlineLabel}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.statusGroup, styles.branchGroup]}
                    onPress={() => navigation.navigate('EditProfile')}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Open profile"
                  >
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
                      <Text style={[styles.statusText, styles.branchText]} numberOfLines={1} ellipsizeMode="tail">
                        {branchLabel}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </SecondaryHeader>
          </Animated.View>

          <ScrollView
            ref={tourScrollRef}
            refreshControl={refreshControlAt(SECONDARY_HEADER_HEIGHT)}
            style={styles.content}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomNavHeight + SPACING.xl }]}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
          <HintChip id="dashboard-pull" text={"Pull down to refresh. Tap any card to open that screen."} style={{ marginBottom: SPACING.md }} />
          {outboxCount > 0 && (
            <View style={styles.pendingBanner}>
              <View style={styles.pendingIconCircle}>
                <Icon name="clock" size={14} color={COLORS.textWhite} />
              </View>
              <View style={styles.pendingTextCol}>
                <Text style={styles.pendingBannerTitle}>Pending — {outboxCount} waiting to send</Text>
                <Text style={styles.pendingBannerText}>
                  Saved on this device. Sends automatically once you're back online.
                </Text>
              </View>
              <Pressable onPress={retryNow} style={styles.pendingRetryButton}>
                <Text style={styles.pendingRetryText}>Retry</Text>
              </Pressable>
            </View>
          )}

          <OutboxFailedNotice failed={failedItems} agentId={user?.id} onRetry={retryNow} onDiscard={discard} />

          <View ref={tourRefs.focus} collapsable={false}>
          {isLoading ? (
            <SkeletonBlock width="100%" height={38} borderRadius={12} style={{ marginBottom: SPACING.lg }} />
          ) : (
            <FocusCard
              title="Needs attention"
              storageKey="collector-needs-attention"
              icon="notification"
              emptyText="All caught up. Nothing is waiting for you."
              rows={[
                pendingCount > 0 && {
                  key: 'pickups', icon: 'clockCountdown', tone: 'warn', label: 'Pending pickups',
                  value: String(pendingCount), onPress: () => navigation.navigate('CollectorAcceptDeliveries'),
                },
                readyDeliveries.length > 0 && {
                  key: 'ready', icon: 'truck', tone: 'warn', label: 'Ready to deliver',
                  value: `${readyDeliveries.length} deliver${readyDeliveries.length === 1 ? 'y' : 'ies'}`,
                  onPress: () => navigation.navigate('CollectorAcceptDeliveries'),
                },
                visibleActiveTrips.length > 0 && {
                  key: 'trips', icon: 'truck', tone: 'warn',
                  label: visibleActiveTrips.length === 1 ? 'Delivery in progress' : 'Deliveries in progress',
                  value: `${visibleActiveTrips.reduce((sum, trip) => sum + trip.legs.length, 0)} stop${visibleActiveTrips.reduce((sum, trip) => sum + trip.legs.length, 0) === 1 ? '' : 's'} left`,
                  onPress: () => navigation.navigate('CollectorTripReview', { tripId: visibleActiveTrips[0].tripId }),
                },
                outboxCount > 0 && {
                  key: 'queued', icon: 'clock', tone: 'info', label: 'Waiting to send', value: String(outboxCount),
                },
              ]}
            />
          )}
          </View>

          <Text style={styles.sectionTitle}>Quick Stats</Text>
          {isLoading ? (
            <View style={styles.statsRow}>
              <SkeletonBlock width="48%" height={84} borderRadius={12} />
              <SkeletonBlock width="48%" height={84} borderRadius={12} />
            </View>
          ) : (
            <View ref={tourRefs.stats} collapsable={false} style={styles.statsRow}>
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
                    iconSize={26}
                    style={styles.statCardCompact}
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

          {readyDeliveries.length > 0 && (
            <>
              <View style={styles.logsTitleRow}>
                <Text style={[styles.sectionTitle, styles.logsTitle]}>Ready to deliver</Text>
                <TouchableOpacity onPress={() => navigation.navigate('CollectorAcceptDeliveries')} accessibilityRole="button" hitSlop={8}>
                  <Text style={styles.seeAll}>See all ›</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.activeList}>
                {readyDeliveries.slice(0, 3).map((delivery) => {
                  const units = (delivery.items || []).reduce((sum, item) => sum + item.quantity, 0);
                  const count = (delivery.items || []).length;
                  return (
                    <TouchableOpacity
                      key={delivery.transactionId}
                      style={styles.readyCard}
                      onPress={() => navigation.navigate('CollectorTripReview', { transactionIds: [delivery.transactionId] })}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                    >
                      <UserAvatar
                        photoUrl={delivery.targetRecipientPhotoUrl}
                        fallbackText={getInitials(delivery.targetRecipientName)}
                        size={40}
                        backgroundColor="#F1F3F6"
                        fallbackTextColor={COLORS.primary}
                      />
                      <View style={styles.readyTextCol}>
                        <Text style={styles.readyName} numberOfLines={1}>{delivery.targetRecipientName || 'Sales Rep'}</Text>
                        <Text style={styles.readyMeta} numberOfLines={1}>
                          {count} item{count === 1 ? '' : 's'} · {units} unit{units === 1 ? '' : 's'} · {formatRelativeTime(delivery.createdAt)}
                        </Text>
                      </View>
                      <View style={styles.readyStart}>
                        <Text style={styles.readyStartText}>Start</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
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
                        {Math.max(0, (trip.total || trip.legs.length) - trip.legs.length)} of {trip.total || trip.legs.length} delivered · Next: {trip.legs[0]?.targetRecipientName || 'Sales Rep'}
                      </Text>
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${Math.round((Math.max(0, (trip.total || trip.legs.length) - trip.legs.length) / (trip.total || trip.legs.length)) * 100)}%` },
                          ]}
                        />
                      </View>
                    </View>
                    <Icon name="arrowRight" size={16} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <Text style={styles.sectionTitle}>Main Operations</Text>
          <View ref={tourRefs.ops} collapsable={false} style={styles.operationsGrid}>
            {MAIN_OPERATIONS.map((operation) => (
              <ActionCard
                key={operation.key}
                icon={operation.icon}
                iconColor={operation.iconColor}
                duotoneColor={operation.duotoneColor}
                title={operation.title}
                onPress={() => navigation.navigate(operation.screen)}
                style={styles.operationCard}
                layout="tile"
              />
            ))}
          </View>

          <View style={styles.logsTitleRow}>
            <Text style={[styles.sectionTitle, styles.logsTitle]}>Recent Logs</Text>
            <TouchableOpacity onPress={() => navigation.navigate('CollectorDeliveredStock')} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.seeAll}>See all ›</Text>
            </TouchableOpacity>
          </View>
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
                    onPress={() => navigation.navigate('CollectorDeliveredStock', { focusId: log.transactionId })}
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
          fabRef={tourRefs.fab}
          activeTab="dashboard"
          onTabPress={handleTabPress}
          onFabPress={handleFabPress}
          hiddenKeys={['stock', 'reports']}
          fabIcon="truck"
          fabBadgeCount={(pendingCount || 0) + readyDeliveries.length}
          fabLabel="Deliver"
        />
      </View>
      <DashboardTour role="collector" refs={tourRefs} scrollRef={tourScrollRef} enabled={!isLoading && !!user && welcomeOpen === false} />
      <WelcomeOverview role="collector" userId={user?.id} name={user?.full_name || user?.username} onSettled={setWelcomeOpen} />
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
    width: '82%',
  },
  branchGroup: {
    flexShrink: 1,
  },
  branchText: {
    flexShrink: 1,
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
    marginBottom: SPACING.lg,
  },
  statCardCompact: { paddingVertical: SPACING.md + 4, paddingHorizontal: SPACING.sm },
  readyCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.sm + 2, borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 12, backgroundColor: '#FFFFFF' },
  readyTextCol: { flex: 1 },
  readyName: { fontSize: TYPOGRAPHY.fontSize.sm, color: '#272632', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  readyMeta: { marginTop: 2, fontSize: 12, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.regular },
  readyStart: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: COLORS.primary },
  readyStartText: { fontSize: 12, color: '#FFFFFF', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  statTouchable: {
    flex: 1,
  },
  activeList: {
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
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
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: '#E8ECF2', marginTop: 8, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: COLORS.success },
  activeMeta: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  operationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: SPACING.lg,
  },
  operationCard: {
    width: '48.5%',
    minHeight: 88,
  },
  logsTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  logsTitle: { marginBottom: 0 },
  seeAll: { fontSize: TYPOGRAPHY.fontSize.sm, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: TYPOGRAPHY.fontWeight.bold, color: '#0085F9' },
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
