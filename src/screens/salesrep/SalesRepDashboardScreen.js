// src/screens/salesrep/SalesRepDashboardScreen.js
import React, { useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, Animated, Alert, TouchableOpacity, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import Icon from '../../components/common/Icon';
import StatCard from '../../components/common/StatCard';
import ActionCard from '../../components/common/ActionCard';
import LogListItem from '../../components/common/LogListItem';
import BottomNavBar from '../../components/common/BottomNavBar';
import QRScannerModal from '../../components/common/QRScannerModal';
import SkeletonBlock from '../../components/ui/SkeletonBlock';
import { SkeletonList } from '../../components/ui/SkeletonCard';
import authService from '../../services/authService';
import inventoryService from '../../services/inventoryService';
import requestService from '../../services/requestService';
import { COLORS } from '../../constants/colors';
import { formatRelativeTime } from '../../utils/formatters';
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
  { key: 'receiveStock', icon: 'packageHex', iconColor: COLORS.srReceiveStroke, duotoneColor: COLORS.srReceiveFill, title: 'Receive Stock', screen: 'ReceiveStockTypeSR' },
  { key: 'requestStock', icon: 'notePencil', iconColor: COLORS.srRequestStroke, duotoneColor: COLORS.srRequestFill, title: 'Request Stock', screen: 'RequestStockSR' },
  { key: 'submitReport', icon: 'document', iconColor: COLORS.srReportStroke, duotoneColor: COLORS.srReportFill, title: 'Submit Report', screen: 'SubmitReportSR' },
  { key: 'alerts', icon: 'alertTriangle', iconColor: COLORS.iconAlertStroke, duotoneColor: COLORS.iconAlertFill, title: 'Alerts / Discrepancies', screen: 'AlertsDiscrepanciesSR' },
  { key: 'trackDeliveries', icon: 'compassTarget', iconColor: COLORS.iconTrackStroke, duotoneColor: COLORS.iconTrackFill, title: 'Track Deliveries', screen: 'SalesRepTrackDeliveries' },
  { key: 'returnStocks', icon: 'returnBox', iconColor: COLORS.srReturnStroke, duotoneColor: COLORS.srReturnFill, title: 'Return Stocks', screen: 'ReturnStocksSR' },
];

