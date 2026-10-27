// src/screens/manager/ManagerDashboardScreen.js
import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, Animated, TouchableOpacity, StyleSheet } from 'react-native';
import Alert from '../../utils/appAlert';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import useCachedFocusLoader from '../../hooks/useCachedFocusLoader';
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
import CustomModal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import SkeletonBlock from '../../components/ui/SkeletonBlock';
import { SkeletonList } from '../../components/ui/SkeletonCard';
import authService from '../../services/authService';
import { describeReceivingScan } from '../../utils/scanLookup';
import ScanResultSheet from '../../components/common/ScanResultSheet';
import agentService from '../../services/agentService';
import inventoryService from '../../services/inventoryService';
import requestService from '../../services/requestService';
import reportService from '../../services/reportService';
import notificationService from '../../services/notificationService';
import HintChip from '../../components/common/HintChip';
import PermissionsCard from '../../components/common/PermissionsCard';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { formatRelativeTime } from '../../utils/formatters';
import { formatBranchLabel } from '../../utils/branchLabel';

const SECONDARY_HEADER_HEIGHT = 92;

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
    value: '0',
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
    label: 'Pending requests',
  },
];

const MAIN_OPERATIONS = [
  { key: 'receiveStock', icon: 'packageHex', iconColor: COLORS.primary, duotoneColor: COLORS.iconReceiveFill, title: 'Receive Stock', screen: 'ReceiveStock' },
  { key: 'releaseStock', icon: 'successCircle', iconColor: COLORS.iconReleaseStroke, duotoneColor: COLORS.iconReleaseFill, title: 'Release Stock', screen: 'ReleaseStockRecipient' },
  { key: 'manageReturns', icon: 'returnBox', iconColor: COLORS.iconReturnStroke, duotoneColor: COLORS.iconReturnFill, title: 'Reports & Returns', screen: 'ManageReturns' },
  { key: 'alerts', icon: 'alertTriangle', iconColor: COLORS.iconAlertStroke, duotoneColor: COLORS.iconAlertFill, title: 'Alerts / Discrepancies', screen: 'ManagerAlerts' },
  { key: 'trackDeliveries', icon: 'compassTarget', iconColor: COLORS.iconTrackStroke, duotoneColor: COLORS.iconTrackFill, title: 'Track Deliveries', screen: 'TrackDeliveries' },
  { key: 'agentAccounts', icon: 'agentsGroup', iconColor: COLORS.iconAgentStroke, duotoneColor: COLORS.iconAgentFill, title: 'Manage Accounts', screen: 'ManageAccounts' },
];

