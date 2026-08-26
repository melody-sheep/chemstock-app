// src/screens/salesrep/SalesRepReportsScreen.js
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from '../../components/common/Icon';
import CustomModal from '../../components/common/Modal';
import BottomNavBar from '../../components/common/BottomNavBar';
import { TYPOGRAPHY } from '../../styles/typography';
import { COLORS } from '../../constants/colors';
import authService from '../../services/authService';
import reportService from '../../services/reportService';
import { formatDisplayDate } from '../../utils/formatters';

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday as start of week
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function SalesRepReportsScreen() {
  const navigation = useNavigation();
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    const agent = await authService.getCurrentUser();
    const result = await reportService.getMyDailyReports(agent?.id, 30);
    setReports(result.success ? result.data : []);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadReports();
    }, [loadReports])
  );

  const handleBack = () => navigation.goBack();

  const handleTabPress = (key) => {
    if (key === 'dashboard') {
      navigation.navigate('SalesRepDashboard');
    } else if (key === 'stock') {
      navigation.navigate('SalesRepStock');
    } else if (key === 'settings') {
      navigation.navigate('SalesRepSettings');
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

  const WEEK_SUMMARY = [
    { key: 'given', icon: 'boxPackage', bg: '#EDEBFF', value: String(weekSummary.given), label: 'Given Stock' },
    { key: 'sold', icon: 'checkmarkCircle', iconColor: '#FFFFFF', bg: '#3B2FC9', value: String(weekSummary.sold), label: 'Sold Stocks' },
    { key: 'return', icon: 'returns', iconColor: '#FFFFFF', bg: '#F72E75', value: String(weekSummary.returns), label: 'Return' },
  ];

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable onPress={handleBack} style={styles.iconButton}>
            <Icon name="arrowLeft" size={20} color="#FFFFFF" />
          </Pressable>

          <Text style={styles.topBarTitle}>Reports</Text>

          <View style={styles.iconButton}>
            <Icon name="document" size={20} color="#FFFFFF" />
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.summaryHeaderRow}>
              <Text style={styles.summaryTitle}>This Week's Summary</Text>
              <View style={styles.statusPill}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Online</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              {WEEK_SUMMARY.map((stat) => (
                <View key={stat.key} style={styles.statCard}>
                  <View style={[styles.statIconWrap, { backgroundColor: stat.bg }]}>
                    <Icon name={stat.icon} size={18} color={stat.iconColor || '#03045E'} weight={stat.iconColor ? 'fill' : 'regular'} />
                  </View>
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>

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

            <Text style={styles.listTitle}>Daily Report History</Text>

            {reports.length === 0 ? (
              <Text style={styles.emptyText}>No reports submitted yet.</Text>
            ) : (
              <View style={styles.reportsList}>
                {reports.map((report) => {
                  const given = (report.items || []).reduce((sum, i) => sum + i.inCustodyQuantity, 0);
                  const sold = (report.items || []).reduce((sum, i) => sum + i.soldQuantity, 0);
                  const returns = (report.items || []).reduce((sum, i) => sum + i.returnQuantity, 0);
                  const discrepancy = (report.items || []).reduce((sum, i) => sum + Math.abs(i.discrepancy), 0);
                  const isReviewed = report.status === 'accepted';

                  return (
                    <Pressable key={report.reportId} style={styles.reportCard} onPress={() => handleViewReport(report)}>
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

                      <View style={styles.figuresRow}>
                        <View style={styles.figureColumn}>
                          <Text style={styles.figureLabel}>Given</Text>
                          <Text style={styles.figureValue}>{given}</Text>
                        </View>
                        <View style={styles.figureColumn}>
                          <Text style={styles.figureLabel}>Sold</Text>
                          <Text style={styles.figureValue}>{sold}</Text>
                        </View>
                        <View style={styles.figureColumn}>
                          <Text style={styles.figureLabel}>Returns</Text>
                          <Text style={styles.figureValue}>{returns}</Text>
                        </View>
                        <View style={styles.figureColumn}>
                          <Text style={styles.figureLabel}>Discrepancy</Text>
                          <Text style={[styles.figureValue, discrepancy > 0 && styles.figureValueError]}>
                            {discrepancy}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <View style={{ height: 24 }} />
          </ScrollView>
        )}

        <BottomNavBar activeTab="reports" onTabPress={handleTabPress} onFabPress={() => {}} />
      </View>

      <CustomModal visible={!!selectedReport} onClose={() => setSelectedReport(null)} height={520}>
        {selectedReport && (
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>{formatDisplayDate(selectedReport.reportDate)}</Text>
            <Text style={styles.modalSubtitle}>
              {selectedReport.status === 'accepted' ? 'Reviewed by your manager' : 'Awaiting manager review'}
              {selectedReport.isAutoFiled ? ' · Auto-filed (missed)' : ''}
            </Text>

            <View style={styles.modalItemsList}>
              {(selectedReport.items || []).map((item) => (
                <View key={item.reportItemId} style={styles.modalItemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemCode}>{item.productCode}</Text>
                    <Text style={styles.modalItemName}>{item.productName}</Text>
                  </View>
                  <Text style={styles.modalItemFigure}>Custody {item.inCustodyQuantity}</Text>
                  <Text style={styles.modalItemFigure}>Sold {item.soldQuantity}</Text>
                  <Text style={styles.modalItemFigure}>Return {item.returnQuantity}</Text>
                  <Text
                    style={[
                      styles.modalItemFigure,
                      styles.modalItemDiscrepancy,
                      item.discrepancy !== 0 && styles.modalItemDiscrepancyFlag,
                    ]}
                  >
                    Δ {item.discrepancy}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </CustomModal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    height: 56,
    backgroundColor: '#03045E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  iconButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
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
    marginBottom: 14,
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
    backgroundColor: '#B7FFD6',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#00FF6E',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#00FF6E',
    marginRight: 5,
  },
  statusText: {
    color: '#1D6A3A',
    fontSize: 10,
    fontWeight: '600',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'flex-start',
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
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
    marginTop: 1,
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
    fontSize: 11,
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
    fontSize: 9,
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
    fontSize: 10,
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
    fontSize: 10,
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
    fontSize: 11,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  modalItemFigure: {
    fontSize: 11,
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
