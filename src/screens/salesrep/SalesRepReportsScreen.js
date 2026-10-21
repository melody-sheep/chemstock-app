// src/screens/salesrep/SalesRepReportsScreen.js
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, ScrollView, Pressable, ActivityIndicator, Animated, StyleSheet } from 'react-native';
import Alert from '../../utils/appAlert';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from '../../components/common/Icon';
import CustomModal from '../../components/common/Modal';
import Header from '../../components/common/Header';
import BottomNavBar from '../../components/common/BottomNavBar';
import QRScannerModal from '../../components/common/QRScannerModal';
import useCachedFocusLoader from '../../hooks/useCachedFocusLoader';
import useConnectionStatus from '../../hooks/useConnectionStatus';
import useOnlineLabel from '../../hooks/useOnlineLabel';
import { TYPOGRAPHY } from '../../styles/typography';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import authService from '../../services/authService';
import reportService from '../../services/reportService';
import { formatDisplayDate } from '../../utils/formatters';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import Button from '../../components/common/Button';
import { routeQrScan } from '../../utils/routeQrScan';
import friendlyError from '../../utils/friendlyError';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending review' },
  { key: 'reviewed', label: 'Reviewed' },
  { key: 'discrepancy', label: 'Has discrepancy' },
];

const shortDate = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday as start of week
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// A failed fetch keeps the previous snapshot instead of blanking the screen.
export const loadReportsData = async (previous) => {
  const agent = await authService.getCurrentUser();
  const prev = previous?.agentId === agent?.id ? previous : null;
  const result = await reportService.getMyDailyReports(agent?.id, 30);
  return {
    agentId: agent?.id,
    reports: result.success ? result.data : prev?.reports ?? [],
  };
};

