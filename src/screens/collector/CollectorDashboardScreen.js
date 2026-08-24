// src/screens/collector/CollectorDashboardScreen.js
import React, { useState, useCallback, useRef } from 'react';
import { View, Text, Image, ScrollView, Animated, Alert, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import Icon from '../../components/common/Icon';
import StatCard from '../../components/common/StatCard';
import ActionCard from '../../components/common/ActionCard';
import BottomNavBar from '../../components/common/BottomNavBar';
import SkeletonBlock from '../../components/ui/SkeletonBlock';
import authService from '../../services/authService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

// Same layout/spec as ManagerDashboardScreen and SalesRepDashboardScreen —
// this constant intentionally matches theirs so the collapsing header
// behaves identically across all three dashboards.
const SECONDARY_HEADER_HEIGHT = 100;

// 2nd_header_collector.png is 364x408 natively, flush against the edge
// (no right margin) — matching the Manager dashboard's illustration
// treatment, not the Sales Rep dashboard's 16px-margin one.
const HEADER_ILLUSTRATION_ASPECT_RATIO = 364 / 408;
const HEADER_ILLUSTRATION_WIDTH = SECONDARY_HEADER_HEIGHT * HEADER_ILLUSTRATION_ASPECT_RATIO;

const QUICK_STATS = [
  {
    key: 'pendingDelivery',
    icon: 'truck',
    iconColor: COLORS.accentGold,
    accentColor: COLORS.accentGold,
    backgroundColor: '#FFFDF5',
    borderLeftColor: COLORS.accentGold,
    value: '2',
    label: 'Pending Delivery',
  },
  {
    key: 'activeDeliveries',
    icon: 'truck',
    iconColor: COLORS.accentPink,
    accentColor: COLORS.accentPink,
    backgroundColor: '#FFF5F8',
    borderLeftColor: COLORS.accentPink,
    value: '2 Active',
    label: 'Deliveries',
  },
];

const MAIN_OPERATIONS = [
  { key: 'acceptDeliveries', icon: 'truck', iconColor: COLORS.colAcceptStroke, duotoneColor: COLORS.colAcceptFill, title: 'Accept Deliveries', screen: null },
  { key: 'deliveredStock', icon: 'successCircle', iconColor: COLORS.iconReleaseStroke, duotoneColor: COLORS.iconReleaseFill, title: 'Delivered Stock', screen: null },
];

export default function CollectorDashboardScreen() {
  const [user, setUser] = useState(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

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

  useFocusEffect(
    useCallback(() => {
      setIsLoadingUser(true);
      authService.getCurrentUser().then((currentUser) => {
        setUser(currentUser);
        setIsLoadingUser(false);
      });
    }, [])
  );

  const collectorName = user?.full_name || user?.username || '';
  const branchName = user?.branchName || '';

  const handleTabPress = (key) => {
    setActiveTab(key);
    if (key !== 'dashboard') {
      Alert.alert('Coming Soon', `${key.charAt(0).toUpperCase()}${key.slice(1)} isn't built yet.`);
    }
  };

  const handleFabPress = () => {
    Alert.alert('Coming Soon', 'Delivery actions are coming soon.');
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
                {isLoadingUser ? (
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
                    {isLoadingUser ? (
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
          <View style={styles.statsRow}>
            {QUICK_STATS.map((stat) => (
              <View key={stat.key} style={styles.statTouchable}>
                <StatCard
                  icon={stat.icon}
                  iconColor={stat.iconColor}
                  accentColor={stat.accentColor}
                  backgroundColor={stat.backgroundColor}
                  borderLeftColor={stat.borderLeftColor}
                  value={stat.value}
                  label={stat.label}
                />
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Main Operations</Text>
          <View style={styles.operationsGrid}>
            {MAIN_OPERATIONS.map((operation) => (
              <ActionCard
                key={operation.key}
                icon={operation.icon}
                iconColor={operation.iconColor}
                duotoneColor={operation.duotoneColor}
                title={operation.title}
                style={styles.operationCard}
              />
            ))}
          </View>

          <Text style={styles.sectionTitle}>Recent Logs</Text>
          <View style={styles.emptyLogs}>
            <Image
              source={require('../../../assets/image/empty_box1.png')}
              style={styles.emptyLogsImage}
              resizeMode="contain"
            />
            <Text style={styles.emptyLogsText}>No recent activity yet.</Text>
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
