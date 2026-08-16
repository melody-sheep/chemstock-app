// src/screens/manager/ManagerDashboardScreen.js
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Animated, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import Icon from '../../components/common/Icon';
import StatCard from '../../components/common/StatCard';
import ActionCard from '../../components/common/ActionCard';
import LogListItem from '../../components/common/LogListItem';
import BottomNavBar from '../../components/common/BottomNavBar';
import authService from '../../services/authService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const SECONDARY_HEADER_HEIGHT = 100;

// 2nd_header_scan_img.png is 344x400 natively; deriving the width from the
// header height (instead of hardcoding it) keeps the image flush against
// the right edge if SECONDARY_HEADER_HEIGHT ever changes.
const HEADER_ILLUSTRATION_ASPECT_RATIO = 344 / 400;
const HEADER_ILLUSTRATION_WIDTH = SECONDARY_HEADER_HEIGHT * HEADER_ILLUSTRATION_ASPECT_RATIO;

const QUICK_STATS = [
  {
    key: 'totalItems',
    icon: 'boxPackage',
    iconColor: COLORS.accentGold,
    accentColor: COLORS.accentGold,
    backgroundColor: '#FFFDF5',
    borderLeftColor: COLORS.accentGold,
    value: '1,240',
    label: 'Total Items',
  },
  {
    key: 'pendingRequest',
    icon: 'peopleGroup',
    iconColor: COLORS.accentPink,
    strokeWidth: 0.6,
    accentColor: COLORS.accentPink,
    backgroundColor: '#FFF5F8',
    borderLeftColor: COLORS.accentPink,
    value: '3',
    label: 'Request',
  },
];

const MAIN_OPERATIONS = [
  { key: 'receiveStock', icon: 'packageHex', iconColor: COLORS.primary, duotoneColor: COLORS.iconReceiveFill, title: 'Receive Stock', screen: 'ReceiveStock' },
  { key: 'releaseStock', icon: 'successCircle', iconColor: COLORS.iconReleaseStroke, duotoneColor: COLORS.iconReleaseFill, title: 'Release Stock', screen: null },
  { key: 'manageReturns', icon: 'returnBox', iconColor: COLORS.iconReturnStroke, duotoneColor: COLORS.iconReturnFill, title: 'Manage Returns', screen: null },
  { key: 'alerts', icon: 'alertTriangle', iconColor: COLORS.iconAlertStroke, duotoneColor: COLORS.iconAlertFill, title: 'Alerts / Discrepancies', screen: null },
  { key: 'trackDeliveries', icon: 'compassTarget', iconColor: COLORS.iconTrackStroke, duotoneColor: COLORS.iconTrackFill, title: 'Track Deliveries', screen: null },
  { key: 'agentAccounts', icon: 'agentsGroup', iconColor: COLORS.iconAgentStroke, duotoneColor: COLORS.iconAgentFill, title: 'Manage Accounts', screen: 'ManageAccounts' },
];

const RECENT_LOGS = [
  { key: 'log1', icon: 'trayDown', iconColor: COLORS.secondary, text: 'Received 100x Liniment from Factory' },
  { key: 'log2', icon: 'trayUp', iconColor: COLORS.success, text: 'Released 20x Product to Maria' },
];

export default function ManagerDashboardScreen() {
  const navigation = useNavigation();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  // FB/IG-style collapsing header: diffClamp tracks the running scroll delta
  // clamped to [0, header height], so the header slides in lockstep with the
  // finger instead of snapping on a threshold. interpolate() maps that to a
  // translateY on an absolutely-positioned header (not a layout-affecting
  // height), so even JS-driven (useNativeDriver:false) this never touches
  // Yoga layout — only a transform repaint, which is cheap and jank-free.
  // (Native-driven caused a native animated-node-graph crash on this RN
  // version — see debugging notes; JS-driven sidesteps it entirely.)
  const scrollY = useRef(new Animated.Value(0)).current;
  const clampedScrollY = useRef(
    Animated.diffClamp(scrollY, 0, SECONDARY_HEADER_HEIGHT)
  ).current;
  const secondaryHeaderTranslateY = clampedScrollY.interpolate({
    inputRange: [0, SECONDARY_HEADER_HEIGHT],
    outputRange: [0, -SECONDARY_HEADER_HEIGHT],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    authService.getCurrentUser().then(setUser);
  }, []);

  const managerName = user?.full_name || user?.username || '';
  const branchName = user?.branchName || '';

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
          title="Manager Dashboard"
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
              illustration={require('../../../assets/manager_assets/2nd_header_scan_img.png')}
              illustrationWidth={HEADER_ILLUSTRATION_WIDTH}
            >
              <View style={styles.secondaryContent}>
                <Text style={styles.welcomeText} numberOfLines={1}>
                  Welcome, <Text style={styles.welcomeName}>{managerName}</Text>!
                </Text>

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
                    <Text style={styles.statusText}>{branchName}</Text>
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
              <StatCard
                key={stat.key}
                icon={stat.icon}
                iconColor={stat.iconColor}
                strokeWidth={stat.strokeWidth}
                accentColor={stat.accentColor}
                backgroundColor={stat.backgroundColor}
                borderLeftColor={stat.borderLeftColor}
                value={stat.value}
                label={stat.label}
              />
            ))}
          </View>

          <Text style={styles.sectionTitle}>Main Operation</Text>
          <View style={styles.operationsGrid}>
            {MAIN_OPERATIONS.map((operation) => (
              <ActionCard
                key={operation.key}
                icon={operation.icon}
                iconColor={operation.iconColor}
                duotoneColor={operation.duotoneColor}
                title={operation.title}
                onPress={operation.screen ? () => navigation.navigate(operation.screen) : undefined}
                style={styles.operationCard}
              />
            ))}
          </View>

          <Text style={styles.sectionTitle}>Recent Logs</Text>
          <View style={styles.logsList}>
            {RECENT_LOGS.map((log) => (
              <LogListItem
                key={log.key}
                icon={log.icon}
                iconColor={log.iconColor}
                text={log.text}
              />
            ))}
          </View>
          </ScrollView>
        </View>

        <BottomNavBar activeTab={activeTab} onTabPress={setActiveTab} />
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
});
