// src/screens/manager/ManageReturnsScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import Alert from '../../utils/appAlert';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import LiveStatusPill from '../../components/common/LiveStatusPill';
import SectionHeader from '../../components/common/SectionHeader';
import Icon from '../../components/common/Icon';
import UserAvatar from '../../components/common/UserAvatar';
import BottomNavBar from '../../components/common/BottomNavBar';
import CustomModal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import PhotoProofCard from '../../components/common/PhotoProofCard';
import CameraCaptureModal from '../../components/common/CameraCaptureModal';
import BranchSelector from '../../components/common/BranchSelector';
import QRScannerModal from '../../components/common/QRScannerModal';
import { describeReceivingScan } from '../../utils/scanLookup';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import authService from '../../services/authService';
import requireOnline from '../../utils/requireOnline';
import useCachedFocusLoader from '../../hooks/useCachedFocusLoader';
import reportService from '../../services/reportService';
import agentService from '../../services/agentService';
import requestService from '../../services/requestService';
import { formatDisplayDate, formatRelativeTime } from '../../utils/formatters';
import { getInitials } from '../../utils/initials';
import friendlyError from '../../utils/friendlyError';

const ALL_BRANCHES_ID = 'all';

const TABS = [
  { key: 'reports', label: 'Reports' },
  { key: 'returns', label: 'Returns' },
];

const RETURN_SUB_TABS = [
  { key: 'pending', label: 'Pending Returns' },
  { key: 'confirmed', label: 'Confirmed Returns' },
];

const loadReturnsData = async (previous) => {
  const manager = await authService.getCurrentUser();
  const prev = previous?.managerId === manager?.id ? previous : null;
  const [reportsResult, returnsResult, agentsResult, managerBranches] = await Promise.all([
    reportService.getBranchDailyReports(50),
    reportService.getBranchReturnRequests(100),
    agentService.getMyAgentAccounts(),
    requestService.getAgentBranches(manager?.branchIds || []),
  ]);
  return {
    managerId: manager?.id,
    reports: reportsResult.success ? reportsResult.data : prev?.reports ?? [],
    returnRequests: returnsResult.success ? returnsResult.data : prev?.returnRequests ?? [],
    photoUrlByAgentId: agentsResult.success
      ? Object.fromEntries(agentsResult.data.map((a) => [a.id, a.profilePhotoUrl]))
      : prev?.photoUrlByAgentId ?? {},
    // getAgentBranches returns [] on failure too, so an empty result keeps the old list.
    branches: managerBranches.length > 0 ? managerBranches : prev?.branches ?? [],
  };
};

