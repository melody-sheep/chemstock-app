// src/screens/manager/StockLogsScreen.js
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
import agentService from '../../services/agentService';
import inventoryService from '../../services/inventoryService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { formatRelativeTime } from '../../utils/formatters';

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

// Receiving (branch_inventory, "received_quantity") and release/delivery
// (transaction_details, "quantity") logs have different embed shapes —
// normalize all to the same {name, qty, mfgDate, expDate} so the rest of
// this screen doesn't need to know which type it's rendering.
function getLogItems(log) {
  if (log.logType === 'release' || log.logType === 'delivery') {
    return (log.transaction_details || []).map((item) => ({
      key: item.batch_number,
      name: item.product_name,
      qty: item.quantity,
      mfgDate: item.mfg_date,
      expDate: item.exp_date,
    }));
  }
  return (log.branch_inventory || []).map((item) => ({
    key: item.batch_number,
    name: item.product_name,
    qty: item.received_quantity,
    mfgDate: item.mfg_date,
    expDate: item.exp_date,
  }));
}

// Receiving logs still embed a single `gps_coordinates`. Release logs embed
// `origin_gps`/`destination_gps` (transactions has two FKs into
// gps_coordinates as of the Collector-delivery migration, so the query needs
// named embeds — see inventoryService.getReleaseLogs) — this surfaces the
// origin point, matching what this detail sheet showed before that
// migration. A delivery-completed entry surfaces the destination instead,
// since that's the point relevant to "where did this actually end up."
function getLogGps(log) {
  if (log.logType === 'delivery') return log.destination_gps;
  return log.logType === 'release' ? log.origin_gps : log.gps_coordinates;
}

function summarizeItems(items) {
  const totalUnits = items.reduce((sum, item) => sum + item.qty, 0);
  return `${totalUnits} unit${totalUnits === 1 ? '' : 's'} · ${items.length} product${items.length === 1 ? '' : 's'}`;
}

