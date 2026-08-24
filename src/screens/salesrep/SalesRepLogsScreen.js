// src/screens/salesrep/SalesRepLogsScreen.js
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import Header from '../../components/common/Header';
import CustomModal from '../../components/common/Modal';
import Icon from '../../components/common/Icon';
import FilterSheet from '../../components/common/FilterSheet';
import SaveableQRCode from '../../components/common/SaveableQRCode';
import authService from '../../services/authService';
import inventoryService from '../../services/inventoryService';
import requestService from '../../services/requestService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { formatRelativeTime } from '../../utils/formatters';

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
  return log.logType === 'request' ? `request-${log.requestId}` : `acceptance-${log.acceptanceId}`;
}

export default function SalesRepLogsScreen() {
  const route = useRoute();
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [isPhotoLoading, setIsPhotoLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    const agent = await authService.getCurrentUser();
    const [logsResult, requestsResult] = await Promise.all([
      inventoryService.getSrActivityLogs(agent?.id, LOGS_LIMIT),
      requestService.getMyStockRequests(agent?.id, LOGS_LIMIT),
    ]);

    const merged = [
      ...(logsResult.success ? logsResult.data : []).map((log) => ({ ...log, logType: 'acceptance' })),
      ...(requestsResult.success ? requestsResult.data : []).map((log) => ({ ...log, logType: 'request' })),
    ];
    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setLogs(merged);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLogs();
    }, [loadLogs])
  );

  const openDetail = async (log) => {
    setSelectedLog(log);
    setPhotoUrl(null);

    if (log.media?.storagePath) {
      setIsPhotoLoading(true);
      const url = await inventoryService.getShipmentPhotoUrl(log.media.storagePath);
      setPhotoUrl(url);
      setIsPhotoLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedLog(null);
    setPhotoUrl(null);
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
    return log.releasedByName ? `Stock Accepted — ${log.releasedByName}` : 'Stock Accepted';
  };

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton
          backButtonText="Sales Rep Dashboard"
          title="Transaction Logs"
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
            {filteredLogs.map((log) => (
              <TouchableOpacity
                key={getLogKey(log)}
                style={styles.logCard}
                onPress={() => openDetail(log)}
                activeOpacity={0.7}
              >
                <View style={styles.logIconBadge}>
                  <Icon
                    name={log.logType === 'request' ? (REQUEST_STATUS_META[log.status] || REQUEST_STATUS_META.pending).icon : 'trayDown'}
                    size={18}
                    color={log.logType === 'request' ? (REQUEST_STATUS_META[log.status] || REQUEST_STATUS_META.pending).iconColor : COLORS.primary}
                    weight="duotone"
                  />
                </View>
                <View style={styles.logTextCol}>
                  <Text style={styles.logTitle}>{getTitle(log)}</Text>
                  <Text style={styles.logMeta}>{summarizeItems(log.items || [])}</Text>
                </View>
                <Text style={styles.logTime}>{formatRelativeTime(log.createdAt)}</Text>
              </TouchableOpacity>
            ))}
            <View style={{ height: 24 }} />
          </ScrollView>
        )}
      </View>

      <CustomModal visible={!!selectedLog} onClose={closeDetail} height={560}>
        {selectedLog && (
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.detailTitle}>{getTitle(selectedLog)}</Text>
            <Text style={styles.detailSubtitle}>
              {new Date(selectedLog.createdAt).toLocaleString()}
            </Text>

            {selectedLog.logType === 'request' && selectedLog.status === 'declined' && selectedLog.declineReason && (
              <View style={styles.declineBanner}>
                <Icon name="warningTriangle" size={16} color={COLORS.error} />
                <Text style={styles.declineText}>{selectedLog.declineReason}</Text>
              </View>
            )}

            <Text style={styles.detailSectionLabel}>Items</Text>
            <View style={styles.itemsCard}>
              {(selectedLog.items || []).map((item, index) => (
                <View key={`${item.productCode}-${index}`} style={[styles.itemRow, index === 0 && styles.itemRowFirst]}>
                  <Text style={styles.itemName}>{item.productName}</Text>
                  <Text style={styles.itemMeta}>
                    Qty: {item.quantity}
                    {item.mfgDate ? `   Mfg: ${new Date(item.mfgDate).toLocaleDateString()}` : ''}
                    {item.expDate ? `   Exp: ${new Date(item.expDate).toLocaleDateString()}` : ''}
                  </Text>
                </View>
              ))}
            </View>

            <Text style={styles.detailSectionLabel}>Details</Text>
            <View style={styles.metaCard}>
              {(selectedLog.logType === 'request' ? selectedLog.latitude != null : selectedLog.gps) && (
                <View style={styles.metaRow}>
                  <Icon name="location" size={16} color={COLORS.error} />
                  <Text style={styles.metaText}>
                    {selectedLog.logType === 'request'
                      ? `${selectedLog.latitude.toFixed(5)}, ${selectedLog.longitude.toFixed(5)}`
                      : `${selectedLog.gps.latitude.toFixed(5)}, ${selectedLog.gps.longitude.toFixed(5)}`}
                  </Text>
                </View>
              )}
              {selectedLog.branchName && (
                <View style={styles.metaRow}>
                  <Icon name="building" size={16} color={COLORS.primary} />
                  <Text style={styles.metaText}>{selectedLog.branchName}</Text>
                </View>
              )}
              {(selectedLog.logType === 'request' ? selectedLog.deviceModel : selectedLog.media?.deviceModel) && (
                <View style={styles.metaRow}>
                  <Icon name="package" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.metaText}>
                    {selectedLog.logType === 'request'
                      ? [selectedLog.deviceModel, selectedLog.deviceOs].filter(Boolean).join(' - ')
                      : [selectedLog.media.deviceModel, selectedLog.media.deviceOs].filter(Boolean).join(' - ')}
                  </Text>
                </View>
              )}
            </View>

            {selectedLog.logType !== 'request' && (
              <>
                <Text style={styles.detailSectionLabel}>Release QR Code</Text>
                <SaveableQRCode value={selectedLog.qrCode} size={180} style={styles.qrCard} />

                {selectedLog.media?.storagePath && (
                  <>
                    <Text style={styles.detailSectionLabel}>Acceptance Proof</Text>
                    {isPhotoLoading ? (
                      <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: SPACING.md }} />
                    ) : photoUrl ? (
                      <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" />
                    ) : (
                      <Text style={styles.emptyText}>Photo unavailable.</Text>
                    )}
                  </>
                )}
              </>
            )}

            <View style={{ height: 24 }} />
          </ScrollView>
        )}
      </CustomModal>

      <FilterSheet
        visible={isFilterSheetVisible}
        onClose={() => setIsFilterSheetVisible(false)}
        title="Filter by Date"
        options={DATE_FILTER_OPTIONS.map(({ key, label }) => ({ key, label }))}
        selectedKey={dateFilter}
        onSelect={setDateFilter}
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
    borderBottomColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
  },
  filterRowLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textSecondary,
  },
  filterButtonWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: '#757575',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7FEFF',
  },
  filterActiveDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
  },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  content: { padding: SPACING.lg, gap: SPACING.sm },
  logCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    padding: SPACING.sm,
  },
  logIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logTextCol: { flex: 1 },
  logTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  logMeta: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  logTime: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textTertiary,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  detailTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  detailSubtitle: {
    marginTop: 2,
    marginBottom: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  declineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.error + '30',
    backgroundColor: COLORS.error + '0D',
    marginBottom: SPACING.md,
  },
  declineText: {
    flex: 1,
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.error,
  },
  detailSectionLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: '#272632',
    marginBottom: SPACING.xs,
  },
  itemsCard: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  itemRow: {
    padding: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  itemRowFirst: { borderTopWidth: 0 },
  itemName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  itemMeta: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  metaCard: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: SPACING.sm,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  metaText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: '#272632',
  },
  qrCard: {
    marginBottom: SPACING.md,
  },
  photo: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
});