export default function SalesRepReportsScreen() {
  const navigation = useNavigation();
  const connection = useConnectionStatus();
  const onlineLabel = useOnlineLabel();
  const { data: snapshot, isLoading, refreshControl } = useCachedFocusLoader('sales-rep-reports', loadReportsData);
  const reports = snapshot?.reports ?? [];
  const [selectedReport, setSelectedReport] = useState(null);
  const [filter, setFilter] = useState('all');

  // The summary block hides the moment you scroll down and only comes back at the very top.
  // It floats over the list (the list keeps room for it), so nothing resizes while you scroll.
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
    } else if (delta > 0) {
      setHeaderHidden(true);
    }
  };
  const headerTranslateY = headerProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -headerHeight] });
  // Opened from Submit Report's "View submitted report": show today's report.
  const route = useRoute();
  const openToday = route.params?.openToday === true;
  useEffect(() => {
    if (!openToday) return;
    const today = reports.find((r) => new Date(r.reportDate).toDateString() === new Date().toDateString());
    if (today) {
      setSelectedReport(today);
      navigation.setParams({ openToday: false });
    }
  }, [openToday, reports]);

  // Tapped from a notification ("Daily report accepted"): open that report.
  const focusId = route.params?.focusId || null;
  const openedFocusIdRef = useRef(null);
  useEffect(() => {
    if (!focusId || isLoading || openedFocusIdRef.current === focusId) return;
    const match = reports.find((r) => r.reportId === focusId);
    if (match) {
      openedFocusIdRef.current = focusId;
      setSelectedReport(match);
    }
  }, [focusId, isLoading, reports]);
  const [isScannerVisible, setIsScannerVisible] = useState(false);

  const handleTabPress = (key) => {
    if (key === 'dashboard') {
      navigation.navigate('SalesRepDashboard');
    } else if (key === 'stock') {
      navigation.navigate('SalesRepStock');
    } else if (key === 'settings') {
      navigation.navigate('SalesRepSettings');
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

  const handleViewReport = (report) => setSelectedReport(report);

  const handleSubmitToday = () => {
    navigation.navigate('SubmitReportSR');
  };

  const todayAlreadySubmitted = reports.some(
    (r) => new Date(r.reportDate).toDateString() === new Date().toDateString()
  );

  const weekStart = startOfWeek(new Date());
  const weekReports = reports.filter((r) => new Date(r.reportDate) >= weekStart);
  const weekSummary = weekReports.reduce(
    (acc, r) => {
      (r.items || []).forEach((item) => {
        acc.given += item.inCustodyQuantity;
        acc.sold += item.soldQuantity;
        acc.returns += item.returnQuantity;
      });
      return acc;
    },
    { given: 0, sold: 0, returns: 0 }
  );

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekRange = `${shortDate(weekStart)} – ${shortDate(weekEnd)}`;

  const reportDiscrepancy = (report) => (report.items || []).reduce((sum, i) => sum + Math.abs(i.discrepancy), 0);
  const visibleReports = reports.filter((report) => {
    if (filter === 'pending') return report.status !== 'accepted';
    if (filter === 'reviewed') return report.status === 'accepted';
    if (filter === 'discrepancy') return reportDiscrepancy(report) > 0;
    return true;
  });
  const todayKey = new Date().toDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const groupOf = (report) => {
    const d = new Date(report.reportDate);
    if (d.toDateString() === todayKey) return 'TODAY';
    if (d.toDateString() === yesterday.toDateString()) return 'YESTERDAY';
    return d >= weekStart ? 'THIS WEEK' : 'EARLIER';
  };

  const WEEK_SUMMARY = [
    { key: 'given', icon: 'package', color: '#0085F9', bg: '#EAF4FF', value: String(weekSummary.given), label: 'Given' },
    { key: 'sold', icon: 'checkCircle', color: '#1E7A3A', bg: '#E1F4E8', value: String(weekSummary.sold), label: 'Sold' },
    { key: 'return', icon: 'returns', color: '#E5366B', bg: '#FDEBF1', value: String(weekSummary.returns), label: 'Returned' },
  ];

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <Header
          title="Report Generation"
          titleAlign="left"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
        />

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <View style={styles.listArea}>
          <ScrollView
          refreshControl={refreshControl} contentContainerStyle={[styles.content, { paddingTop: headerHeight + SPACING.sm }]} onScroll={handleListScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false}>
            {!todayAlreadySubmitted && (
              <Pressable style={styles.submitBanner} onPress={handleSubmitToday}>
                <View style={styles.submitBannerIconWrap}>
                  <Icon name="document" size={22} color="#03045E" />
                </View>
                <View style={styles.submitBannerTextWrap}>
                  <Text style={styles.submitBannerTitle}>Submit Today's Report</Text>
                  <Text style={styles.submitBannerSubtitle}>Finalize sold, returned, and discrepancy figures for today.</Text>
                </View>
                <Icon name="arrowRight" size={18} color="#555353" />
              </Pressable>
            )}

            {reports.length === 0 ? (
              <Text style={styles.emptyText}>No reports submitted yet.</Text>
            ) : visibleReports.length === 0 ? (
              <Text style={styles.emptyText}>No reports match this filter.</Text>
            ) : (
              <View style={styles.reportsList}>
                {visibleReports.map((report, index) => {
                  const given = (report.items || []).reduce((sum, i) => sum + i.inCustodyQuantity, 0);
                  const sold = (report.items || []).reduce((sum, i) => sum + i.soldQuantity, 0);
                  const returns = (report.items || []).reduce((sum, i) => sum + i.returnQuantity, 0);
                  const discrepancy = reportDiscrepancy(report);
                  const isReviewed = report.status === 'accepted';
                  const group = groupOf(report);
                  const showGroup = index === 0 || groupOf(visibleReports[index - 1]) !== group;

                  return (
                    <React.Fragment key={report.reportId}>
                      {showGroup && <Text style={[styles.groupLabel, index > 0 && styles.groupLabelSpaced]}>{group}</Text>}
                      <Pressable style={styles.reportCard} onPress={() => handleViewReport(report)}>
                        <View style={styles.reportTopRow}>
                          <View style={styles.reportDateWrap}>
                            <Icon name="calendar" size={16} color="#03045E" />
                            <Text style={styles.reportDate}>{formatDisplayDate(report.reportDate)}</Text>
                            {report.isAutoFiled && <Text style={styles.autoFiledTag}>Auto-filed</Text>}
                          </View>
                          <View
                            style={[
                              styles.reportStatusPill,
                              isReviewed ? styles.reportStatusReviewed : styles.reportStatusPending,
                            ]}
                          >
                            <Text
                              style={[
                                styles.reportStatusText,
                                isReviewed ? styles.reportStatusTextReviewed : styles.reportStatusTextPending,
                              ]}
                            >
                              {isReviewed ? 'Reviewed' : 'Pending Review'}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.figuresLine}>
                          <Text style={styles.figuresText}>
                            Given <Text style={styles.figuresStrong}>{given}</Text>  ·  Sold <Text style={styles.figuresStrong}>{sold}</Text>  ·  Returns <Text style={styles.figuresStrong}>{returns}</Text>
                          </Text>
                          <View style={[styles.discChip, discrepancy > 0 ? styles.discChipBad : styles.discChipGood]}>
                            <Icon name={discrepancy > 0 ? 'warningTriangle' : 'checkCircle'} size={11} color={discrepancy > 0 ? '#B91C1C' : '#1E7A3A'} />
                            <Text style={[styles.discChipText, { color: discrepancy > 0 ? '#B91C1C' : '#1E7A3A' }]}>
                              {discrepancy > 0 ? `${discrepancy} discrepancy` : 'Balanced'}
                            </Text>
                          </View>
                        </View>
                      </Pressable>
                    </React.Fragment>
                  );
                })}
              </View>
            )}

            <View style={{ height: 24 }} />
          </ScrollView>

          <Animated.View
            style={[styles.summaryFloat, { transform: [{ translateY: headerTranslateY }] }]}
            onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
          >
            <View style={styles.summaryHeaderRow}>
              <View style={styles.summaryTitleCol}>
                <Text style={styles.summaryTitle}>This Week</Text>
                <Text style={styles.summaryRange}>{weekRange}</Text>
              </View>
              <View style={[styles.statusPill, !connection.online && styles.statusPillOffline]}>
                <View style={[styles.statusDot, !connection.online && styles.statusDotOffline]} />
                <Text style={[styles.statusText, !connection.online && styles.statusTextOffline]} numberOfLines={1}>
                  {onlineLabel}
                </Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              {WEEK_SUMMARY.map((stat) => (
                <View key={stat.key} style={styles.statCard}>
                  <View style={[styles.statIconWrap, { backgroundColor: stat.bg }]}>
                    <Icon name={stat.icon} size={16} color={stat.color} weight="fill" />
                  </View>
                  <View>
                    <Text style={styles.statValue}>{stat.value}</Text>
                    <Text style={styles.statLabel}>{stat.label}</Text>
                  </View>
                </View>
              ))}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {FILTERS.map((option) => {
                const isActive = option.key === filter;
                return (
                  <Pressable
                    key={option.key}
                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                    onPress={() => setFilter(option.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>
          </View>
        )}

        <BottomNavBar activeTab="reports" onTabPress={handleTabPress} onFabPress={() => setIsScannerVisible(true)} fabLabel="Scan" />
      </View>

      <CustomModal visible={!!selectedReport} onClose={() => setSelectedReport(null)} height="auto" maxHeight={700}>
        {selectedReport && (
          <>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderText}>
                <Text style={styles.modalTitle}>{formatDisplayDate(selectedReport.reportDate)}</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedReport.isAutoFiled ? 'Auto-filed for a missed day' : 'Your daily report'}
                </Text>
              </View>
              <View style={[styles.sheetBadge, selectedReport.status === 'accepted' ? styles.sheetBadgeGood : styles.sheetBadgeWait]}>
                <Text style={[styles.sheetBadgeText, { color: selectedReport.status === 'accepted' ? '#1E7A3A' : '#B26400' }]}>
                  {selectedReport.status === 'accepted' ? 'Reviewed' : 'Awaiting review'}
                </Text>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.sheetScroll}>
              <Text style={styles.sheetLabel}>ITEMS ({(selectedReport.items || []).length})</Text>
              <View style={styles.modalItemsList}>
                {(selectedReport.items || []).map((item) => {
                  const image = PRODUCT_CATALOG.find((p) => p.code === item.productCode)?.image;
                  const hasGap = item.discrepancy !== 0;
                  return (
                    <View key={item.reportItemId} style={styles.modalItemCard}>
                      <View style={styles.modalItemTop}>
                        <View style={styles.modalItemThumb}>
                          {image ? (
                            <Image source={image} style={styles.modalItemImage} resizeMode="contain" />
                          ) : (
                            <Icon name="boxPackage" size={22} />
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.modalItemCode}>{item.productCode}</Text>
                          {!!item.productName && item.productName !== item.productCode && (
                            <Text style={styles.modalItemName}>{item.productName}</Text>
                          )}
                        </View>
                      </View>
                      <View style={styles.statRow}>
                        <View style={styles.statBox}>
                          <Text style={styles.statLabel}>Custody</Text>
                          <Text style={styles.statValue}>{item.inCustodyQuantity}</Text>
                        </View>
                        <View style={styles.statBox}>
                          <Text style={styles.statLabel}>Sold</Text>
                          <Text style={styles.statValue}>{item.soldQuantity}</Text>
                        </View>
                        <View style={styles.statBox}>
                          <Text style={styles.statLabel}>Return</Text>
                          <Text style={styles.statValue}>{item.returnQuantity}</Text>
                        </View>
                        <View style={[styles.statBox, hasGap && styles.statBoxFlag]}>
                          <Text style={[styles.statLabel, hasGap && styles.statFlagText]}>{hasGap ? 'Discrepancy' : 'Diff'}</Text>
                          <Text style={[styles.statValue, hasGap && styles.statFlagText]}>{item.discrepancy}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            <Button
              title="Close"
              variant="outline"
              onPress={() => setSelectedReport(null)}
              hasShadow={false}
              height={48}
              fontSize={16}
              borderRadius={24}
              width="100%"
              style={styles.sheetClose}
            />
          </>
        )}
      </CustomModal>

      <QRScannerModal
        visible={isScannerVisible}
        onClose={() => setIsScannerVisible(false)}
        onScanned={handleScanned}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  listArea: { flex: 1, overflow: 'hidden' },
  summaryFloat: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, backgroundColor: '#FFFFFF', zIndex: 2, elevation: 2 },
  summaryTitleCol: { flex: 1, marginRight: 8 },
  summaryRange: { marginTop: 1, fontSize: 12, color: '#6B7280', fontFamily: TYPOGRAPHY.fontFamily.regular },
  chipRow: { gap: 8, paddingTop: 10, paddingRight: 16 },
  filterChip: { height: 34, paddingHorizontal: 14, borderRadius: 17, borderWidth: 1.5, borderColor: '#D5DAE3', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  filterChipActive: { borderColor: '#0085F9', backgroundColor: '#EAF4FF' },
  filterChipText: { fontSize: 13, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.medium, fontWeight: '500' },
  filterChipTextActive: { color: '#0085F9', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  groupLabel: { marginBottom: 8, fontSize: 12, letterSpacing: 0.8, color: '#6B7280', fontFamily: TYPOGRAPHY.fontFamily.semibold, fontWeight: '600' },
  groupLabelSpaced: { marginTop: 14 },
  figuresLine: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  figuresText: { flexShrink: 1, fontSize: 13, color: '#555353', fontFamily: TYPOGRAPHY.fontFamily.regular },
  figuresStrong: { color: '#03045E', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  discChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  discChipBad: { backgroundColor: '#FDECEC' },
  discChipGood: { backgroundColor: '#E1F4E8' },
  discChipText: { fontSize: 11, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 96,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryTitle: {
    fontSize: 17,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAFBF2',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#A7E8C4',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#1E7A3A',
    marginRight: 5,
  },
  statusText: {
    color: '#1E7A3A',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  statusPillOffline: {
    backgroundColor: '#FBDCDC',
    borderColor: COLORS.error,
  },
  statusDotOffline: {
    backgroundColor: COLORS.error,
  },
  statusTextOffline: {
    color: '#B91C1C',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 0,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 18,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 0,
  },
  submitBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DBE4EE',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 20,
  },
  submitBannerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EDEBFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  submitBannerTextWrap: {
    flex: 1,
  },
  submitBannerTitle: {
    fontSize: 15,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    marginBottom: 2,
  },
  submitBannerSubtitle: {
    fontSize: 12,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  listTitle: {
    color: '#272632',
    fontSize: 17,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  reportsList: {
    gap: 12,
  },
  reportCard: {
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 14,
    padding: 12,
  },
  reportTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  reportDateWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reportDate: {
    fontSize: 13,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  autoFiledTag: {
    fontSize: 11,
    color: '#B91C1C',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    backgroundColor: '#FBDCDC',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  reportStatusPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  reportStatusReviewed: {
    backgroundColor: '#EAFBF2',
  },
  reportStatusPending: {
    backgroundColor: '#FFF1D6',
  },
  reportStatusText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  reportStatusTextReviewed: {
    color: '#1E7A3A',
  },
  reportStatusTextPending: {
    color: '#B26400',
  },
  figuresRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  figureColumn: {
    alignItems: 'flex-start',
  },
  figureLabel: {
    fontSize: 11,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginBottom: 2,
  },
  figureValue: {
    fontSize: 15,
    color: '#03045E',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  figureValueError: {
    color: '#B91C1C',
  },
  sheetHandle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#DADDE3', marginTop: -8, marginBottom: 14 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetHeaderText: { flex: 1 },
  sheetBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  sheetBadgeGood: { backgroundColor: '#EAFBF2' },
  sheetBadgeWait: { backgroundColor: '#FFF1D6' },
  sheetBadgeText: { fontSize: 12, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  sheetScroll: { flexShrink: 1 },
  sheetLabel: { marginTop: 16, marginBottom: 8, fontSize: 12, letterSpacing: 0.8, color: '#6B7280', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  modalItemCard: { borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 12, padding: 10, gap: 10 },
  modalItemTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalItemThumb: { width: 44, height: 44, borderRadius: 8, borderWidth: 1, borderColor: '#EEEEEE', alignItems: 'center', justifyContent: 'center', padding: 3 },
  modalItemImage: { width: '100%', height: '100%' },
  statRow: { flexDirection: 'row', gap: 6 },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, backgroundColor: '#F5F6F9' },
  statBoxFlag: { backgroundColor: '#FDECEC' },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.regular },
  statValue: { marginTop: 2, fontSize: 18, color: '#272632', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  statFlagText: { color: '#B91C1C' },
  sheetClose: { marginTop: 14 },
  modalTitle: {
    fontSize: 17,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 4,
    marginBottom: 16,
  },
  modalItemsList: {
    gap: 10,
  },
  modalItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  modalItemCode: {
    fontSize: 13,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  modalItemName: {
    fontSize: 12,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  modalItemFigure: {
    fontSize: 12,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  modalItemDiscrepancy: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    color: '#1E7A3A',
  },
  modalItemDiscrepancyFlag: {
    color: '#B91C1C',
  },
});
