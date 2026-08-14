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
const SCROLL_DIRECTION_THRESHOLD = 4;

const QUICK_STATS = [
  {
    key: 'totalItems',
    icon: 'package',
    iconColor: COLORS.accentGold,
    accentColor: COLORS.accentGold,
    backgroundColor: '#FFFDF5',
    borderLeftColor: COLORS.accentGold,
    value: '1,240',
    label: 'Total Items',
  },
  {
    key: 'pendingRequest',
    icon: 'person',
    iconColor: COLORS.accentPink,
    accentColor: COLORS.accentPink,
    backgroundColor: '#FFF5F8',
    borderLeftColor: COLORS.accentPink,
    value: '3',
    label: 'Request',
  },
];

const MAIN_OPERATIONS = [
  { key: 'receiveStock', icon: 'trayDown', iconColor: COLORS.accentPurple, title: 'Receive Stock', screen: null },
  { key: 'releaseStock', icon: 'checkCircle', iconColor: COLORS.success, title: 'Release Stock', screen: null },
  { key: 'manageReturns', icon: 'returns', iconColor: COLORS.accentOrange, title: 'Manage Returns', screen: null },
  { key: 'alerts', icon: 'warning', iconColor: COLORS.error, title: 'Alerts / Discrepancies', screen: null },
  { key: 'trackDeliveries', icon: 'navigation', iconColor: COLORS.accentBlue, title: 'Track Deliveries', screen: null },
  { key: 'agentAccounts', icon: 'users', iconColor: COLORS.accentPink, title: 'Agent Accounts', screen: 'AgentAccounts' },
];

const RECENT_LOGS = [
  { key: 'log1', icon: 'trayDown', iconColor: COLORS.secondary, text: 'Received 100x Liniment from Factory' },
  { key: 'log2', icon: 'trayUp', iconColor: COLORS.success, text: 'Released 20x Product to Maria' },
];

export default function ManagerDashboardScreen() {
  const navigation = useNavigation();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  const secondaryHeaderHeight = useRef(new Animated.Value(SECONDARY_HEADER_HEIGHT)).current;
  const lastScrollY = useRef(0);

  useEffect(() => {
    authService.getCurrentUser().then(setUser);
  }, []);

  const managerName = user?.full_name || user?.username || '';
  const branchName = user?.branchName || '';

  const animateSecondaryHeader = (toValue) => {
    Animated.timing(secondaryHeaderHeight, {
      toValue,
      duration: 200,
      useNativeDriver: false, // height can't be animated by the native driver
    }).start();
  };

  const handleScroll = (event) => {
    const currentY = event.nativeEvent.contentOffset.y;
    const delta = currentY - lastScrollY.current;

    if (currentY <= 0) {
      animateSecondaryHeader(SECONDARY_HEADER_HEIGHT); // always shown at the very top
    } else if (delta > SCROLL_DIRECTION_THRESHOLD) {
      animateSecondaryHeader(0); // scrolling down - hide
    } else if (delta < -SCROLL_DIRECTION_THRESHOLD) {
      animateSecondaryHeader(SECONDARY_HEADER_HEIGHT); // scrolling up - reveal
    }

    lastScrollY.current = currentY;
  };

  return (
    <>
      <StatusBar style="light" translucent backgroundColor="transparent" />
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

        <Animated.View style={{ height: secondaryHeaderHeight, overflow: 'hidden' }}>
          <SecondaryHeader height={SECONDARY_HEADER_HEIGHT}>
            <View style={styles.secondaryContent}>
              <Text style={styles.welcomeText}>
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
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
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
  },
  logsList: {
    gap: SPACING.sm,
  },
});
