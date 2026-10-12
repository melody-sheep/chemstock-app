// src/screens/manager/StockLogsScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import useCachedFocusLoader from '../../hooks/useCachedFocusLoader';
import Header from '../../components/common/Header';
import Icon from '../../components/common/Icon';
import FilterSheet from '../../components/common/FilterSheet';
import LogCard from '../../components/common/LogCard';
import authService from '../../services/authService';
import agentService from '../../services/agentService';
import inventoryService from '../../services/inventoryService';
import reportService from '../../services/reportService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { formatRelativeTime } from '../../utils/formatters';
import { getLogItems } from '../../utils/stockLogUtils';

const LOGS_LIMIT = 50;

// "Today" compares calendar day; "This Week"/"This Month" are rolling
// windows (last 7 / 30 days) rather than calendar boundaries — simpler to
// reason about and avoids a Sunday-vs-Monday week-start debate.
const DATE_FILTER_OPTIONS = [
  { key: 'all', label: 'All Time', test: () => true },
  {
    key: 'today',
    label: 'Today',
    test: (log) => new Date(log.created_at).toDateString() === new Date().toDateString(),
  },
  {
    key: 'week',
    label: 'This Week',
    test: (log) => (Date.now() - new Date(log.created_at).getTime()) / 86400000 <= 7,
  },
  {
    key: 'month',
    label: 'This Month',
    test: (log) => (Date.now() - new Date(log.created_at).getTime()) / 86400000 <= 30,
  },
];

function summarizeItems(items) {
  const totalUnits = items.reduce((sum, item) => sum + item.qty, 0);
  return `${totalUnits} unit${totalUnits === 1 ? '' : 's'} · ${items.length} product${items.length === 1 ? '' : 's'}`;
}

