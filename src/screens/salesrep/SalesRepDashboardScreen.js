// src/screens/salesrep/SalesRepDashboardScreen.js
import React, { useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, Animated, Alert, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import Icon from '../../components/common/Icon';
import StatCard from '../../components/common/StatCard';
import ActionCard from '../../components/common/ActionCard';
import BottomNavBar from '../../components/common/BottomNavBar';
import QRScannerModal from '../../components/common/QRScannerModal';
import authService from '../../services/authService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

// Same layout/spec as ManagerDashboardScreen — this constant intentionally
// matches its value so the collapsing header behaves identically.
const SECONDARY_HEADER_HEIGHT = 100;

// 2nd_header_img_salerep.png is 404x466 natively. Unlike the Manager
// dashboard's illustration (flush against the edge), this one gets a 16px
// margin on the right per spec, via SecondaryHeader's illustrationMarginRight.
const HEADER_ILLUSTRATION_ASPECT_RATIO = 404 / 466;
const HEADER_ILLUSTRATION_WIDTH = SECONDARY_HEADER_HEIGHT * HEADER_ILLUSTRATION_ASPECT_RATIO;
const HEADER_ILLUSTRATION_MARGIN_RIGHT = 16;

const QUICK_STATS = [
  {
    key: 'totalItems',
    icon: 'boxPackage',
    iconColor: COLORS.secondary,
    accentColor: COLORS.secondary,
    backgroundColor: '#EAF8FE',
    borderLeftColor: COLORS.secondary,
    value: '50',
    label: 'Total Items',
  },
  {
    key: 'pendingStock',
    icon: 'clock',
    iconColor: COLORS.accentGold,
    accentColor: COLORS.accentGold,
    backgroundColor: '#FFFDF5',
    borderLeftColor: COLORS.accentGold,
    value: '20',
    label: 'Pending Stock',
  },
];

const MAIN_OPERATIONS = [
  { key: 'receiveStock', icon: 'packageHex', iconColor: COLORS.srReceiveStroke, duotoneColor: COLORS.srReceiveFill, title: 'Receive Stock', screen: null },
  { key: 'requestStock', icon: 'notePencil', iconColor: COLORS.srRequestStroke, duotoneColor: COLORS.srRequestFill, title: 'Request Stock', screen: null },
  { key: 'submitReport', icon: 'document', iconColor: COLORS.srReportStroke, duotoneColor: COLORS.srReportFill, title: 'Submit Report', screen: null },
  { key: 'alerts', icon: 'alertTriangle', iconColor: COLORS.iconAlertStroke, duotoneColor: COLORS.iconAlertFill, title: 'Alerts / Discrepancies', screen: null },
  { key: 'trackDeliveries', icon: 'compassTarget', iconColor: COLORS.iconTrackStroke, duotoneColor: COLORS.iconTrackFill, title: 'Track Deliveries', screen: null },
  { key: 'returnStocks', icon: 'returnBox', iconColor: COLORS.srReturnStroke, duotoneColor: COLORS.srReturnFill, title: 'Return Stocks', screen: null },
];

export default function SalesRepDashboardScreen() {
  const navigation = useNavigation();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isScannerVisible, setIsScannerVisible] = useState(false);

  // Same FB/IG-style collapsing header as ManagerDashboardScreen — see that
  // file for why it's JS-driven (diffClamp + transform) instead of native.
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
      authService.getCurrentUser().then(setUser);
    }, [])
  );

  const repName = user?.full_name || user?.username || '';
  const branchName = user?.branchName || '';

  const handleTabPress = (key) => {
    setActiveTab(key);
    if (key !== 'dashboard') {
      Alert.alert('Coming Soon', `${key.charAt(0).toUpperCase()}${key.slice(1)} isn't built yet.`);
    }
  };

  const handleScanned = (data) => {
    setIsScannerVisible(false);
    Alert.alert('QR Scanned', `Code: ${data}\n\nMatching this against your assigned stock is coming soon.`);
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
          title="Sales Rep Dashboard"
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
              illustration={require('../../../assets/sales_rep_assets/2nd_header_img_salerep.png')}
              illustrationWidth={HEADER_ILLUSTRATION_WIDTH}
              illustrationMarginRight={HEADER_ILLUSTRATION_MARGIN_RIGHT}
            >
              <View style={styles.secondaryContent}>
                <Text style={styles.welcomeText} numberOfLines={1}>
                  Welcome, <Text style={styles.welcomeName}>{repName}</Text>!
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
                onPress={operation.screen ? () => navigation.navigate(operation.screen) : undefined}
                style={styles.operationCard}
              />
            ))}
          </View>

          <Text style={styles.sectionTitle}>Recent Logs</Text>
          <View style={styles.logsList}>
            <Text style={styles.emptyLogsText}>No recent activity yet.</Text>
          </View>
          </ScrollView>
        </View>

        <BottomNavBar
          activeTab={activeTab}
          onTabPress={handleTabPress}
          onFabPress={() => setIsScannerVisible(true)}
        />
      </View>

      <QRScannerModal
        visible={isScannerVisible}
        onClose={() => setIsScannerVisible(false)}
        onScanned={handleScanned}
      />
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
  logsList: {
    gap: SPACING.sm,
  },
  emptyLogsText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
});