export default function ManagerDashboardScreen() {
  const navigation = useNavigation();
  const bottomNavHeight = useBottomNavBarHeight();
  const route = useRoute();
  // Only set by the activation screen: shown once, then cleared so it never comes back.
  const justActivated = route.params?.justActivated === true;
  const closeWelcome = () => navigation.setParams({ justActivated: undefined });
  const connection = useConnectionStatus();
  const onlineLabel = useOnlineLabel();
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [scanSummary, setScanSummary] = useState(null);

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

  // Returns the full dashboard snapshot. A request that fails keeps its value
  // from the previous snapshot instead of blanking the card.
  const loadDashboardData = async (previous) => {
    const currentUser = await authService.getCurrentUser();
    // A different account must never see the last account's numbers.
    const prev = previous?.user?.id === currentUser?.id ? previous : null;

    const branchIds = currentUser?.branchIds || [];
    const [stockResult, logsResult, agentsResult, requestsResult, deliveriesResult, reportsResult, discrepanciesResult, notificationsResult] =
      await Promise.all([
        inventoryService.getBranchStock(branchIds),
        inventoryService.getActivityLogs(branchIds, 3),
        agentService.getMyAgentAccounts(),
        requestService.getBranchStockRequests(50),
        inventoryService.getDeliveries(branchIds, 10),
        reportService.getBranchDailyReports(50),
        reportService.getBranchDiscrepancies(200),
        notificationService.getMyNotifications(),
      ]);

    const reports = reportsResult.success ? reportsResult.data : [];
    const discrepancies = discrepanciesResult.success ? discrepanciesResult.data : [];

    // Fold completed deliveries, report submissions, and flagged discrepancies
    // in as their own log types, same pattern as getActivityLogs' own
    // receiving+release merge — re-stamp each to a common `created_at` so the
    // existing sort/slice logic below needs no further branching.
    const deliveredLogs = (deliveriesResult.success ? deliveriesResult.data : [])
      .filter((d) => d.delivery_status === 'delivered')
      .map((d) => ({ ...d, logType: 'delivery', created_at: d.delivered_at }));
    const reportLogs = reports.map((r) => ({ ...r, logType: 'report', created_at: r.reportDate }));
    const discrepancyLogs = discrepancies.map((d) => ({ ...d, logType: 'discrepancy', created_at: d.reportDate }));
    const mergedLogs = [
      ...(logsResult.success ? logsResult.data : []),
      ...deliveredLogs,
      ...reportLogs,
      ...discrepancyLogs,
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const logsComplete = logsResult.success && deliveriesResult.success && reportsResult.success && discrepanciesResult.success;
    return {
      user: currentUser,
      totalUnits: stockResult.success
        ? stockResult.data.reduce((sum, row) => sum + row.quantity, 0)
        : prev?.totalUnits ?? null,
      pendingReportCount: reportsResult.success
        ? reports.filter((r) => r.status === 'pending').length
        : prev?.pendingReportCount ?? 0,
      openDiscrepancyCount: discrepanciesResult.success
        ? discrepancies.filter((d) => d.resolutionStatus === 'open').length
        : prev?.openDiscrepancyCount ?? 0,
      // The feed merges four requests; if any failed (offline), keep the last
      // complete feed instead of saving a partial or empty one over it.
      recentLogs: logsComplete || !prev ? mergedLogs.slice(0, 3) : prev.recentLogs,
      logTimes: logsComplete || !prev ? mergedLogs.map((log) => log.created_at) : prev.logTimes,
      recipientNameById: agentsResult.success
        ? Object.fromEntries(agentsResult.data.map((a) => [a.id, a.full_name]))
        : prev?.recipientNameById ?? {},
      // A request tapped "Prepare" is 'accepted' but not actually done until
      // it's linked to a completed release (fulfilledTransactionId set) —
      // same "preparing" derivation AgentStockRequestScreen uses. Counting
      // only strict 'pending' here made the stat (and the Continue flow)
      // drop a request the moment Prepare was tapped, even if the manager
      // backed out before finishing the release.
      pendingRequestCount: requestsResult.success
        ? requestsResult.data.filter((r) => r.status === 'pending' || (r.status === 'accepted' && !r.fulfilledTransactionId))
            .length
        : prev?.pendingRequestCount ?? null,
      notificationCount: notificationsResult.success
        ? notificationsResult.unreadCount
        : prev?.notificationCount ?? 0,
    };
  };

  const { data: snapshot, isLoading, refreshControlAt } = useCachedFocusLoader('manager-dashboard', loadDashboardData);
  const user = snapshot?.user ?? null;
  const totalUnits = snapshot?.totalUnits ?? null;
  const recentLogs = snapshot?.recentLogs ?? [];
  const recipientNameById = snapshot?.recipientNameById ?? {};
  const pendingRequestCount = snapshot?.pendingRequestCount ?? null;
  const pendingReportCount = snapshot?.pendingReportCount ?? 0;
  const openDiscrepancyCount = snapshot?.openDiscrepancyCount ?? 0;
  const unseenLogCount = useUnseenLogCount(user?.id ?? null, snapshot?.logTimes);
  const liveUnreadCount = useUnreadNotificationCount(null);
  const notificationCount = liveUnreadCount ?? snapshot?.notificationCount ?? 0;

  const managerName = user?.full_name || user?.username || '';
  const branchName = user?.branchName || '';
  const branchLabel = formatBranchLabel(branchName);

  const displayedStats = QUICK_STATS.map((stat) => {
    if (stat.key === 'totalItems') {
      return { ...stat, value: totalUnits === null ? '—' : totalUnits.toLocaleString() };
    }
    if (stat.key === 'pendingRequest') {
      return { ...stat, value: pendingRequestCount === null ? '—' : String(pendingRequestCount) };
    }
    return stat;
  });

  const recentLogsDisplay = recentLogs.map((log) => {
    if (log.logType === 'delivery') {
      const targetName = recipientNameById[log.target_recipient_id] || 'Sales Rep';
      return {
        key: `delivery-${log.id}`,
        icon: 'sealCheck',
        iconColor: '#4c9f70',
        text: `Delivery to ${targetName} completed — ${formatRelativeTime(log.delivered_at)}`,
        log,
      };
    }
    if (log.logType === 'report') {
      const productCount = (log.items || []).length;
      return {
        key: `report-${log.reportId}`,
        icon: 'clipboardText',
        iconColor: '#6C5CE7',
        text: `${log.agentName || 'A sales rep'} submitted today's report (${productCount} product${productCount === 1 ? '' : 's'}) — ${formatRelativeTime(log.reportDate)}`,
        log,
      };
    }
    if (log.logType === 'discrepancy') {
      const isLoss = log.discrepancyType === 'loss';
      return {
        key: `discrepancy-${log.reportItemId}`,
        icon: 'sealWarning',
        iconColor: log.carryForwardEnabled ? '#D98200' : '#dc3545',
        text: log.carryForwardEnabled
          ? `Missing on report: ${log.agentName || 'A sales rep'} — ${log.productName} (${Math.abs(log.discrepancy)} units) still in backpack; carried forward — ${formatRelativeTime(log.reportDate)}`
          : `Discrepancy flagged: ${log.agentName || 'A sales rep'} — ${log.productName} (${Math.abs(log.discrepancy)} ${isLoss ? 'missing' : 'over'}) — ${formatRelativeTime(log.reportDate)}`,
        log,
      };
    }
    const isRelease = log.logType === 'release';
    const items = isRelease ? log.transaction_details || [] : log.branch_inventory || [];
    const units = items.reduce((sum, item) => sum + (isRelease ? item.quantity : item.received_quantity), 0);
    const verb = isRelease ? 'Released' : 'Received';
    const recipient = isRelease && recipientNameById[log.received_by] ? ` to ${recipientNameById[log.received_by]}` : '';
    return {
      key: `${log.logType}-${log.id}`,
      icon: isRelease ? 'arrowUpRight' : 'arrowDownLeft',
      iconColor: isRelease ? '#4c9f70' : '#0096C7',
      text: `${verb} ${units} unit${units === 1 ? '' : 's'} (${items.length} product${items.length === 1 ? '' : 's'})${recipient} — ${formatRelativeTime(log.created_at)}`,
      log,
    };
  });

  const handleTabPress = (key) => {
    if (key === 'stock') {
      navigation.navigate('ManagerStock');
    } else if (key === 'reports') {
      navigation.navigate('ManagerReports');
    } else if (key === 'settings') {
      navigation.navigate('ManagerSettings');
    } else if (key !== 'dashboard') {
      navigation.navigate('ComingSoon', { tabKey: key, role: 'manager' });
    }
  };

  const handleScanned = async (qrCode) => {
    setIsScannerVisible(false);
    const manager = await authService.getCurrentUser();
    const summary = await describeReceivingScan(qrCode, manager?.branchIds || []);
    setScanSummary(summary);
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
          onProfilePress={() => navigation.navigate('ManagerSettings')}
          profilePhotoUrl={user?.profilePhotoUrl}
          title="Manager Dashboard"
          showDocumentIcon={true}
          onDocumentPress={() => navigation.navigate('StockLogs')}
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
              illustration={require('../../../assets/manager_assets/2nd_header_scan_img.png')}
              illustrationWidth={HEADER_ILLUSTRATION_WIDTH}
            >
              <View style={styles.secondaryContent}>
                {isLoading ? (
                  <SkeletonBlock width={180} height={25} borderRadius={4} />
                ) : (
                  <Text style={styles.welcomeText} numberOfLines={1}>
                    Welcome, <Text style={styles.welcomeName}>{managerName}</Text>!
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
          refreshControl={refreshControlAt(SECONDARY_HEADER_HEIGHT)}
            style={styles.content}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomNavHeight + SPACING.xl }]}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
          <HintChip id="dashboard-pull" text={"Pull down to refresh. Tap any card to open that screen."} style={{ marginBottom: SPACING.md }} />
          {isLoading ? (
            <SkeletonBlock width="100%" height={38} borderRadius={12} style={{ marginBottom: SPACING.lg }} />
          ) : (
            <FocusCard
              title="Needs attention"
              storageKey="manager-needs-attention"
              icon="notification"
              emptyText="All caught up. Nothing is waiting for you."
              rows={[
                pendingRequestCount > 0 && {
                  key: 'requests', icon: 'peopleGroup', tone: 'warn', label: 'Stock requests',
                  value: String(pendingRequestCount), onPress: () => navigation.navigate('AgentStockRequest'),
                },
                pendingReportCount > 0 && {
                  key: 'reports', icon: 'clipboardText', tone: 'warn', label: 'Reports to accept',
                  value: String(pendingReportCount), onPress: () => navigation.navigate('ManageReturns'),
                },
                openDiscrepancyCount > 0 && {
                  key: 'discrepancies', icon: 'warningTriangle', tone: 'alert', label: 'Discrepancies to review',
                  value: String(openDiscrepancyCount), onPress: () => navigation.navigate('ManagerAlerts'),
                },
              ]}
            />
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
                  strokeWidth={stat.strokeWidth}
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
                    onPress={() => navigation.navigate('ManagerStock')}
                    activeOpacity={0.7}
                    accessibilityLabel="View branch stock"
                    accessibilityRole="button"
                  >
                    {card}
                  </TouchableOpacity>
                );
              }
              if (stat.key === 'pendingRequest') {
                return (
                  <TouchableOpacity
                    key={stat.key}
                    style={styles.statTouchable}
                    onPress={() => navigation.navigate('AgentStockRequest')}
                    activeOpacity={0.7}
                    accessibilityLabel="View stock requests"
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
                layout="tile"
                badgeCount={
                  operation.key === 'manageReturns'
                    ? pendingReportCount
                    : operation.key === 'alerts'
                    ? openDiscrepancyCount
                    : 0
                }
              />
            ))}
          </View>

          <View style={styles.logsTitleRow}>
            <Text style={[styles.sectionTitle, styles.logsTitle]}>Recent Logs</Text>
            <TouchableOpacity onPress={() => navigation.navigate('StockLogs')} accessibilityRole="button" hitSlop={8}>
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
                    if (log.log.logType === 'delivery') {
                      navigation.navigate('TrackDeliveries');
                    } else if (log.log.logType === 'report') {
                      navigation.navigate('ManageReturns');
                    } else if (log.log.logType === 'discrepancy') {
                      navigation.navigate('ManagerAlerts');
                    } else {
                      navigation.navigate('StockLogs', { initialLog: log.log });
                    }
                  }}
                />
              ))
            ) : (
              <Text style={styles.emptyLogsText}>No stock received yet.</Text>
            )}
          </View>
          </ScrollView>
        </View>

        <BottomNavBar
          activeTab="dashboard"
          onTabPress={handleTabPress}
          onFabPress={() => setIsScannerVisible(true)}
          fabLabel="Scan"
        />
      </View>

      <CustomModal visible={justActivated} onClose={closeWelcome} height="auto" maxHeight={640} closeOnBackdropPress={false}>
        <ScrollView showsVerticalScrollIndicator={false} style={styles.welcomeScroll}>
          <View style={styles.welcomeIconWrap}>
            <View style={styles.welcomeRing}>
              <View style={styles.welcomeCircle}>
                <Icon name="checkCircle" size={30} color={COLORS.success} weight="fill" />
              </View>
            </View>
          </View>
          <Text style={styles.welcomeModalTitle}>Branch activated</Text>
          <Text style={styles.welcomeModalText}>
            {branchName ? `${branchName} is now registered to your account.` : 'Your branch is now registered to your account.'}{' '}
            You're its manager: you can run its stock and its team from this device.
          </Text>

          <Text style={styles.welcomeListLabel}>WHAT YOU CAN DO</Text>
          {[
            { icon: 'trayDown', color: '#0085F9', bg: '#EAF4FF', title: 'Receive stock', hint: 'Register new batches and print their QR codes' },
            { icon: 'trayUp', color: '#D98200', bg: '#FFF1D6', title: 'Release stock', hint: 'Send stock to Sales Reps, directly or through a Collector' },
            { icon: 'clipboardText', color: '#1E7A3A', bg: '#E1F4E8', title: 'Review reports & returns', hint: 'Check daily reports and accept or reject returns' },
            { icon: 'truck', color: '#7B6FE8', bg: '#EEEBFF', title: 'Track deliveries', hint: 'Follow trips and your team on the map' },
            { icon: 'person', color: '#E5366B', bg: '#FDEBF1', title: 'Manage accounts', hint: 'Create and manage Sales Rep and Collector accounts' },
          ].map((item) => (
            <View key={item.title} style={styles.welcomeRow}>
              <View style={[styles.welcomeRowIcon, { backgroundColor: item.bg }]}>
                <Icon name={item.icon} size={18} color={item.color} />
              </View>
              <View style={styles.welcomeRowText}>
                <Text style={styles.welcomeRowTitle}>{item.title}</Text>
                <Text style={styles.welcomeRowHint}>{item.hint}</Text>
              </View>
            </View>
          ))}

          <Text style={styles.welcomeListLabel}>PERMISSIONS NEEDED</Text>
          <PermissionsCard />
        </ScrollView>
        <Button title="Get Started" variant="black" onPress={closeWelcome} height={48} fontSize={16} borderRadius={24} width="100%" style={styles.welcomeButton} />
      </CustomModal>

      <QRScannerModal
        visible={isScannerVisible}
        onClose={() => setIsScannerVisible(false)}
        onScanned={handleScanned}
      />
      <ScanResultSheet
        summary={scanSummary}
        onClose={() => setScanSummary(null)}
        onScanAgain={() => {
          setScanSummary(null);
          setIsScannerVisible(true);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  welcomeScroll: { flexShrink: 1 },
  welcomeIconWrap: { alignItems: 'center', marginBottom: SPACING.md },
  welcomeRing: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.success + '14', alignItems: 'center', justifyContent: 'center' },
  welcomeCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.success + '26', alignItems: 'center', justifyContent: 'center' },
  welcomeModalTitle: { fontSize: TYPOGRAPHY.fontSize.lg, color: '#272632', textAlign: 'center', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  welcomeModalText: { marginTop: SPACING.xs, fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, fontFamily: TYPOGRAPHY.fontFamily.regular },
  welcomeListLabel: { marginTop: 18, marginBottom: 8, fontSize: 12, letterSpacing: 0.8, color: '#6B7280', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  welcomeRowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  welcomeRowText: { flex: 1 },
  welcomeRowTitle: { fontSize: TYPOGRAPHY.fontSize.sm, color: '#272632', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  welcomeRowHint: { marginTop: 1, fontSize: 12, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.regular },
  welcomeButton: { marginTop: SPACING.md },
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