export default function StockLogsScreen() {
  const route = useRoute();
  const [logs, setLogs] = useState([]);
  const [recipientNameById, setRecipientNameById] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [isPhotoLoading, setIsPhotoLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    const manager = await authService.getCurrentUser();
    const branchIds = manager?.branchIds || [];
    const [logsResult, agentsResult, deliveriesResult] = await Promise.all([
      inventoryService.getActivityLogs(branchIds, LOGS_LIMIT),
      agentService.getMyAgentAccounts(),
      inventoryService.getDeliveries(branchIds, LOGS_LIMIT),
    ]);

    // Delivery-completed entries, tagged with their own logType and
    // stamped with delivered_at as their `created_at` so every existing
    // date-filter/sort/relative-time helper on this screen (all keyed on
    // `log.created_at`) works unmodified — the underlying release's own
    // created_at is still shown separately via its own 'release' log row.
    const deliveredLogs = (deliveriesResult.success ? deliveriesResult.data : [])
      .filter((d) => d.delivery_status === 'delivered')
      .map((d) => ({ ...d, logType: 'delivery', created_at: d.delivered_at }));

    const merged = [...(logsResult.success ? logsResult.data : []), ...deliveredLogs].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    setLogs(merged);

    if (agentsResult.success) {
      setRecipientNameById(Object.fromEntries(agentsResult.data.map((a) => [a.id, a.full_name])));
    }
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

    if (log.media?.storage_path) {
      setIsPhotoLoading(true);
      const url = await inventoryService.getShipmentPhotoUrl(log.media.storage_path);
      setPhotoUrl(url);
      setIsPhotoLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedLog(null);
    setPhotoUrl(null);
  };

  // Jumped here from a tap on a Recent Logs row (Dashboard) — the row
  // already had the full log object from its own fetch, so open straight
  // to the detail sheet instead of waiting for this screen's own list load.
  useEffect(() => {
    if (route.params?.initialLog) {
      openDetail(route.params.initialLog);
    }
  }, [route.params?.initialLog?.id]);

  const activeFilterOption = DATE_FILTER_OPTIONS.find((option) => option.key === dateFilter);
  const filteredLogs = logs.filter((log) => activeFilterOption.test(log));

  const getTitle = (log) => {
    if (log.logType === 'delivery') {
      const targetName = recipientNameById[log.target_recipient_id] || 'Sales Rep';
      return `Delivery Completed — ${targetName}`;
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
            <Text style={styles.emptyText}>No transactions yet.</Text>
          </View>
        ) : filteredLogs.length === 0 ? (
          <View style={styles.loadingWrap}>
            <Icon name="filter" size={32} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No transactions in this range.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {filteredLogs.map((log) => {
              const items = getLogItems(log);
              const isRelease = log.logType === 'release';
              const isDelivery = log.logType === 'delivery';
              return (
                <TouchableOpacity
                  key={`${log.logType}-${log.id}`}
                  style={styles.logCard}
                  onPress={() => openDetail(log)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.logIconBadge, (isRelease || isDelivery) && styles.logIconBadgeRelease]}>
                    <Icon
                      name={isDelivery ? 'checkCircle' : isRelease ? 'trayUp' : 'trayDown'}
                      size={18}
                      color={isRelease || isDelivery ? COLORS.success : COLORS.primary}
                      weight="duotone"
                    />
                  </View>
                  <View style={styles.logTextCol}>
                    <Text style={styles.logTitle}>{getTitle(log)}</Text>
                    <Text style={styles.logMeta}>{summarizeItems(items)}</Text>
                  </View>
                  <Text style={styles.logTime}>{formatRelativeTime(log.created_at)}</Text>
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 24 }} />
          </ScrollView>
        )}
      </View>

      <CustomModal visible={!!selectedLog} onClose={closeDetail} height={560}>
        {selectedLog && (
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.detailTitle}>{getTitle(selectedLog)}</Text>
            <Text style={styles.detailSubtitle}>
              {new Date(selectedLog.created_at).toLocaleString()}
            </Text>

            <Text style={styles.detailSectionLabel}>Items</Text>
            <View style={styles.itemsCard}>
              {getLogItems(selectedLog).map((item, index) => (
                <View key={`${item.key}-${index}`} style={[styles.itemRow, index === 0 && styles.itemRowFirst]}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemMeta}>
                    Qty: {item.qty}
                    {item.mfgDate ? `   Mfg: ${new Date(item.mfgDate).toLocaleDateString()}` : ''}
                    {item.expDate ? `   Exp: ${new Date(item.expDate).toLocaleDateString()}` : ''}
                  </Text>
                </View>
              ))}
            </View>

            <Text style={styles.detailSectionLabel}>Details</Text>
            <View style={styles.metaCard}>
              {getLogGps(selectedLog) && (
                <View style={styles.metaRow}>
                  <Icon name="location" size={16} color={COLORS.error} />
                  <Text style={styles.metaText}>
                    {getLogGps(selectedLog).latitude.toFixed(5)}, {getLogGps(selectedLog).longitude.toFixed(5)}
                  </Text>
                </View>
              )}
              {selectedLog.media?.device_model && (
                <View style={styles.metaRow}>
                  <Icon name="package" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.metaText}>
                    {[selectedLog.media.device_model, selectedLog.media.device_os].filter(Boolean).join(' - ')}
                  </Text>
                </View>
              )}
            </View>

            {selectedLog.logType !== 'delivery' && (
              <>
                <Text style={styles.detailSectionLabel}>
                  {selectedLog.logType === 'release' ? 'Release QR Code' : 'Shipment QR Code'}
                </Text>
                <SaveableQRCode value={selectedLog.qr_code} size={180} style={styles.qrCard} />

                {selectedLog.media?.storage_path && (
                  <>
                    <Text style={styles.detailSectionLabel}>
                      {selectedLog.logType === 'release' ? 'Release Proof' : 'Shipment Proof'}
                    </Text>
                    {isPhotoLoading ? (
                      <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: SPACING.md }} />
                    ) : photoUrl ? (
                      <Image
                        source={{ uri: photoUrl }}
                        style={styles.photo}
                        resizeMode="cover"
                        onError={(e) =>
                          console.error('[ERROR] [StockLogsScreen] Image failed to load:', e.nativeEvent?.error, photoUrl)
                        }
                      />
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
  logIconBadgeRelease: {
    backgroundColor: COLORS.success + '15',
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