// Returns the full logs snapshot. If every sub-fetch failed (e.g. fully
// offline), keeps the previous merged list entirely rather than rebuilding
// from a mix of fresh-but-empty pieces — the point of caching this at all is
// to not quietly lose data the screen already had.
const loadLogsData = async (previous) => {
  const manager = await authService.getCurrentUser();
  const prev = previous?.managerId === manager?.id ? previous : null;
  const branchIds = manager?.branchIds || [];
  const [logsResult, agentsResult, deliveriesResult, reportsResult, discrepanciesResult] = await Promise.all([
    inventoryService.getActivityLogs(branchIds, LOGS_LIMIT),
    agentService.getMyAgentAccounts(),
    inventoryService.getDeliveries(branchIds, LOGS_LIMIT),
    reportService.getBranchDailyReports(LOGS_LIMIT),
    reportService.getBranchDiscrepancies(200),
  ]);

  const allFailed =
    !logsResult.success && !agentsResult.success && !deliveriesResult.success &&
    !reportsResult.success && !discrepanciesResult.success;
  if (allFailed && prev) {
    return prev;
  }

    // Delivery-completed entries, tagged with their own logType and
    // stamped with delivered_at as their `created_at` so every existing
    // date-filter/sort/relative-time helper on this screen (all keyed on
    // `log.created_at`) works unmodified — the underlying release's own
    // created_at is still shown separately via its own 'release' log row.
    const deliveredLogs = (deliveriesResult.success ? deliveriesResult.data : [])
      .filter((d) => d.delivery_status === 'delivered')
      .map((d) => ({ ...d, logType: 'delivery', created_at: d.delivered_at }));

    // Daily report submissions and flagged discrepancies, same re-stamping
    // trick — these are historical activity entries (every report/
    // discrepancy, not just pending/open ones), so the ledger reads as a
    // complete record same as receiving/release/delivery.
    const reportLogs = (reportsResult.success ? reportsResult.data : []).map((r) => ({
      ...r,
      logType: 'report',
      created_at: r.reportDate,
    }));
    const discrepancyLogs = (discrepanciesResult.success ? discrepanciesResult.data : []).map((d) => ({
      ...d,
      logType: 'discrepancy',
      created_at: d.reportDate,
    }));

  const merged = [
    ...(logsResult.success ? logsResult.data : prev?.logs ?? []),
    ...deliveredLogs,
    ...reportLogs,
    ...discrepancyLogs,
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return {
    managerId: manager?.id,
    logs: merged,
    recipientNameById: agentsResult.success
      ? Object.fromEntries(agentsResult.data.map((a) => [a.id, a.full_name]))
      : prev?.recipientNameById ?? {},
  };
};

export default function StockLogsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { data: snapshot, isLoading } = useCachedFocusLoader('manager-stock-logs', loadLogsData);
  const logs = snapshot?.logs ?? [];
  const recipientNameById = snapshot?.recipientNameById ?? {};
  const [dateFilter, setDateFilter] = useState('all');
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);
  const [dateRange, setDateRange] = useState(null); // { from: Date, to: Date } | null

  const openDetail = (log) => {
    if (log.logType === 'report') {
      navigation.navigate('ManageReturns');
      return;
    }
    if (log.logType === 'discrepancy') {
      navigation.navigate('ManagerAlerts');
      return;
    }

    navigation.navigate('StockLogDetail', { log, recipientNameById });
  };

  // Jumped here from a tap on a Recent Logs row (Dashboard) — the row
  // already had the full log object from its own fetch, so open straight
  // to the detail screen instead of waiting for this screen's own list load.
  useEffect(() => {
    if (route.params?.initialLog) {
      openDetail(route.params.initialLog);
    }
  }, [route.params?.initialLog?.id]);

  const activeFilterOption = DATE_FILTER_OPTIONS.find((option) => option.key === dateFilter);

  // Same end-of-day treatment as NotificationsScreen's custom range: the
  // "To" date is a calendar-day pick (midnight), so compare against the end
  // of that day to include everything created on it, not just before 00:00.
  const matchesDateRange = (log) => {
    if (!dateRange?.from || !dateRange?.to) return true;
    const created = new Date(log.created_at);
    const endOfTo = new Date(dateRange.to);
    endOfTo.setHours(23, 59, 59, 999);
    return created >= dateRange.from && created <= endOfTo;
  };

  const filteredLogs = logs.filter((log) => activeFilterOption.test(log) && matchesDateRange(log));

  const getTitle = (log) => {
    if (log.logType === 'delivery') {
      const targetName = recipientNameById[log.target_recipient_id] || 'Sales Rep';
      return `Delivery Completed — ${targetName}`;
    }
    if (log.logType === 'report') {
      return `Daily Report — ${log.agentName || 'Sales Rep'}`;
    }
    if (log.logType === 'discrepancy') {
      return `Discrepancy Flagged — ${log.agentName || 'Sales Rep'}`;
    }
    return log.logType === 'release'
      ? `Stock Released${recipientNameById[log.received_by] ? ` — ${recipientNameById[log.received_by]}` : ''}`
      : 'Stock Received';
  };

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton
          title="Transaction Logs"
          titleAlign="left"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
        />

        <View style={styles.filterRow}>
          <Text style={styles.filterRowLabel}>
            {dateRange ? 'Custom range' : activeFilterOption.key === 'all' ? 'All Time' : activeFilterOption.label}
          </Text>
          <TouchableOpacity
            style={styles.filterButtonWrap}
            onPress={() => setIsFilterSheetVisible(true)}
            activeOpacity={0.7}
            accessibilityLabel="Filter by date"
            accessibilityRole="button"
          >
            <Icon name="filter" size={20} color={COLORS.primary} />
            {(dateFilter !== 'all' || dateRange) && <View style={styles.filterActiveDot} />}
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : logs.length === 0 ? (
          <View style={styles.loadingWrap}>
            <Icon name="trayDown" size={32} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No transactions yet.</Text>
          </View>
        ) : filteredLogs.length === 0 ? (
          <View style={styles.loadingWrap}>
            <Icon name="filter" size={32} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No transactions in this range.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {filteredLogs.map((log, index) => {
              const logKey =
                log.id ??
                (log.reportItemId ? `${log.reportId}-${log.reportItemId}` : null) ??
                log.reportId ??
                log.requestId ??
                log.transactionId ??
                index;
              const cardType =
                log.logType === 'report'
                  ? 'report'
                  : log.logType === 'discrepancy'
                  ? 'discrepancy'
                  : log.logType === 'delivery'
                  ? 'delivery'
                  : log.logType === 'release'
                  ? 'release'
                  : 'receive';
              const metaText = log.logType === 'report'
                ? `${(log.items || []).length} product${(log.items || []).length === 1 ? '' : 's'} reported`
                : log.logType === 'discrepancy'
                ? `${log.productName} — ${Math.abs(log.discrepancy)} ${log.discrepancyType === 'loss' ? 'missing' : 'over'}`
                : summarizeItems(getLogItems(log));
              return (
                <LogCard
                  key={`${log.logType}-${logKey}`}
                  type={cardType}
                  title={getTitle(log)}
                  meta={metaText}
                  time={formatRelativeTime(log.created_at)}
                  onPress={() => openDetail(log)}
                />
              );
            })}
            <View style={{ height: 24 }} />
          </ScrollView>
        )}
      </View>

      <FilterSheet
        visible={isFilterSheetVisible}
        onClose={() => setIsFilterSheetVisible(false)}
        title="Filter by Date"
        options={DATE_FILTER_OPTIONS.map(({ key, label }) => ({ key, label }))}
        selectedKey={dateFilter}
        onSelect={setDateFilter}
        clearKey="all"
        clearLabel="Clear filter"
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEEF1',
    backgroundColor: '#FFFFFF',
  },
  filterRowLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textSecondary,
  },
  filterButtonWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterActiveDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  content: { padding: SPACING.lg, gap: SPACING.xs },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
});