export default function SalesRepDashboardScreen() {
  const navigation = useNavigation();
  const [user, setUser] = useState(null);
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [totalUnits, setTotalUnits] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [pendingRequestCount, setPendingRequestCount] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

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

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);

    const currentUser = await authService.getCurrentUser();
    setUser(currentUser);

    const [inventoryResult, logsResult, requestsResult, deliveriesResult] = await Promise.all([
      inventoryService.getSrInventory(currentUser?.id),
      inventoryService.getSrActivityLogs(currentUser?.id, 3),
      requestService.getMyStockRequests(currentUser?.id, 5),
      inventoryService.getMyDeliveries(currentUser?.id, 10),
    ]);

    if (inventoryResult.success) {
      // remaining_quantity (current custody), not quantity (originally
      // received) — see SalesRepStockScreen.js for the full explanation.
      setTotalUnits(inventoryResult.data.reduce((sum, row) => sum + row.remaining_quantity, 0));
    }
    const requests = requestsResult.success ? requestsResult.data : [];
    setPendingRequestCount(requestsResult.success ? requests.filter((r) => r.status === 'pending').length : null);

    const deliveredIncoming = (deliveriesResult.success ? deliveriesResult.data : []).filter(
      (d) => d.deliveryStatus === 'delivered'
    );

    // Merge accepted-stock logs with request status changes and completed
    // incoming deliveries into one chronological feed, top 3 — same pattern
    // getActivityLogs already uses to merge receiving+release on the
    // Manager side.
    const merged = [
      ...(logsResult.success ? logsResult.data : []).map((log) => ({ ...log, logType: 'acceptance' })),
      ...requests.map((req) => ({ ...req, logType: 'request' })),
      ...deliveredIncoming.map((d) => ({ ...d, logType: 'delivery', createdAt: d.deliveredAt })),
    ];
    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setRecentLogs(merged.slice(0, 3));

    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [loadDashboardData])
  );

  const repName = user?.full_name || user?.username || '';
  const branchName = user?.branchName || '';

  const displayedStats = QUICK_STATS.map((stat) => {
    if (stat.key === 'totalItems') {
      return { ...stat, value: totalUnits === null ? '—' : totalUnits.toLocaleString() };
    }
    if (stat.key === 'pendingStock') {
      return { ...stat, value: pendingRequestCount === null ? '—' : String(pendingRequestCount) };
    }
    return stat;
  });

  const REQUEST_STATUS_META = {
    pending: { icon: 'clock', iconColor: COLORS.accentGold, verb: 'Requested' },
    accepted: { icon: 'checkCircle', iconColor: COLORS.success, verb: 'Accepted' },
    declined: { icon: 'xCircle', iconColor: COLORS.error, verb: 'Declined' },
  };

  const recentLogsDisplay = recentLogs.map((log) => {
    if (log.logType === 'delivery') {
      return {
        key: `delivery-${log.transactionId}`,
        icon: 'checkCircle',
        iconColor: COLORS.success,
        text: `Delivery from ${log.collectorName || 'Collector'} arrived — ${formatRelativeTime(log.createdAt)}`,
        log,
      };
    }
    if (log.logType === 'request') {
      const meta = REQUEST_STATUS_META[log.status] || REQUEST_STATUS_META.pending;
      const units = (log.items || []).reduce((sum, item) => sum + item.quantity, 0);
      return {
        key: `request-${log.requestId}`,
        icon: meta.icon,
        iconColor: meta.iconColor,
        text: `${meta.verb} stock request: ${units} unit${units === 1 ? '' : 's'} (${(log.items || []).length} product${(log.items || []).length === 1 ? '' : 's'}) — ${formatRelativeTime(log.createdAt)}`,
        log,
      };
    }
    const units = (log.items || []).reduce((sum, item) => sum + item.quantity, 0);
    return {
      key: `acceptance-${log.acceptanceId}`,
      icon: 'trayDown',
      iconColor: COLORS.secondary,
      text: `Accepted ${units} unit${units === 1 ? '' : 's'} (${(log.items || []).length} product${(log.items || []).length === 1 ? '' : 's'}) — ${formatRelativeTime(log.createdAt)}`,
      log,
    };
  });

  const handleTabPress = (key) => {
    if (key === 'stock') {
      navigation.navigate('SalesRepStock');
    } else if (key === 'reports') {
      navigation.navigate('SalesRepReports');
    } else if (key === 'settings') {
      navigation.navigate('SalesRepSettings');
    } else if (key !== 'dashboard') {
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
          onProfilePress={() => navigation.navigate('SalesRepSettings')}
          title="Sales Rep Dashboard"
          showDocumentIcon={true}
          onDocumentPress={() => navigation.navigate('SalesRepLogs')}
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
                {isLoading ? (
                  <SkeletonBlock width={180} height={25} borderRadius={4} />
                ) : (
                  <Text style={styles.welcomeText} numberOfLines={1}>
                    Welcome, <Text style={styles.welcomeName}>{repName}</Text>!
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
                if (stat.key === 'totalItems') {
                  return (
                    <TouchableOpacity
                      key={stat.key}
                      style={styles.statTouchable}
                      onPress={() => navigation.navigate('SalesRepStock')}
                      activeOpacity={0.7}
                      accessibilityLabel="View my stock"
                      accessibilityRole="button"
                    >
                      {card}
                    </TouchableOpacity>
                  );
                }
                if (stat.key === 'pendingStock') {
                  return (
                    <TouchableOpacity
                      key={stat.key}
                      style={styles.statTouchable}
                      onPress={() => navigation.navigate('SalesRepStockRequests')}
                      activeOpacity={0.7}
                      accessibilityLabel="View my stock requests"
                      accessibilityRole="button"
                    >
                      {card}
                    </TouchableOpacity>
                  );
                }
                return <View key={stat.key} style={styles.statTouchable}>{card}</View>;
              })}
            </View>
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
                onPress={operation.screen ? () => navigation.navigate(operation.screen) : undefined}
                style={styles.operationCard}
              />
            ))}
          </View>

          <Text style={styles.sectionTitle}>Recent Logs</Text>
          <View style={styles.logsList}>
            {isLoading ? (
              <SkeletonList count={3} lines={1} thumbSize={36} />
            ) : recentLogsDisplay.length > 0 ? (
              recentLogsDisplay.map((log) => (
                <LogListItem
                  key={log.key}
                  icon={log.icon}
                  iconColor={log.iconColor}
                  text={log.text}
                  onPress={() =>
                    log.log.logType === 'delivery'
                      ? navigation.navigate('SalesRepTrackDeliveries')
                      : navigation.navigate('SalesRepLogs', { initialLog: log.log })
                  }
                />
              ))
            ) : (
              <Text style={styles.emptyLogsText}>No recent activity yet.</Text>
            )}
          </View>
          </ScrollView>
        </View>

        <BottomNavBar
          activeTab="dashboard"
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