// Friendly empty state: an icon, a short title and a hint of what shows up here.
function EmptyState({ icon, title, text }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconCircle}>
        <Icon name={icon} size={28} color={COLORS.textSecondary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export default function ManageReturnsScreen() {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState('reports');
  const [activeReturnSubTab, setActiveReturnSubTab] = useState('pending');
  const [selectedBranchId, setSelectedBranchId] = useState(ALL_BRANCHES_ID);
  const [selectedReport, setSelectedReport] = useState(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [reportPhotoUrl, setReportPhotoUrl] = useState(null);
  const [isLoadingReportPhoto, setIsLoadingReportPhoto] = useState(false);
  const [isViewingReportPhoto, setIsViewingReportPhoto] = useState(false);
  const [isScannerVisible, setIsScannerVisible] = useState(false);

  const handleScanned = async (qrCode) => {
    setIsScannerVisible(false);
    const currentManager = await authService.getCurrentUser();
    const summary = await describeReceivingScan(qrCode, currentManager?.branchIds || []);
    Alert.alert(summary.title, summary.message);
  };

  // Saved per account, so offline the last loaded lists stay on screen instead
  // of going blank. A request that fails keeps its previous value. Refetched on
  // every visit (freshMs 0), same as before.
  const { data: snapshot, isLoading, refresh, refreshControl } = useCachedFocusLoader('manager-reports-returns', loadReturnsData, {
    freshMs: 0,
  });
  const loadData = () => refresh({ force: true });
  const reports = snapshot?.reports ?? [];
  const returnRequests = snapshot?.returnRequests ?? [];
  const photoUrlByAgentId = snapshot?.photoUrlByAgentId ?? {};
  const branches = snapshot?.branches ?? [];

  // Resolved on-demand per selected report (not eagerly for the whole
  // list), same pattern as StockLogsScreen's shipment photo. null for an
  // auto-filed report — there was no manual submission, so no photo exists.
  useEffect(() => {
    if (!selectedReport?.mediaPath) {
      setReportPhotoUrl(null);
      return;
    }
    let cancelled = false;
    setIsLoadingReportPhoto(true);
    reportService.getDailyReportPhotoUrl(selectedReport.mediaPath).then((url) => {
      if (!cancelled) {
        setReportPhotoUrl(url);
        setIsLoadingReportPhoto(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedReport]);

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

  const branchFilterOptions =
    branches.length > 1 ? [{ id: ALL_BRANCHES_ID, name: 'All Branches' }, ...branches] : branches;

  const branchFilteredReports =
    selectedBranchId === ALL_BRANCHES_ID ? reports : reports.filter((r) => r.branchId === selectedBranchId);

  const pendingReports = branchFilteredReports.filter((r) => r.status === 'pending');
  const reviewedReports = branchFilteredReports.filter((r) => r.status === 'accepted');

  const pendingReturns = returnRequests.filter((r) => r.status === 'pending');
  const confirmedReturns = returnRequests.filter((r) => r.status !== 'pending');
  const visibleReturns = activeReturnSubTab === 'pending' ? pendingReturns : confirmedReturns;

  const handleOpenReturn = (item) => {
    if (activeReturnSubTab !== 'pending') return;
    navigation.navigate('ReturnStockVerify', { returnRequest: item });
  };

  const handleAcceptReport = async () => {
    if (!selectedReport) return;
    if (!requireOnline('Accepting a report')) return;
    setIsAccepting(true);
    const result = await reportService.acceptDailyReport(selectedReport.reportId);
    setIsAccepting(false);
    if (!result.success) {
      Alert.alert('Failed', friendlyError(result.message) || 'Could not accept this report.');
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

        <SecondaryHeader height={76}>
          <View style={styles.titleRow}>
            <View style={styles.titleTextCol}>
              <Text style={styles.pageTitle} numberOfLines={1}>Reports & Returns</Text>
              <Text style={styles.pageSubtitle}>Review what your team sent in</Text>
            </View>
            <LiveStatusPill pillStyle={styles.onlinePill} dotStyle={styles.onlineDot} textStyle={styles.onlineText} />
          </View>
        </SecondaryHeader>

        <View style={styles.tabRow}>
          {TABS.map((tab) => {
            const isActive = tab.key === activeTab;
            // How many are waiting for the manager on this tab.
            const waitingCount =
              tab.key === 'reports' ? reports.filter((r) => r.status === 'pending').length : pendingReturns.length;
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
                {waitingCount > 0 && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{waitingCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : activeTab === 'reports' ? (
          <ScrollView
          refreshControl={refreshControl} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {branchFilterOptions.length > 1 && (
              <View style={styles.branchFilterWrap}>
                <BranchSelector
                  branches={branchFilterOptions}
                  selectedId={selectedBranchId}
                  onSelect={setSelectedBranchId}
                  scrollable
                  scrollBleed={SPACING.lg}
                />
              </View>
            )}
            {pendingReports.length === 0 && reviewedReports.length === 0 ? (
              <EmptyState icon="clipboardText" title="No reports yet" text="Daily reports from your Sales Reps show up here." />
            ) : (
              <>
                {pendingReports.length > 0 && (
                  <>
                    <SectionHeader icon="clipboardText" size="md" label={`Pending review (${pendingReports.length})`} style={styles.sectionLabel} />
                    <View style={styles.cardsGroup}>
                      {pendingReports.map((report) => (
                        <TouchableOpacity
                          key={report.reportId}
                          style={styles.returnCard}
                          onPress={() => setSelectedReport(report)}
                          activeOpacity={0.7}
                        >
                          <UserAvatar
                            photoUrl={photoUrlByAgentId[report.agentId]}
                            fallbackText={getInitials(report.agentName)}
                            size={44}
                            backgroundColor="#F1F3F6"
                            fallbackTextColor={COLORS.primary}
                          />
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
                    <SectionHeader icon="checkCircle" size="md" label={`Reviewed (${reviewedReports.length})`} style={styles.sectionLabel} />
                    <View style={styles.cardsGroup}>
                      {reviewedReports.map((report) => (
                        <TouchableOpacity
                          key={report.reportId}
                          style={styles.returnCard}
                          onPress={() => setSelectedReport(report)}
                          activeOpacity={0.7}
                        >
                          <UserAvatar
                            photoUrl={photoUrlByAgentId[report.agentId]}
                            fallbackText={getInitials(report.agentName)}
                            size={44}
                            backgroundColor="#F1F3F6"
                            fallbackTextColor={COLORS.primary}
                          />
                          <View style={styles.returnInfo}>
                            <Text style={styles.returnName} numberOfLines={1}>{report.agentName}</Text>
                            <Text style={styles.returnDate}>{formatDisplayDate(report.reportDate)}</Text>
                          </View>
                          <View style={[styles.statusBadge, styles.statusBadgeConfirmed]}>
                            <Text style={[styles.statusBadgeText, styles.statusBadgeTextConfirmed]}>Accepted</Text>
                          </View>
                          <Icon name="arrowRight" size={18} color="#94a3b8" style={styles.chevron} />
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
                      {tab.key === 'pending' ? 'Pending' : 'Confirmed'} ({tab.key === 'pending' ? pendingReturns.length : confirmedReturns.length})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              {visibleReturns.length === 0 ? (
                <EmptyState
                  icon="returns"
                  title={activeReturnSubTab === 'pending' ? 'Nothing pending' : 'No confirmed returns yet'}
                  text={
                    activeReturnSubTab === 'pending'
                      ? 'New returns from your team show up here.'
                      : 'Returns you accept or reject are listed here.'
                  }
                />
              ) : (
                visibleReturns.map((item) => (
                  <TouchableOpacity
                    key={item.resolutionRequestId}
                    style={styles.returnCard}
                    onPress={() => handleOpenReturn(item)}
                    activeOpacity={activeReturnSubTab === 'pending' ? 0.7 : 1}
                  >
                    <UserAvatar
                      photoUrl={photoUrlByAgentId[item.agentId]}
                      fallbackText={getInitials(item.agentName)}
                      size={44}
                      backgroundColor="#F1F3F6"
                      fallbackTextColor={COLORS.primary}
                    />

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

        <BottomNavBar activeTab="dashboard" onTabPress={handleTabPress} onFabPress={() => setIsScannerVisible(true)} fabLabel="Scan" />
      </View>

      <QRScannerModal
        visible={isScannerVisible}
        onClose={() => setIsScannerVisible(false)}
        onScanned={handleScanned}
      />

      <CustomModal visible={!!selectedReport} onClose={() => setSelectedReport(null)} height={640}>
        {selectedReport && (
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>{selectedReport.agentName}</Text>
            <Text style={styles.modalSubtitle}>
              {selectedReport.branchName ? `${selectedReport.branchName} · ` : ''}
              {formatDisplayDate(selectedReport.reportDate)}
              {selectedReport.isAutoFiled ? ' · Auto-filed (missed report)' : ''}
            </Text>

            <Text style={styles.photoSectionLabel}>Handover Photo</Text>
            {selectedReport.isAutoFiled ? (
              <Text style={styles.noPhotoText}>No photo — this report was auto-filed for a missed day.</Text>
            ) : isLoadingReportPhoto ? (
              <View style={styles.photoLoadingWrap}>
                <ActivityIndicator color={COLORS.primary} />
              </View>
            ) : (
              <PhotoProofCard
                photoUri={reportPhotoUrl}
                onView={() => reportPhotoUrl && setIsViewingReportPhoto(true)}
              />
            )}

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

      <CameraCaptureModal
        visible={isViewingReportPhoto}
        onClose={() => setIsViewingReportPhoto(false)}
        onCapture={() => {}}
        initialUri={reportPhotoUrl}
        readOnly
        meta={selectedReport ? [
          { icon: 'person', text: `Handover photo by ${selectedReport.agentName || 'Sales Rep'}` },
          { icon: 'calendar', text: `Report for ${formatDisplayDate(selectedReport.reportDate)}` },
          ...(selectedReport.branchName ? [{ icon: 'location', text: selectedReport.branchName }] : []),
        ] : null}
      />
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
  titleTextCol: { flexShrink: 1, flex: 1 },
  pageSubtitle: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
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
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    color: '#FFFFFF',
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
    flex: 1,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#D5DAE3',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subTabButtonActive: {
    borderColor: '#0085F9',
    backgroundColor: '#EAF4FF',
  },
  subTabButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
  },
  subTabButtonTextActive: {
    color: '#0085F9',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: 150,
    gap: SPACING.sm,
  },
  branchFilterWrap: {
    marginBottom: SPACING.xs,
  },
  sectionLabel: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  cardsGroup: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  emptyWrap: { alignItems: 'center', paddingTop: SPACING.xl * 2, gap: SPACING.xs },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F3F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  returnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 12,
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
    fontSize: 12,
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
    fontSize: 11,
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
  photoSectionLabel: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    color: '#272632',
    marginTop: 16,
    marginBottom: 8,
  },
  noPhotoText: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  photoLoadingWrap: {
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalItemsList: {
    gap: 10,
    marginTop: 16,
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
  modalItemFigureFlag: {
    color: '#B91C1C',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
});
