// src/screens/manager/ManageReturnsScreen.js
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import Icon from '../../components/common/Icon';
import BottomNavBar from '../../components/common/BottomNavBar';
import CustomModal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import reportService from '../../services/reportService';
import { formatDisplayDate, formatRelativeTime } from '../../utils/formatters';

const TABS = [
  { key: 'reports', label: 'Reports' },
  { key: 'returns', label: 'Returns' },
];

const RETURN_SUB_TABS = [
  { key: 'pending', label: 'Pending Returns' },
  { key: 'confirmed', label: 'Confirmed Returns' },
];

export default function ManageReturnsScreen() {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState('reports');
  const [activeReturnSubTab, setActiveReturnSubTab] = useState('pending');
  const [reports, setReports] = useState([]);
  const [returnRequests, setReturnRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [isAccepting, setIsAccepting] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const [reportsResult, returnsResult] = await Promise.all([
      reportService.getBranchDailyReports(50),
      reportService.getBranchReturnRequests(100),
    ]);
    setReports(reportsResult.success ? reportsResult.data : []);
    setReturnRequests(returnsResult.success ? returnsResult.data : []);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleTabPress = (key) => {
    if (key === 'dashboard') {
      navigation.navigate('ManagerDashboard');
    } else if (key === 'stock') {
      navigation.navigate('ManagerStock');
    } else if (key === 'reports') {
      navigation.navigate('ManagerReports');
    } else if (key === 'settings') {
      navigation.navigate('ManagerSettings');
    } else {
      navigation.navigate('ComingSoon', { tabKey: key, role: 'manager' });
    }
  };

  const pendingReports = reports.filter((r) => r.status === 'pending');
  const reviewedReports = reports.filter((r) => r.status === 'accepted');

  const pendingReturns = returnRequests.filter((r) => r.status === 'pending');
  const confirmedReturns = returnRequests.filter((r) => r.status !== 'pending');
  const visibleReturns = activeReturnSubTab === 'pending' ? pendingReturns : confirmedReturns;

  const handleOpenReturn = (item) => {
    if (activeReturnSubTab !== 'pending') return;
    navigation.navigate('ReturnStockVerify', { returnRequest: item });
  };

  const handleAcceptReport = async () => {
    if (!selectedReport) return;
    setIsAccepting(true);
    const result = await reportService.acceptDailyReport(selectedReport.reportId);
    setIsAccepting(false);
    if (!result.success) {
      Alert.alert('Failed', result.message || 'Could not accept this report.');
      return;
    }
    setSelectedReport(null);
    loadData();
  };

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton
          backButtonText="Manager Dashboard"
          showDocumentIcon
          onDocumentPress={() => navigation.navigate('StockLogs')}
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
        />

        <SecondaryHeader height={56}>
          <View style={styles.titleRow}>
            <Text style={styles.pageTitle}>Reports & Returns</Text>
            <View style={styles.onlinePill}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Online</Text>
            </View>
          </View>
        </SecondaryHeader>

        <View style={styles.tabRow}>
          {TABS.map((tab) => {
            const isActive = tab.key === activeTab;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : activeTab === 'reports' ? (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {pendingReports.length === 0 && reviewedReports.length === 0 ? (
              <Text style={styles.emptyText}>No daily reports submitted yet.</Text>
            ) : (
              <>
                {pendingReports.length > 0 && (
                  <>
                    <Text style={styles.sectionLabel}>Pending Review</Text>
                    <View style={styles.cardsGroup}>
                      {pendingReports.map((report) => (
                        <TouchableOpacity
                          key={report.reportId}
                          style={styles.returnCard}
                          onPress={() => setSelectedReport(report)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.returnAvatar}>
                            <Icon name="person" size={22} color="#94a3b8" />
                          </View>
                          <View style={styles.returnInfo}>
                            <Text style={styles.returnName} numberOfLines={1}>{report.agentName}</Text>
                            <Text style={styles.returnDate}>
                              {formatDisplayDate(report.reportDate)}
                              {report.isAutoFiled ? ' · Auto-filed' : ''}
                            </Text>
                          </View>
                          <View style={[styles.statusBadge, styles.statusBadgePending]}>
                            <Text style={[styles.statusBadgeText, styles.statusBadgeTextPending]}>Pending</Text>
                          </View>
                          <Icon name="arrowRight" size={18} color="#94a3b8" style={styles.chevron} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                {reviewedReports.length > 0 && (
                  <>
                    <Text style={styles.sectionLabel}>Reviewed</Text>
                    <View style={styles.cardsGroup}>
                      {reviewedReports.map((report) => (
                        <TouchableOpacity
                          key={report.reportId}
                          style={styles.returnCard}
                          onPress={() => setSelectedReport(report)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.returnAvatar}>
                            <Icon name="person" size={22} color="#94a3b8" />
                          </View>
                          <View style={styles.returnInfo}>
                            <Text style={styles.returnName} numberOfLines={1}>{report.agentName}</Text>
                            <Text style={styles.returnDate}>{formatDisplayDate(report.reportDate)}</Text>
                          </View>
                          <View style={[styles.statusBadge, styles.statusBadgeConfirmed]}>
                            <Text style={[styles.statusBadgeText, styles.statusBadgeTextConfirmed]}>Accepted</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
              </>
            )}
            <View style={{ height: 24 }} />
          </ScrollView>
        ) : (
          <>
            <View style={styles.subTabRow}>
              {RETURN_SUB_TABS.map((tab) => {
                const isActive = tab.key === activeReturnSubTab;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[styles.subTabButton, isActive && styles.subTabButtonActive]}
                    onPress={() => setActiveReturnSubTab(tab.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.subTabButtonText, isActive && styles.subTabButtonTextActive]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              {visibleReturns.length === 0 ? (
                <Text style={styles.emptyText}>
                  No {activeReturnSubTab === 'pending' ? 'pending' : 'confirmed'} returns right now.
                </Text>
              ) : (
                visibleReturns.map((item) => (
                  <TouchableOpacity
                    key={item.resolutionRequestId}
                    style={styles.returnCard}
                    onPress={() => handleOpenReturn(item)}
                    activeOpacity={activeReturnSubTab === 'pending' ? 0.7 : 1}
                  >
                    <View style={styles.returnAvatar}>
                      <Icon name="person" size={22} color="#94a3b8" />
                    </View>

                    <View style={styles.returnInfo}>
                      <Text style={styles.returnName} numberOfLines={1}>
                        {item.agentName} <Text style={styles.returnRole}>({item.productCode})</Text>
                      </Text>
                      <Text style={styles.returnDate}>Sent {formatRelativeTime(item.createdAt)}</Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        item.status === 'pending'
                          ? styles.statusBadgePending
                          : item.status === 'accepted'
                          ? styles.statusBadgeConfirmed
                          : styles.statusBadgeRejected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          item.status === 'pending'
                            ? styles.statusBadgeTextPending
                            : item.status === 'accepted'
                            ? styles.statusBadgeTextConfirmed
                            : styles.statusBadgeTextRejected,
                        ]}
                      >
                        {item.status === 'pending' ? 'Pending' : item.status === 'accepted' ? 'Accepted' : 'Rejected'}
                      </Text>
                    </View>

                    {activeReturnSubTab === 'pending' && (
                      <Icon name="arrowRight" size={18} color="#94a3b8" style={styles.chevron} />
                    )}
                  </TouchableOpacity>
                ))
              )}

              <View style={{ height: 24 }} />
            </ScrollView>
          </>
        )}

        <BottomNavBar activeTab="dashboard" onTabPress={handleTabPress} onFabPress={() => {}} />
      </View>

      <CustomModal visible={!!selectedReport} onClose={() => setSelectedReport(null)} height={560}>
        {selectedReport && (
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>{selectedReport.agentName}</Text>
            <Text style={styles.modalSubtitle}>
              {formatDisplayDate(selectedReport.reportDate)}
              {selectedReport.isAutoFiled ? ' · Auto-filed (missed report)' : ''}
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
                  <Text style={[styles.modalItemFigure, item.discrepancy !== 0 && styles.modalItemFigureFlag]}>
                    Δ {item.discrepancy}
                  </Text>
                </View>
              ))}
            </View>

            {selectedReport.status === 'pending' && (
              <Button
                title={isAccepting ? 'Accepting…' : 'Accept Report'}
                onPress={handleAcceptReport}
                disabled={isAccepting}
                style={{ marginTop: SPACING.lg }}
              />
            )}
          </ScrollView>
        )}
      </CustomModal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
  },
  pageTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' },
  onlineText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.success,
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    borderRadius: 12,
    backgroundColor: '#F1F3F6',
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
  },
  tabButtonTextActive: {
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  subTabRow: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  subTabButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#F1F3F6',
  },
  subTabButtonActive: {
    backgroundColor: COLORS.primaryLight,
  },
  subTabButtonText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
  },
  subTabButtonTextActive: {
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: 96,
    gap: SPACING.sm,
  },
  sectionLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  cardsGroup: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  returnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  returnAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F3F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  returnInfo: {
    flex: 1,
  },
  returnName: {
    fontSize: 14,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  returnRole: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: '400',
    color: '#555353',
    fontSize: 12,
  },
  returnDate: {
    fontSize: 11,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 3,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusBadgePending: {
    backgroundColor: '#FFF1D6',
  },
  statusBadgeConfirmed: {
    backgroundColor: '#EAFBF2',
  },
  statusBadgeRejected: {
    backgroundColor: '#FBDCDC',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  statusBadgeTextPending: {
    color: '#B26400',
  },
  statusBadgeTextConfirmed: {
    color: '#1E7A3A',
  },
  statusBadgeTextRejected: {
    color: '#B91C1C',
  },
  chevron: {
    marginLeft: 2,
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
  modalItemFigureFlag: {
    color: '#B91C1C',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
});
