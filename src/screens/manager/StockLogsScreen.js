// src/screens/manager/StockLogsScreen.js
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import Header from '../../components/common/Header';
import CustomModal from '../../components/common/Modal';
import Icon from '../../components/common/Icon';
import FilterSheet from '../../components/common/FilterSheet';
import authService from '../../services/authService';
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

function summarizeItems(items) {
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  return `${totalUnits} unit${totalUnits === 1 ? '' : 's'} · ${items.length} product${items.length === 1 ? '' : 's'}`;
}

export default function StockLogsScreen() {
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
    const manager = await authService.getCurrentUser();
    const result = await inventoryService.getReceivingLogs(manager?.branchIds || [], LOGS_LIMIT);
    setLogs(result.success ? result.data : []);
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
    console.log('🖼️ [StockLogsScreen] media on this log:', log.media);

    if (log.media?.storage_path) {
      setIsPhotoLoading(true);
      const url = await inventoryService.getShipmentPhotoUrl(log.media.storage_path);
      console.log('🖼️ [StockLogsScreen] resolved signed URL:', url);
      setPhotoUrl(url);
      setIsPhotoLoading(false);
    } else {
      console.log('🖼️ [StockLogsScreen] no media/storage_path on this log — skipping photo fetch');
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

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton
          backButtonText="Manager Dashboard"
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
            <Text style={styles.emptyText}>No receiving transactions yet.</Text>
          </View>
        ) : filteredLogs.length === 0 ? (
          <View style={styles.loadingWrap}>
            <Icon name="filter" size={32} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No transactions in this range.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {filteredLogs.map((log) => {
              const items = log.branch_inventory || [];
              return (
                <TouchableOpacity
                  key={log.id}
                  style={styles.logCard}
                  onPress={() => openDetail(log)}
                  activeOpacity={0.7}
                >
                  <View style={styles.logIconBadge}>
                    <Icon name="trayDown" size={18} color={COLORS.primary} weight="duotone" />
                  </View>
                  <View style={styles.logTextCol}>
                    <Text style={styles.logTitle}>Stock Received</Text>
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
            <Text style={styles.detailTitle}>Stock Received</Text>
            <Text style={styles.detailSubtitle}>
              {new Date(selectedLog.created_at).toLocaleString()}
            </Text>

            <Text style={styles.detailSectionLabel}>Items</Text>
            <View style={styles.itemsCard}>
              {(selectedLog.branch_inventory || []).map((item, index) => (
                <View
                  key={`${item.batch_number}-${index}`}
                  style={[styles.itemRow, index === 0 && styles.itemRowFirst]}
                >
                  <Text style={styles.itemName}>{item.product_name}</Text>
                  <Text style={styles.itemMeta}>
                    Qty: {item.quantity}
                    {item.mfg_date ? `   Mfg: ${new Date(item.mfg_date).toLocaleDateString()}` : ''}
                    {item.exp_date ? `   Exp: ${new Date(item.exp_date).toLocaleDateString()}` : ''}
                  </Text>
                </View>
              ))}
            </View>

            <Text style={styles.detailSectionLabel}>Details</Text>
            <View style={styles.metaCard}>
              {selectedLog.gps_coordinates && (
                <View style={styles.metaRow}>
                  <Icon name="location" size={16} color={COLORS.error} />
                  <Text style={styles.metaText}>
                    {selectedLog.gps_coordinates.latitude.toFixed(5)}, {selectedLog.gps_coordinates.longitude.toFixed(5)}
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
              <View style={styles.metaRow}>
                <Icon name="qrCode" size={16} color={COLORS.primary} />
                <Text style={styles.metaText}>{selectedLog.qr_code}</Text>
              </View>
            </View>

            {selectedLog.media?.storage_path && (
              <>
                <Text style={styles.detailSectionLabel}>Shipment Proof</Text>
                {isPhotoLoading ? (
                  <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: SPACING.md }} />
                ) : photoUrl ? (
                  <Image
                    source={{ uri: photoUrl }}
                    style={styles.photo}
                    resizeMode="cover"
                    onError={(e) =>
                      console.error('❌ [StockLogsScreen] Image failed to load:', e.nativeEvent?.error, photoUrl)
                    }
                  />
                ) : (
                  <Text style={styles.emptyText}>Photo unavailable.</Text>
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
  photo: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
});
