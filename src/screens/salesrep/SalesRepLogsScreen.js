// src/screens/salesrep/SalesRepLogsScreen.js
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
import inventoryService from '../../services/inventoryService';
import requestService from '../../services/requestService';
import reportService from '../../services/reportService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { formatRelativeTime } from '../../utils/formatters';
import { useMarkLogsSeen } from '../../hooks/useUnseenLogCount';

const LOGS_LIMIT = 50;

// Same rolling-window filter shape as the Manager's StockLogsScreen.
const DATE_FILTER_OPTIONS = [
  { key: 'all', label: 'All Time', test: () => true },
  {
    key: 'today',
    label: 'Today',
    test: (log) => new Date(log.createdAt).toDateString() === new Date().toDateString(),
  },
  {
    key: 'week',
    label: 'This Week',
    test: (log) => (Date.now() - new Date(log.createdAt).getTime()) / 86400000 <= 7,
  },
  {
    key: 'month',
    label: 'This Month',
    test: (log) => (Date.now() - new Date(log.createdAt).getTime()) / 86400000 <= 30,
  },
];

function summarizeItems(items) {
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  return `${totalUnits} unit${totalUnits === 1 ? '' : 's'} · ${items.length} product${items.length === 1 ? '' : 's'}`;
}

const REQUEST_STATUS_META = {
  pending: { icon: 'clock', iconColor: COLORS.accentGold, label: 'Pending' },
  accepted: { icon: 'checkCircle', iconColor: COLORS.success, label: 'Accepted' },
  declined: { icon: 'xCircle', iconColor: COLORS.error, label: 'Declined' },
};

function getLogKey(log) {
  if (log.logType === 'request') return `request-${log.requestId}`;
  if (log.logType === 'delivery') return `delivery-${log.transactionId}`;
  if (log.logType === 'discrepancy') return `discrepancy-${log.reportItemId}`;
  return `acceptance-${log.acceptanceId}`;
}

// Returns the full logs snapshot. If any sub-fetch failed (e.g. offline),
// keeps the previous merged list entirely rather than rebuilding from a mix
// of fresh and missing pieces.
const loadLogsData = async (previous) => {
  const agent = await authService.getCurrentUser();
  const prev = previous?.agentId === agent?.id ? previous : null;
  const [logsResult, requestsResult, deliveriesResult, discrepanciesResult] = await Promise.all([
    inventoryService.getSrActivityLogs(agent?.id, LOGS_LIMIT),
    requestService.getMyStockRequests(agent?.id, LOGS_LIMIT),
    inventoryService.getMyDeliveries(agent?.id, LOGS_LIMIT),
    reportService.getMyDiscrepancies(agent?.id, 200),
  ]);

  const logsComplete =
    logsResult.success && requestsResult.success && deliveriesResult.success && discrepanciesResult.success;
  if (!logsComplete && prev) {
    return prev;
  }

  const deliveredIncoming = (deliveriesResult.success ? deliveriesResult.data : []).filter(
    (d) => d.deliveryStatus === 'delivered'
  );

  const merged = [
    ...(logsResult.success ? logsResult.data : []).map((log) => ({ ...log, logType: 'acceptance' })),
    ...(requestsResult.success ? requestsResult.data : []).map((log) => ({ ...log, logType: 'request' })),
    ...deliveredIncoming.map((d) => ({ ...d, logType: 'delivery', createdAt: d.deliveredAt })),
    ...(discrepanciesResult.success ? discrepanciesResult.data : []).map((d) => ({
      ...d,
      logType: 'discrepancy',
      createdAt: d.reportDate,
    })),
  ];
  merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return { agentId: agent?.id, logs: merged };
};

export default function SalesRepLogsScreen() {
  const route = useRoute();
  useMarkLogsSeen();
  const navigation = useNavigation();
  const { data: snapshot, isLoading } = useCachedFocusLoader('sales-rep-logs', loadLogsData);
  const logs = snapshot?.logs ?? [];
  const [dateFilter, setDateFilter] = useState('all');
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);

  const openDetail = (log) => {
    if (log.logType === 'discrepancy') {
      navigation.navigate('AlertsDiscrepanciesSR');
      return;
    }
    navigation.navigate('SalesRepLogDetail', { log });
  };

  // Jumped here from a tap on a Recent Logs row (Dashboard) — same pattern
  // as the Manager dashboard's jump into StockLogsScreen.
  useEffect(() => {
    if (route.params?.initialLog) {
      openDetail(route.params.initialLog);
    }
  }, [route.params?.initialLog && getLogKey(route.params.initialLog)]);

  const activeFilterOption = DATE_FILTER_OPTIONS.find((option) => option.key === dateFilter);
  const filteredLogs = logs.filter((log) => activeFilterOption.test(log));

  const getTitle = (log) => {
    if (log.logType === 'request') {
      const meta = REQUEST_STATUS_META[log.status] || REQUEST_STATUS_META.pending;
      return `Stock Request — ${meta.label}`;
    }
    if (log.logType === 'delivery') {
      return `Delivery Arrived — ${log.collectorName || 'Collector'}`;
    }
    if (log.logType === 'discrepancy') {
      return 'Discrepancy Flagged';
    }
    return log.releasedByName ? `Stock Accepted — ${log.releasedByName}` : 'Stock Accepted';
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
            {activeFilterOption.key === 'all' ? 'All Time' : activeFilterOption.label}
          </Text>
          <TouchableOpacity
            style={styles.filterButtonWrap}
            onPress={() => setIsFilterSheetVisible(true)}
            activeOpacity={0.7}
            accessibilityLabel="Filter by date"
            accessibilityRole="button"
          >
            <Icon name="filter" size={20} color={COLORS.primary} />
            {dateFilter !== 'all' && <View style={styles.filterActiveDot} />}
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : logs.length === 0 ? (
          <View style={styles.loadingWrap}>
            <Icon name="trayDown" size={32} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No activity yet.</Text>
          </View>
        ) : filteredLogs.length === 0 ? (
          <View style={styles.loadingWrap}>
            <Icon name="filter" size={32} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No transactions in this range.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {filteredLogs.map((log) => {
              const cardType =
                log.logType === 'discrepancy'
                  ? 'discrepancy'
                  : log.logType === 'request'
                  ? log.status === 'accepted'
                    ? 'requestAccepted'
                    : log.status === 'declined'
                    ? 'requestDeclined'
                    : 'requestPending'
                  : log.logType === 'delivery'
                  ? 'delivery'
                  : 'receive';
              const metaText =
                log.logType === 'discrepancy'
                  ? `${log.productName} — ${Math.abs(log.discrepancy)} ${log.discrepancyType === 'loss' ? 'missing' : 'over'}`
                  : summarizeItems(log.items || []);
              return (
                <LogCard
                  key={getLogKey(log)}
                  type={cardType}
                  title={getTitle(log)}
                  meta={metaText}
                  time={formatRelativeTime(log.createdAt)}
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
