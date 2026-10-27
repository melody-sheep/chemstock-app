// src/screens/salesrep/SalesRepBackpackScreen.js
// A Sales Rep's personal stock — what they have accepted and are carrying.
// Separate from the Stock tab, which shows the branch warehouse.
import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Animated, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import useCachedFocusLoader from '../../hooks/useCachedFocusLoader';
import useOutbox from '../../hooks/useOutbox';
import { queuedBackpackRows } from '../../utils/queuedReceipts';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import StockBatchCard from '../../components/common/StockBatchCard';
import StockSectionHeader from '../../components/common/StockSectionHeader';
import CustomModal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import SkeletonBlock from '../../components/ui/SkeletonBlock';
import Icon from '../../components/common/Icon';
import authService from '../../services/authService';
import inventoryService from '../../services/inventoryService';
import reportService from '../../services/reportService';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import { STOCK_HEALTHY_THRESHOLD, NEAR_EXPIRY_DAYS } from '../../constants/inventory';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { daysUntil } from '../../utils/formatters';
import { isExpired } from '../../utils/expiry';

const BANNER_HEIGHT = 76;

// Same filters and sorting as the Manager stock screen; they work on the batches already loaded.
const EXPIRY_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'nearExpiry', label: 'Near expiry' },
  { key: 'expired', label: 'Expired' },
];
const LEVEL_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'healthy', label: 'In-stock' },
  { key: 'low', label: 'Almost out' },
];
const SORT_OPTIONS = [
  { key: 'default', label: 'Soonest expiry' },
  { key: 'qtyDesc', label: 'Most stock' },
  { key: 'qtyAsc', label: 'Least stock' },
  { key: 'nameAsc', label: 'Name A–Z' },
];
const EXPIRY_LABELS = { nearExpiry: 'Near expiry', expired: 'Expired' };
const LEVEL_LABELS = { healthy: 'In-stock only', low: 'Almost out only' };
const SORT_LABELS = { qtyDesc: 'Most stock first', qtyAsc: 'Least stock first', nameAsc: 'Name A–Z' };

// Returns the full backpack snapshot. A request that fails keeps its value
// from the previous snapshot instead of blanking the screen — same pattern
// SalesRepStockScreen/the dashboards already use.
export const loadBackpackData = async (previous) => {
  const currentAgent = await authService.getCurrentUser();
  const prev = previous?.agent?.id === currentAgent?.id ? previous : null;

  const [result, discrepanciesResult] = await Promise.all([
    inventoryService.getSrInventory(currentAgent?.id),
    reportService.getMyDiscrepancies(currentAgent?.id, 50),
  ]);
  const carryForwardItems = discrepanciesResult.success
    ? discrepanciesResult.data.filter((item) => item.carryForwardEnabled && item.resolutionStatus === 'open' && item.discrepancy < 0)
    : null;

  return {
    agent: currentAgent,
    items: result.success ? result.data.filter((row) => row.remaining_quantity > 0) : prev?.items ?? [],
    carryForwardUnits: carryForwardItems
      ? carryForwardItems.reduce((sum, item) => sum + Math.abs(item.discrepancy), 0)
      : prev?.carryForwardUnits ?? 0,
  };
};

