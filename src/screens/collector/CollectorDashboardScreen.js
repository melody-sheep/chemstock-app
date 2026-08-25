// src/screens/collector/CollectorDashboardScreen.js
import React, { useState, useCallback, useRef } from 'react';
import { View, Text, Image, ScrollView, Animated, Alert, TouchableOpacity, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
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
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { formatRelativeTime } from '../../utils/formatters';

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
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [pendingCount, setPendingCount] = useState(null);
  const [activeTrips, setActiveTrips] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
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

    const result = await deliveryService.getMyCollectorDeliveries(currentUser?.id);
    const all = result.success ? result.data : [];

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

  const collectorName = user?.full_name || user?.username || '';
  const branchName = user?.branchName || '';

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
      value: `${activeTrips.length} Active`,
      label: 'Deliveries',
    },
  ];

  const handleTabPress = (key) => {
    setActiveTab(key);
    if (key !== 'dashboard') {
      Alert.alert('Coming Soon', `${key.charAt(0).toUpperCase()}${key.slice(1)} isn't built yet.`);
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
          title="Collector Dashboard"
          showDocumentIcon={true}
          onDocumentPress={() => navigation.navigate('CollectorDeliveredStock')}
          showNotificationIcon={true}
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
                    <View style={styles.onlineDot} />
                    <Text style={styles.statusText}>Online</Text>
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

          {activeTrips.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Active</Text>
              <View style={styles.activeList}>
                {activeTrips.map((trip) => (
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
            ) : recentLogs.length > 0 ? (
              recentLogs.map((log) => (
                <LogListItem
                  key={log.transactionId}
                  icon="checkCircle"
                  iconColor={COLORS.success}
                  text={`Delivered to ${log.targetRecipientName || 'Sales Rep'} — ${formatRelativeTime(log.deliveredAt || log.createdAt)}`}
                  onPress={() => navigation.navigate('CollectorDeliveredStock')}
                />
              ))
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
          activeTab={activeTab}
          onTabPress={handleTabPress}
          onFabPress={handleFabPress}
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
  statusText: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: '#555353',
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
