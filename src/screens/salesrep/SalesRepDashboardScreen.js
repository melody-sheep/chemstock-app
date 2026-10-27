// src/screens/salesrep/SalesRepDashboardScreen.js
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, Animated, TouchableOpacity, StyleSheet } from 'react-native';
import Alert from '../../utils/appAlert';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import useCachedFocusLoader from '../../hooks/useCachedFocusLoader';
import useOutbox from '../../hooks/useOutbox';
import { queuedUnits } from '../../utils/queuedReceipts';
import useConnectionStatus from '../../hooks/useConnectionStatus';
import useOnlineLabel from '../../hooks/useOnlineLabel';
import useUnreadNotificationCount from '../../hooks/useUnreadNotificationCount';
import useUnseenLogCount from '../../hooks/useUnseenLogCount';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import Icon from '../../components/common/Icon';
import StatCard from '../../components/common/StatCard';
import FocusCard from '../../components/common/FocusCard';
import ActionCard from '../../components/common/ActionCard';
import LogListItem from '../../components/common/LogListItem';
import BottomNavBar, { useBottomNavBarHeight } from '../../components/common/BottomNavBar';
import QRScannerModal from '../../components/common/QRScannerModal';
import WelcomeOverview from '../../components/common/WelcomeOverview';
import SkeletonBlock from '../../components/ui/SkeletonBlock';
import { SkeletonList } from '../../components/ui/SkeletonCard';
import authService from '../../services/authService';
import inventoryService from '../../services/inventoryService';
import requestService from '../../services/requestService';
import deliveryService from '../../services/deliveryService';
import reportService from '../../services/reportService';
import notificationService from '../../services/notificationService';
import HintChip from '../../components/common/HintChip';
import DashboardTour from '../../components/common/DashboardTour';
import { COLORS } from '../../constants/colors';
import { formatRelativeTime } from '../../utils/formatters';
import { formatBranchLabel } from '../../utils/branchLabel';
import { manilaToday } from '../../utils/expiry';
import { routeQrScan } from '../../utils/routeQrScan';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import friendlyError from '../../utils/friendlyError';
import { primeSavedData } from '../../hooks/useCachedFocusLoader';
import { getConnectionStatus } from '../../services/connectionStatus';
import { SR_DELIVERIES_CACHE_KEY, loadDeliveriesData } from '../../utils/srDeliveries';
import { loadBackpackData } from './SalesRepBackpackScreen';
import { loadReportStatusData } from './SubmitReportSR';
import { loadDiscrepanciesData } from './AlertsDiscrepanciesSR';
import { loadStockData } from './SalesRepStockScreen';
import { loadReportsData } from './SalesRepReportsScreen';

// Each time the dashboard loads live, the Sales Rep's other main screens are
// refreshed in the background too, so if the phone goes offline they all show
// the same up-to-date copy and "as of" time, not whatever was last opened.
const PRIMED_SCREENS = [
  ['sales-rep-backpack', loadBackpackData],
  ['sales-rep-submit-report', loadReportStatusData],
  ['sales-rep-discrepancies', loadDiscrepanciesData],
  ['sales-rep-stock', loadStockData],
  ['sales-rep-reports', loadReportsData],
  [SR_DELIVERIES_CACHE_KEY, loadDeliveriesData],
];
const PRIME_EVERY_MS = 2 * 60 * 1000;
let lastPrimedAt = 0;
const primeOtherScreens = () => {
  if (Date.now() - lastPrimedAt < PRIME_EVERY_MS) return;
  lastPrimedAt = Date.now();
  PRIMED_SCREENS.forEach(([key, load]) => primeSavedData(key, load));
};

// Same layout/spec as ManagerDashboardScreen — this constant intentionally
// matches its value so the collapsing header behaves identically.
const SECONDARY_HEADER_HEIGHT = 92;

// 2nd_header_img_salerep.png is 404x466 natively. Unlike the Manager
// dashboard's illustration (flush against the edge), this one gets a 16px
// flush to the right edge, same as the Manager dashboard.
const HEADER_ILLUSTRATION_ASPECT_RATIO = 404 / 466;
const HEADER_ILLUSTRATION_WIDTH = SECONDARY_HEADER_HEIGHT * HEADER_ILLUSTRATION_ASPECT_RATIO;