export default function SalesRepBackpackScreen() {
  const navigation = useNavigation();
  const { data: snapshot, isLoading, refreshControlAt } = useCachedFocusLoader('sales-rep-backpack', loadBackpackData);
  const agent = snapshot?.agent ?? null;
  // Stock received offline shows here right away, counted in the total.
  const { pending: queuedEntries } = useOutbox();
  const items = [...queuedBackpackRows(queuedEntries, agent?.id), ...(snapshot?.items ?? [])];

  const totalUnits = items.reduce((sum, row) => sum + row.remaining_quantity, 0);

  const [searchText, setSearchText] = useState('');
  const [expiryFilter, setExpiryFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);

  // The search block slides away when you scroll down and comes back when you scroll up. It floats
  // over the list (the list keeps room for it at the top), so nothing resizes while you scroll.
  const [headerHeight, setHeaderHeight] = useState(0);
  const headerProgress = useRef(new Animated.Value(0)).current; // 0 shown, 1 hidden
  const headerHidden = useRef(false);
  const lastScrollY = useRef(0);
  const setHeaderHidden = (hide) => {
    if (headerHidden.current === hide) return;
    headerHidden.current = hide;
    Animated.timing(headerProgress, { toValue: hide ? 1 : 0, duration: 50, useNativeDriver: true }).start();
  };
  const handleListScroll = (event) => {
    const y = event.nativeEvent.contentOffset.y;
    const delta = y - lastScrollY.current;
    lastScrollY.current = y;
    if (y <= 8) {
      setHeaderHidden(false);
    } else if (delta > 6 && y > headerHeight) {
      setHeaderHidden(true);
    } else if (delta < -6) {
      setHeaderHidden(false);
    }
  };
  const headerTranslateY = headerProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -headerHeight] });

  const query = searchText.trim().toLowerCase();
  const matchesQuery = (row) =>
    !query || row.product_name.toLowerCase().includes(query) || row.product_code.toLowerCase().includes(query);
  const matchesExpiryFilter = (row) => {
    if (expiryFilter === 'expired') return isExpired(row.exp_date);
    if (expiryFilter !== 'nearExpiry') return true;
    const daysLeft = daysUntil(row.exp_date);
    return daysLeft !== null && daysLeft <= NEAR_EXPIRY_DAYS;
  };
  // "default" keeps the order the batches arrive in (soonest expiry first).
  const sortBatches = (rows) => {
    if (sortBy === 'qtyDesc') return [...rows].sort((a, b) => b.remaining_quantity - a.remaining_quantity);
    if (sortBy === 'qtyAsc') return [...rows].sort((a, b) => a.remaining_quantity - b.remaining_quantity);
    if (sortBy === 'nameAsc') return [...rows].sort((a, b) => a.product_name.localeCompare(b.product_name));
    return rows;
  };
  const hasActiveFilters = expiryFilter !== 'all' || levelFilter !== 'all' || sortBy !== 'default';
  const resetFilters = () => {
    setExpiryFilter('all');
    setLevelFilter('all');
    setSortBy('default');
  };
  const showHealthy = levelFilter === 'all' || levelFilter === 'healthy';
  const showLow = levelFilter === 'all' || levelFilter === 'low';

  const visible = items.filter((row) => matchesQuery(row) && matchesExpiryFilter(row));
  const healthyItems = sortBatches(visible.filter((row) => row.remaining_quantity >= STOCK_HEALTHY_THRESHOLD));
  const lowItems = sortBatches(visible.filter((row) => row.remaining_quantity < STOCK_HEALTHY_THRESHOLD));

  const renderRow = (rows, tone) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardScroll} contentContainerStyle={styles.cardRow}>
      {rows.map((row) => (
        <StockBatchCard
          key={row.id}
          tone={tone}
          productName={row.product_name}
          image={PRODUCT_CATALOG.find((p) => p.code === row.product_code)?.image}
          quantity={row.remaining_quantity}
          batchNumber={row.batch_number}
          expDate={row.exp_date}
          statusLabel={row.isQueued ? 'Received — waiting to send' : null}
        />
      ))}
    </ScrollView>
  );

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          title="My Backpack"
          titleAlign="left"
          showBackButton
          backButtonText="Back"
          onBackPress={() => navigation.goBack()}
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
        />

        <SecondaryHeader height={BANNER_HEIGHT}>
          <View style={styles.bannerRow}>
            <View style={styles.bannerTextCol}>
              <Text style={styles.bannerName} numberOfLines={1}>
                {agent?.full_name || agent?.username || ''}
              </Text>
              <Text style={styles.bannerSubtitle}>Personal Inventory</Text>
            </View>
            <View style={styles.totalPill}>
              <Icon name="backpack" size={16} color="#D98200" weight="duotone" />
              <Text style={styles.totalText}>
                {totalUnits} unit{totalUnits === 1 ? '' : 's'}
              </Text>
            </View>
          </View>
        </SecondaryHeader>

        <View style={styles.listArea}>
          <ScrollView
            refreshControl={refreshControlAt(headerHeight)}
            contentContainerStyle={[styles.content, { paddingTop: headerHeight + SPACING.sm }]}
            onScroll={handleListScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
          >
            {isLoading ? (
              <View style={styles.skeletonRow}>
                <SkeletonBlock width={152} height={200} borderRadius={14} />
                <SkeletonBlock width={152} height={200} borderRadius={14} />
              </View>
            ) : (
              <>
                {(snapshot?.carryForwardUnits ?? 0) > 0 && (
                  <View style={styles.carryForwardNotice}>
                    <Icon name="info" size={16} color="#8A5A00" />
                    <Text style={styles.carryForwardNoticeText}>
                      {snapshot.carryForwardUnits} unreported unit{snapshot.carryForwardUnits === 1 ? '' : 's'} remain in your inventory for the next report.
                    </Text>
                  </View>
                )}
                {items.length === 0 ? (
                  <View style={styles.emptyWrap}>
                    <View style={styles.emptyIconCircle}>
                      <Icon name="backpack" size={30} color="#D98200" weight="duotone" />
                    </View>
                    <Text style={styles.emptyTitle}>Your backpack is empty</Text>
                    <Text style={styles.emptyText}>Stock you receive from your manager or a collector shows up here.</Text>
                  </View>
                ) : (
                  <>
                    {showHealthy && (
                      <>
                        <StockSectionHeader
                          dotColor={COLORS.success}
                          label="In-Stock"
                          count={healthyItems.length}
                          tooltip="Batches in your backpack with plenty of units left."
                        />
                        {healthyItems.length > 0 ? (
                          renderRow(healthyItems, 'healthy')
                        ) : (
                          <View style={styles.emptyBox}><Text style={styles.emptyText}>No batches at healthy levels right now.</Text></View>
                        )}
                      </>
                    )}

                    {showLow && (
                      <>
                        <StockSectionHeader
                          dotColor={COLORS.warning}
                          label="Almost Out"
                          count={lowItems.length}
                          tooltip="Batches in your backpack that are running low."
                          style={styles.sectionSpacing}
                        />
                        {lowItems.length > 0 ? (
                          renderRow(lowItems, 'low')
                        ) : (
                          <View style={styles.emptyBox}><Text style={styles.emptyText}>Nothing running low right now.</Text></View>
                        )}
                      </>
                    )}
                  </>
                )}
              </>
            )}
            <View style={{ height: 24 }} />
          </ScrollView>

        <Animated.View
          style={[styles.stockHeaderStatic, { transform: [{ translateY: headerTranslateY }] }]}
          onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
        >
          <View style={styles.searchRow}>
            <View style={styles.searchField}>
              <Icon name="search" size={18} color={COLORS.textSecondary} />
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Search products"
                placeholderTextColor={COLORS.textTertiary}
                style={styles.searchInput}
                returnKeyType="search"
                autoCorrect={false}
                accessibilityLabel="Search products"
              />
              {searchText.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchText('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <Icon name="xCircle" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={styles.filterButtonWrap}
              onPress={() => setIsFilterSheetVisible(true)}
              activeOpacity={0.8}
              accessibilityLabel="Filters"
              accessibilityRole="button"
            >
              <Icon name="filter" size={20} color="#FFFFFF" />
              {hasActiveFilters && <View style={styles.filterActiveDot} />}
            </TouchableOpacity>
          </View>

          {hasActiveFilters && (
            <View style={styles.activeFilterRow}>
              {expiryFilter !== 'all' && (
                <View style={styles.activeFilterChip}>
                  <Text style={styles.activeFilterChipText}>{EXPIRY_LABELS[expiryFilter]}</Text>
                  <TouchableOpacity onPress={() => setExpiryFilter('all')} accessibilityLabel="Clear expiry filter" accessibilityRole="button">
                    <Icon name="xCircle" size={16} color={COLORS.error} weight="fill" />
                  </TouchableOpacity>
                </View>
              )}
              {levelFilter !== 'all' && (
                <View style={styles.activeFilterChip}>
                  <Text style={styles.activeFilterChipText}>{LEVEL_LABELS[levelFilter]}</Text>
                  <TouchableOpacity onPress={() => setLevelFilter('all')} accessibilityLabel="Clear stock level filter" accessibilityRole="button">
                    <Icon name="xCircle" size={16} color={COLORS.error} weight="fill" />
                  </TouchableOpacity>
                </View>
              )}
              {sortBy !== 'default' && (
                <View style={styles.activeFilterChip}>
                  <Text style={styles.activeFilterChipText}>{SORT_LABELS[sortBy]}</Text>
                  <TouchableOpacity onPress={() => setSortBy('default')} accessibilityLabel="Clear sorting" accessibilityRole="button">
                    <Icon name="xCircle" size={16} color={COLORS.error} weight="fill" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </Animated.View>

        </View>
      </View>

      <CustomModal visible={isFilterSheetVisible} onClose={() => setIsFilterSheetVisible(false)} height="auto">
        <View style={styles.sheetHeaderRow}>
          <Text style={styles.sheetTitle}>Filter & sort</Text>
          {hasActiveFilters && (
            <TouchableOpacity onPress={resetFilters} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.sheetReset}>Reset</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.sheetLabel}>EXPIRY</Text>
        <View style={styles.optionRow}>
          {EXPIRY_OPTIONS.map((option) => {
            const isActive = option.key === expiryFilter;
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.optionChip, isActive && styles.optionChipActive]}
                onPress={() => setExpiryFilter(option.key)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <Text style={[styles.optionChipText, isActive && styles.optionChipTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sheetLabel}>STOCK LEVEL</Text>
        <View style={styles.optionRow}>
          {LEVEL_OPTIONS.map((option) => {
            const isActive = option.key === levelFilter;
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.optionChip, isActive && styles.optionChipActive]}
                onPress={() => setLevelFilter(option.key)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <Text style={[styles.optionChipText, isActive && styles.optionChipTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sheetLabel}>SORT BY</Text>
        <View style={styles.optionRow}>
          {SORT_OPTIONS.map((option) => {
            const isActive = option.key === sortBy;
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.optionChip, isActive && styles.optionChipActive]}
                onPress={() => setSortBy(option.key)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <Text style={[styles.optionChipText, isActive && styles.optionChipTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Button
          title="Done"
          variant="black"
          onPress={() => setIsFilterSheetVisible(false)}
          height={48}
          fontSize={16}
          borderRadius={24}
          style={styles.sheetDone}
        />
      </CustomModal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  bannerRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
  },
  bannerTextCol: { flexShrink: 1 },
  bannerName: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  bannerSubtitle: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  totalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '12',
  },
  totalText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.primary,
  },
  listArea: { flex: 1, overflow: 'hidden' },
  // Floats at the top of the list with a solid background, so cards pass cleanly under it.
  stockHeaderStatic: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: SPACING.xs,
    backgroundColor: COLORS.background,
    zIndex: 2,
    elevation: 2,
  },
  branchChipsWrap: { paddingHorizontal: SPACING.md },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  searchField: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#D5DAE3',
    backgroundColor: '#FFFFFF',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 0,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textPrimary,
  },
  filterButtonWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterActiveDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
  },
  activeFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  activeFilterChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.error + '55',
    backgroundColor: '#FDECEC',
  },
  activeFilterChipText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.error,
  },
  sheetHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.xs },
  sheetTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  sheetReset: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.error,
  },
  sheetLabel: {
    marginTop: SPACING.md,
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textTertiary,
    letterSpacing: 0.8,
  },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm },
  optionChip: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: '#D5DAE3',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionChipActive: { borderColor: '#0085F9', backgroundColor: '#EAF4FF' },
  optionChipText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
  },
  optionChipTextActive: {
    color: '#0085F9',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  sheetDone: { marginTop: SPACING.lg },
  cardScroll: { marginHorizontal: -SPACING.lg, marginTop: SPACING.sm },
  emptyBox: {
    marginTop: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
  },
  content: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: 96 },
  sectionSpacing: { marginTop: SPACING.md },
  carryForwardNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    marginBottom: SPACING.sm,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#F4D28B',
    backgroundColor: '#FFF7E6',
  },
  carryForwardNoticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: '#8A5A00',
  },
  cardRow: { gap: SPACING.sm, paddingHorizontal: SPACING.lg },
  skeletonRow: { flexDirection: 'row', gap: SPACING.sm },
  emptyWrap: { alignItems: 'center', paddingTop: SPACING.xl * 2, gap: SPACING.xs, paddingHorizontal: SPACING.lg },
  emptyIconCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#FFF1D6', alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.xs },
  emptyTitle: { fontSize: TYPOGRAPHY.fontSize.base, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: TYPOGRAPHY.fontWeight.bold, color: '#272632' },
  emptyText: {
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
});