// Same branch label rule as ManagerDashboardScreen: "IPONAN BRANCH, BUTUAN BRANCH" -> "Ipon..., Butu..."

const QUICK_STATS = [
  {
    key: 'totalItems',
    icon: 'backpack',
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
  const bottomNavHeight = useBottomNavBarHeight();
  const connection = useConnectionStatus();
  const onlineLabel = useOnlineLabel();
  const [isScannerVisible, setIsScannerVisible] = useState(false);

  // Same FB/IG-style collapsing header as ManagerDashboardScreen — see that
  // file for why it's JS-driven (diffClamp + transform) instead of native.
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

  // Returns the full dashboard snapshot. A request that fails keeps its value
  // from the previous snapshot instead of blanking the card.
  const loadDashboardData = async (previous) => {
    const currentUser = await authService.getCurrentUser();
    // A different account must never see the last account's numbers.
    const prev = previous?.user?.id === currentUser?.id ? previous : null;

    const [inventoryResult, logsResult, requestsResult, deliveriesResult, pendingHandoffsResult, discrepanciesResult, notificationsResult, lastReportResult] =
      await Promise.all([
        inventoryService.getSrInventory(currentUser?.id),
        inventoryService.getSrActivityLogs(currentUser?.id, 3),
        requestService.getMyStockRequests(currentUser?.id, 5),
        inventoryService.getMyDeliveries(currentUser?.id, 10),
        deliveryService.getMyPendingHandoffs(currentUser?.id),
        reportService.getMyDiscrepancies(currentUser?.id, 50),
        notificationService.getMyNotifications(currentUser?.id),
        reportService.getMyDailyReports(currentUser?.id, 1),
      ]);

    let pendingHandoffCount = prev?.pendingHandoffCount ?? 0;
    if (pendingHandoffsResult.success) {
      pendingHandoffCount = pendingHandoffsResult.data.length;
    }

    const requests = requestsResult.success ? requestsResult.data : [];
    const discrepancies = discrepanciesResult.success ? discrepanciesResult.data : [];
    const deliveredIncoming = (deliveriesResult.success ? deliveriesResult.data : []).filter(
      (d) => d.deliveryStatus === 'delivered'
    );

    // Merge accepted-stock logs with request status changes, completed
    // incoming deliveries, and flagged discrepancies into one chronological
    // feed, top 3 — same pattern getActivityLogs already uses to merge
    // receiving+release on the Manager side.
    const merged = [
      ...(logsResult.success ? logsResult.data : []).map((log) => ({ ...log, logType: 'acceptance' })),
      ...requests.map((req) => ({ ...req, logType: 'request' })),
      ...deliveredIncoming.map((d) => ({ ...d, logType: 'delivery', createdAt: d.deliveredAt })),
      ...discrepancies.map((d) => ({ ...d, logType: 'discrepancy', createdAt: d.reportDate })),
    ];
    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    // If any feed request failed (offline), keep the last complete feed
    // instead of saving a partial or empty one over it.
    const logsComplete = logsResult.success && requestsResult.success && deliveriesResult.success && discrepanciesResult.success;

    return {
      user: currentUser,
      // remaining_quantity (current custody), not quantity (originally
      // received) — see SalesRepStockScreen.js for the full explanation.
      totalUnits: inventoryResult.success
        ? inventoryResult.data.reduce((sum, row) => sum + row.remaining_quantity, 0)
        : prev?.totalUnits ?? null,
      // Same "not actually done until fulfilled" rule as the Manager
      // dashboard: a request tapped Prepare is still outstanding for the rep
      // until the stock is actually released to them.
      pendingRequestCount: requestsResult.success
        ? requests.filter((r) => r.status === 'pending' || (r.status === 'accepted' && !r.fulfilledTransactionId)).length
        : prev?.pendingRequestCount ?? null,
      pendingHandoffCount,
      pendingDirectReleaseCount: notificationsResult.success
        ? notificationsResult.data.filter(
          (notification) => notification.type === 'stock_released_to_you' && !notification.isRead
        ).length
        : prev?.pendingDirectReleaseCount ?? 0,
      openDiscrepancyCount: discrepanciesResult.success
        ? discrepancies.filter((d) => d.resolutionStatus === 'open').length
        : prev?.openDiscrepancyCount ?? 0,
      recentLogs: logsComplete || !prev ? merged.slice(0, 3) : prev.recentLogs,
      logTimes: logsComplete || !prev ? merged.map((log) => log.createdAt) : prev.logTimes,
      notificationCount: notificationsResult.success
        ? notificationsResult.unreadCount
        : prev?.notificationCount ?? 0,
      // Day of the latest report filed (or auto-filed), for the "Today" card.
      lastReportDate: lastReportResult.success
        ? lastReportResult.data?.[0]?.reportDate ?? null
        : prev?.lastReportDate ?? null,
    };
  };

  const { data: snapshot, isLoading, savedAt, refreshControlAt } = useCachedFocusLoader('sales-rep-dashboard', loadDashboardData);
  useEffect(() => {
    if (savedAt && getConnectionStatus().online) primeOtherScreens();
  }, [savedAt]);
  const user = snapshot?.user ?? null;
  // Stock received offline counts right away, as in the backpack.
  const { pending: queuedEntries } = useOutbox();
  const queuedReceiptUnits = queuedUnits(queuedEntries, user?.id);
  const totalUnits = snapshot?.totalUnits == null ? null : snapshot.totalUnits + queuedReceiptUnits;
  const recentLogs = snapshot?.recentLogs ?? [];
  // Requests saved offline count right away; once synced they're in the
  // server's count instead.
  const queuedRequestCount = queuedEntries.filter((e) => e.type === 'stock_request' && e.payload?.agentId === user?.id).length;
  const pendingRequestCount = snapshot?.pendingRequestCount == null ? null : snapshot.pendingRequestCount + queuedRequestCount;
  const openDiscrepancyCount = snapshot?.openDiscrepancyCount ?? 0;
  // "Today" card: is today's report in, waiting to send, or still to do.
  const reportQueued = queuedEntries.some((e) => e.type === 'daily_report' && e.payload?.agentId === user?.id);
  const reportDoneToday = snapshot?.lastReportDate === manilaToday();
  const unseenLogCount = useUnseenLogCount(user?.id ?? null, snapshot?.logTimes);
  const liveUnreadCount = useUnreadNotificationCount(user?.id ?? null, !!user?.id);
  const notificationCount = liveUnreadCount ?? snapshot?.notificationCount ?? 0;

  const repName = user?.full_name || user?.username || '';
  const branchName = user?.branchName || '';
  const branchLabel = formatBranchLabel(branchName);

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
    if (log.logType === 'discrepancy') {
      const isLoss = log.discrepancyType === 'loss';
      return {
        key: `discrepancy-${log.reportItemId}`,
        icon: 'warning',
        iconColor: log.carryForwardEnabled ? '#D98200' : COLORS.error,
        text: log.carryForwardEnabled
          ? `Missing on report: ${log.productName} (${Math.abs(log.discrepancy)} units) still in backpack; carried forward — ${formatRelativeTime(log.reportDate)}`
          : `Discrepancy flagged: ${log.productName} (${Math.abs(log.discrepancy)} ${isLoss ? 'missing' : 'over'}) — ${formatRelativeTime(log.reportDate)}`,
        log,
      };
    }
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

  const handleScanned = async (qrCode) => {
    setIsScannerVisible(false);
    try {
      const currentAgent = await authService.getCurrentUser();
      await routeQrScan({ qrCode, agentId: currentAgent?.id, navigation });
    } catch (error) {
      Alert.alert('Unable to Verify QR', friendlyError(error.message) || 'Please try again.');
    }
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
          profilePhotoUrl={user?.profilePhotoUrl}
          title="Sales Rep Dashboard"
          showDocumentIcon={true}
          onDocumentPress={() => navigation.navigate('SalesRepLogs')}
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
              illustration={require('../../../assets/sales_rep_assets/2nd_header_img_salerep.png')}
              illustrationWidth={HEADER_ILLUSTRATION_WIDTH}
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
          <View ref={tourRefs.focus} collapsable={false}>
          {isLoading ? (
            <SkeletonBlock width="100%" height={38} borderRadius={12} style={{ marginBottom: SPACING.lg }} />
          ) : (
            <FocusCard
              title="Today"
              storageKey="sales-rep-today"
              icon="clock"
              emptyText="Nothing to do right now."
              rows={[
                totalUnits !== null && {
                  key: 'backpack', icon: 'backpack', tone: 'info', label: 'In your backpack',
                  value: `${totalUnits.toLocaleString()} item${totalUnits === 1 ? '' : 's'}`,
                  onPress: () => navigation.navigate('SalesRepBackpack'),
                },
                reportQueued
                  ? { key: 'report', icon: 'clipboardText', tone: 'info', label: 'Daily report', value: 'Waiting to send', onPress: () => navigation.navigate('SubmitReportSR') }
                  : reportDoneToday
                    ? { key: 'report', icon: 'clipboardText', tone: 'good', label: 'Daily report', value: 'Submitted', onPress: () => navigation.navigate('SubmitReportSR') }
                    : totalUnits > 0 && { key: 'report', icon: 'clipboardText', tone: 'warn', label: 'Daily report', value: 'Due today', onPress: () => navigation.navigate('SubmitReportSR') },
                pendingRequestCount > 0 && {
                  key: 'requests', icon: 'peopleGroup', tone: 'warn', label: 'Stock requests',
                  value: `${pendingRequestCount} pending`, onPress: () => navigation.navigate('SalesRepStockRequests'),
                },
                openDiscrepancyCount > 0 && {
                  key: 'discrepancies', icon: 'warningTriangle', tone: 'alert', label: 'To resolve',
                  value: String(openDiscrepancyCount), onPress: () => navigation.navigate('AlertsDiscrepanciesSR'),
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
                    iconSize={32}
                    style={styles.statCardCompact}
                  />
                );
                if (stat.key === 'totalItems') {
                  return (
                    <TouchableOpacity
                      key={stat.key}
                      style={styles.statTouchable}
                      onPress={() => navigation.navigate('SalesRepBackpack')}
                      activeOpacity={0.7}
                      accessibilityLabel="View my backpack"
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
          <View ref={tourRefs.ops} collapsable={false} style={styles.operationsGrid}>
            {MAIN_OPERATIONS.map((operation) => (
              <ActionCard
                key={operation.key}
                icon={operation.icon}
                iconColor={operation.iconColor}
                duotoneColor={operation.duotoneColor}
                title={operation.title}
                onPress={operation.screen ? () => navigation.navigate(operation.screen) : undefined}
                style={styles.operationCard}
                layout="tile"
                badgeCount={
                  operation.key === 'alerts'
                    ? openDiscrepancyCount
                    : operation.key === 'receiveStock'
                      ? (snapshot?.pendingHandoffCount ?? 0) + (snapshot?.pendingDirectReleaseCount ?? 0)
                      : 0
                }
              />
            ))}
          </View>

          <View style={styles.logsTitleRow}>
            <Text style={[styles.sectionTitle, styles.logsTitle]}>Recent Logs</Text>
            <TouchableOpacity onPress={() => navigation.navigate('SalesRepLogs')} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.seeAll}>See all ›</Text>
            </TouchableOpacity>
          </View>
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
                  onPress={() => {
                    if (log.log.logType === 'discrepancy') {
                      navigation.navigate('ResolveDiscrepancy', { reportItem: log.log });
                    } else {
                      navigation.navigate('SalesRepLogDetail', { log: log.log });
                    }
                  }}
                />
              ))
            ) : (
              <Text style={styles.emptyLogsText}>No recent activity yet.</Text>
            )}
          </View>
          </ScrollView>
        </View>

        <BottomNavBar
          fabRef={tourRefs.fab}
          activeTab="dashboard"
          onTabPress={handleTabPress}
          onFabPress={() => setIsScannerVisible(true)}
          fabLabel="Scan"
        />
      </View>

      <QRScannerModal
        visible={isScannerVisible}
        onClose={() => setIsScannerVisible(false)}
        onScanned={handleScanned}
      />
      <DashboardTour role="sales_rep" refs={tourRefs} scrollRef={tourScrollRef} enabled={!isLoading && !!user && welcomeOpen === false} />
      <WelcomeOverview role="sales_rep" userId={user?.id} name={user?.full_name || user?.username} onSettled={setWelcomeOpen} />
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
    fontSize: 22,
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
    marginTop: 6,
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
  statTouchable: {
    flex: 1,
  },
  operationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: SPACING.lg,
  },
  operationCard: {
    width: '31.5%',
    minHeight: 88,
  },
  logsTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  logsTitle: { marginBottom: 0 },
  seeAll: { fontSize: TYPOGRAPHY.fontSize.sm, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: TYPOGRAPHY.fontWeight.bold, color: '#0085F9' },
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
