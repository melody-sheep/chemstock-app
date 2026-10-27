// src/screens/manager/ManageReturnsScreen.js
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Dimensions } from 'react-native';
import Alert from '../../utils/appAlert';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import LiveStatusPill from '../../components/common/LiveStatusPill';
import SectionHeader from '../../components/common/SectionHeader';
import Icon from '../../components/common/Icon';
import UserAvatar from '../../components/common/UserAvatar';
import BottomNavBar, { useBottomNavBarHeight } from '../../components/common/BottomNavBar';
import CustomModal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import CameraCaptureModal from '../../components/common/CameraCaptureModal';
import BranchSelector from '../../components/common/BranchSelector';
import QRScannerModal from '../../components/common/QRScannerModal';
import { describeReceivingScan } from '../../utils/scanLookup';
import ScanResultSheet from '../../components/common/ScanResultSheet';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import authService from '../../services/authService';
import requireOnline from '../../utils/requireOnline';
import useCachedFocusLoader from '../../hooks/useCachedFocusLoader';
import reportService from '../../services/reportService';
import agentService from '../../services/agentService';
import requestService from '../../services/requestService';
import { formatDisplayDate, formatDateTime, formatRelativeTime } from '../../utils/formatters';
import { getInitials } from '../../utils/initials';
import friendlyError from '../../utils/friendlyError';

const ALL_BRANCHES_ID = 'all';

const TABS = [
  { key: 'reports', label: 'Reports', icon: 'clipboardText' },
  { key: 'returns', label: 'Returns', icon: 'returns' },
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
  const bottomNavHeight = useBottomNavBarHeight();
  const route = useRoute();
  const focusId = route.params?.focusId || null;
  const openedFocusIdRef = useRef(null);
  const [activeTab, setActiveTab] = useState('reports');
  const [activeReturnSubTab, setActiveReturnSubTab] = useState('pending');
  const [selectedBranchId, setSelectedBranchId] = useState(ALL_BRANCHES_ID);
  const [selectedReport, setSelectedReport] = useState(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [reportPhotoUrl, setReportPhotoUrl] = useState(null);
  const [isLoadingReportPhoto, setIsLoadingReportPhoto] = useState(false);
  const [isViewingReportPhoto, setIsViewingReportPhoto] = useState(false);
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [scanSummary, setScanSummary] = useState(null);
  // An accepted/rejected return opened for reading only (pending ones still go to the verify screen).
  const [viewedReturn, setViewedReturn] = useState(null);

  const handleScanned = async (qrCode) => {
    setIsScannerVisible(false);
    const currentManager = await authService.getCurrentUser();
    const summary = await describeReceivingScan(qrCode, currentManager?.branchIds || []);
    setScanSummary(summary);
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

  // Tapped from a notification: open that report (or return) instead of leaving you on the list.
  useEffect(() => {
    if (!focusId) {
      openedFocusIdRef.current = null;
      return;
    }
    if (isLoading || openedFocusIdRef.current === focusId) return;
    const report = reports.find((r) => r.reportId === focusId);
    if (report) {
      openedFocusIdRef.current = focusId;
      setActiveTab('reports');
      setSelectedReport(report);
      return;
    }
    const returnRequest = returnRequests.find((r) => r.resolutionRequestId === focusId);
    if (returnRequest) {
      openedFocusIdRef.current = focusId;
      setActiveTab('returns');
      if (returnRequest.status === 'pending') {
        setActiveReturnSubTab('pending');
        // Straight to the review screen; Back then returns to Notifications.
        navigation.replace('ReturnStockVerify', {
          returnRequest: { ...returnRequest, agentPhotoUrl: photoUrlByAgentId[returnRequest.agentId] },
        });
      } else {
        setActiveReturnSubTab('confirmed');
        setViewedReturn(returnRequest);
      }
    }
  }, [focusId, isLoading, reports, returnRequests]);

  const handleOpenReturn = (item) => {
    if (activeReturnSubTab !== 'pending') return;
    navigation.navigate('ReturnStockVerify', {
      returnRequest: { ...item, agentPhotoUrl: photoUrlByAgentId[item.agentId] },
    });
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
                <Icon name={tab.icon} size={18} color={isActive ? '#0085F9' : COLORS.textSecondary} />
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
          refreshControl={refreshControl} contentContainerStyle={[styles.content, { paddingBottom: bottomNavHeight + 56 }]} showsVerticalScrollIndicator={false}>
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

            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomNavHeight + 56 }]} showsVerticalScrollIndicator={false}>
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
                    onPress={() => (activeReturnSubTab === 'pending' ? handleOpenReturn(item) : setViewedReturn(item))}
                    activeOpacity={0.7}
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

                    <Icon name="arrowRight" size={18} color="#94a3b8" style={styles.chevron} />
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

      <CustomModal
        visible={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        height={Dimensions.get('window').height * 0.68}
        scrollableContent
      >
        {selectedReport && (
          <>
            <ScrollView
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              style={styles.sheetScroll}
            >
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <UserAvatar
                  photoUrl={photoUrlByAgentId[selectedReport.agentId]}
                  fallbackText={getInitials(selectedReport.agentName)}
                  size={48}
                  backgroundColor="#F1F3F6"
                  fallbackTextColor={COLORS.primary}
                />
                <View style={styles.sheetHeaderText}>
                  <Text style={styles.modalTitle} numberOfLines={1}>{selectedReport.agentName}</Text>
                  <View style={styles.sheetMetaRow}>
                    {!!selectedReport.branchName && (
                      <>
                        <Icon name="home" size={13} color={COLORS.textSecondary} />
                        <Text style={styles.sheetMetaText}>{selectedReport.branchName}</Text>
                        <Text style={styles.sheetMetaText}>·</Text>
                      </>
                    )}
                    <Icon name="calendar" size={13} color={COLORS.textSecondary} />
                    <Text style={styles.sheetMetaText}>{formatDisplayDate(selectedReport.reportDate)}</Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    selectedReport.status === 'pending' ? styles.statusBadgePending : styles.statusBadgeConfirmed,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      selectedReport.status === 'pending' ? styles.statusBadgeTextPending : styles.statusBadgeTextConfirmed,
                    ]}
                  >
                    {selectedReport.status === 'pending' ? 'Pending' : 'Accepted'}
                  </Text>
                </View>
              </View>

              {selectedReport.carryForwardEnabled && (selectedReport.items || []).some((item) => item.discrepancy < 0) && (
                <View style={styles.carryForwardNote}>
                  <Icon name="warningTriangle" size={16} color="#D98200" />
                  <Text style={styles.carryForwardNoteText}>
                    Unreported units remain in the Sales Rep’s inventory for the next report. They are not confirmed lost.
                  </Text>
                </View>
              )}

              <SectionHeader icon="camera" size="md" label="Handover photo" style={styles.sheetLabelFirst} />
              {selectedReport.isAutoFiled ? (
                <View style={styles.autoFiledNote}>
                  <Icon name="warningTriangle" size={16} color="#D98200" />
                  <Text style={styles.autoFiledText}>
                    Auto-filed for a missed day. No photo was submitted.
                  </Text>
                </View>
              ) : isLoadingReportPhoto ? (
                <View style={styles.photoFrame}>
                  <ActivityIndicator color={COLORS.primary} />
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.photoFrame}
                  onPress={() => reportPhotoUrl && setIsViewingReportPhoto(true)}
                  activeOpacity={reportPhotoUrl ? 0.85 : 1}
                  accessibilityRole="button"
                  accessibilityLabel="View the handover photo"
                >
                  {reportPhotoUrl ? (
                    <>
                      <Image source={{ uri: reportPhotoUrl }} style={styles.photoImage} resizeMode="cover" />
                      <View style={styles.photoExpand}>
                        <Icon name="expand" size={16} color="#FFFFFF" />
                      </View>
                    </>
                  ) : (
                    <Text style={styles.photoMissingText}>Photo not available</Text>
                  )}
                </TouchableOpacity>
              )}

              <SectionHeader
                icon="package"
                size="md"
                label={`Items (${(selectedReport.items || []).length})`}
                style={styles.sheetLabel}
              />
              <View style={styles.modalItemsList}>
                {(selectedReport.items || []).map((item) => {
                  const image = PRODUCT_CATALOG.find((p) => p.code === item.productCode)?.image;
                  const hasGap = item.discrepancy !== 0;
                  const isCarryForward = item.resolutionStatus === 'carried_forward'
                    || (selectedReport.carryForwardEnabled && item.discrepancy < 0);
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
                        <View style={styles.modalItemTitleCol}>
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
                        <View style={[styles.statBox, hasGap && styles.statBoxFlag, isCarryForward && styles.statBoxCarryForward]}>
                          <Text style={[styles.statLabel, hasGap && styles.statLabelFlag, isCarryForward && styles.statLabelCarryForward]}>
                            {item.resolutionStatus === 'carried_forward'
                              ? 'Carried'
                              : selectedReport.carryForwardEnabled && item.discrepancy < 0
                              ? 'Unreported'
                              : hasGap ? 'Discrepancy' : 'Diff'}
                          </Text>
                          <Text style={[styles.statValue, hasGap && styles.statValueFlag, isCarryForward && styles.statLabelCarryForward]}>
                            {isCarryForward ? Math.abs(item.discrepancy) : item.discrepancy}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            {selectedReport.status === 'pending' && (
              <Button
                title={isAccepting ? 'Accepting…' : 'Accept Report'}
                onPress={handleAcceptReport}
                disabled={isAccepting}
                height={48}
                fontSize={16}
                borderRadius={24}
                style={styles.acceptButton}
              />
            )}
            {selectedReport.status !== 'pending' && (
              <Button
                title="Close"
                variant="outline"
                onPress={() => setSelectedReport(null)}
                height={48}
                fontSize={16}
                borderRadius={24}
                style={styles.acceptButton}
              />
            )}
          </>
        )}
      </CustomModal>

      <CustomModal visible={!!viewedReturn} onClose={() => setViewedReturn(null)} height="auto" maxHeight={640}>
        {viewedReturn && (
          <>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <UserAvatar
                photoUrl={photoUrlByAgentId[viewedReturn.agentId]}
                fallbackText={getInitials(viewedReturn.agentName)}
                size={48}
                backgroundColor="#F1F3F6"
                fallbackTextColor={COLORS.primary}
              />
              <View style={styles.sheetHeaderText}>
                <Text style={styles.modalTitle} numberOfLines={1}>{viewedReturn.agentName}</Text>
                <View style={styles.sheetMetaRow}>
                  <Icon name="clock" size={13} color={COLORS.textSecondary} />
                  <Text style={styles.sheetMetaText}>Sent {formatRelativeTime(viewedReturn.createdAt)}</Text>
                </View>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  viewedReturn.status === 'accepted' ? styles.statusBadgeConfirmed : styles.statusBadgeRejected,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    viewedReturn.status === 'accepted' ? styles.statusBadgeTextConfirmed : styles.statusBadgeTextRejected,
                  ]}
                >
                  {viewedReturn.status === 'accepted' ? 'Accepted' : 'Rejected'}
                </Text>
              </View>
            </View>

            <SectionHeader icon="package" size="md" label="Returned item" style={styles.sheetLabelFirst} />
            <View style={styles.modalItemCard}>
              <View style={styles.modalItemTop}>
                <View style={styles.modalItemThumb}>
                  {PRODUCT_CATALOG.find((p) => p.code === viewedReturn.productCode)?.image ? (
                    <Image
                      source={PRODUCT_CATALOG.find((p) => p.code === viewedReturn.productCode).image}
                      style={styles.modalItemImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <Icon name="boxPackage" size={22} />
                  )}
                </View>
                <View style={styles.modalItemTitleCol}>
                  <Text style={styles.modalItemCode}>{viewedReturn.productCode}</Text>
                  {!!viewedReturn.productName && viewedReturn.productName !== viewedReturn.productCode && (
                    <Text style={styles.modalItemName}>{viewedReturn.productName}</Text>
                  )}
                </View>
              </View>
              <View style={styles.statRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>
                    {viewedReturn.status === 'accepted' ? 'Units restocked' : 'Units in return'}
                  </Text>
                  <Text style={styles.statValue}>{Math.abs(viewedReturn.discrepancy)}</Text>
                </View>
              </View>
            </View>

            <SectionHeader icon="clipboardText" size="md" label="Details" style={styles.sheetLabel} />
            <View style={styles.detailsCard}>
              {!!viewedReturn.reportDate && (
                <View style={styles.detailRow}>
                  <Icon name="calendar" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.detailLabel}>Report date</Text>
                  <Text style={styles.detailValue}>{formatDisplayDate(viewedReturn.reportDate)}</Text>
                </View>
              )}
              <View style={styles.detailRow}>
                <Icon name="clock" size={16} color={COLORS.textSecondary} />
                <Text style={styles.detailLabel}>Sent</Text>
                <Text style={styles.detailValue}>{formatDateTime(new Date(viewedReturn.createdAt))}</Text>
              </View>
              {!!viewedReturn.resolvedAt && (
                <View style={styles.detailRow}>
                  <Icon name="checkCircle" size={16} color={COLORS.success} />
                  <Text style={styles.detailLabel}>Reviewed</Text>
                  <Text style={styles.detailValue}>{formatDateTime(new Date(viewedReturn.resolvedAt))}</Text>
                </View>
              )}
              {!!viewedReturn.gps && (
                <View style={styles.detailRow}>
                  <Icon name="location" size={16} color={COLORS.error} />
                  <Text style={styles.detailLabel}>Location</Text>
                  <Text style={styles.detailValue}>
                    {Number(viewedReturn.gps.latitude).toFixed(5)}, {Number(viewedReturn.gps.longitude).toFixed(5)}
                  </Text>
                </View>
              )}
              {!!viewedReturn.media?.deviceModel && (
                <View style={styles.detailRow}>
                  <Icon name="phone" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.detailLabel}>Device</Text>
                  <Text style={styles.detailValue}>{viewedReturn.media.deviceModel}</Text>
                </View>
              )}
            </View>

            {viewedReturn.status !== 'accepted' && !!viewedReturn.rejectReason && (
              <View style={styles.rejectNote}>
                <Icon name="warningTriangle" size={16} color="#B91C1C" />
                <Text style={styles.rejectNoteText}>{viewedReturn.rejectReason}</Text>
              </View>
            )}

            <Button
              title="Close"
              variant="outline"
              onPress={() => setViewedReturn(null)}
              hasShadow={false}
              height={48}
              fontSize={16}
              borderRadius={24}
              style={styles.acceptButton}
            />
          </>
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
      <ScanResultSheet
        summary={scanSummary}
        onClose={() => setScanSummary(null)}
        onScanAgain={() => {
          setScanSummary(null);
          setIsScannerVisible(true);
        }}
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
    borderRadius: 26,
    backgroundColor: '#ECEEF3',
    padding: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'transparent',
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
    borderColor: '#0085F9',
  },
  tabButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
  },
  tabButtonTextActive: {
    color: '#0085F9',
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
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#DADDE3',
    marginTop: -SPACING.sm,
    marginBottom: SPACING.md,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs },
  sheetHeaderText: { flex: 1 },
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  sheetMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 3 },
  sheetMetaText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  sheetScroll: { flex: 1, minHeight: 0 },
  sheetLabelFirst: { marginTop: SPACING.sm, marginBottom: 0 },
  sheetLabel: { marginTop: SPACING.lg, marginBottom: 0 },
  photoFrame: {
    marginTop: SPACING.sm,
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoImage: { width: '100%', height: '100%' },
  photoExpand: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoMissingText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  autoFiledNote: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F59E0B66',
    backgroundColor: '#FFF3E0',
  },
  autoFiledText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: '#8A5A00',
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  carryForwardNote: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#F59E0B66',
    backgroundColor: '#FFF3E0',
  },
  carryForwardNoteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#8A5A00',
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  modalItemsList: { gap: SPACING.sm, marginTop: SPACING.sm },
  modalItemCard: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  modalItemTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  modalItemThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  modalItemImage: { width: '100%', height: '100%' },
  modalItemTitleCol: { flex: 1 },
  modalItemCode: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  modalItemName: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  statRow: { flexDirection: 'row', gap: 6 },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F5F6F9',
  },
  statBoxFlag: { backgroundColor: '#FDECEC' },
  statBoxCarryForward: { backgroundColor: '#FFF7E6' },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  statLabelFlag: { color: '#B91C1C' },
  statLabelCarryForward: { color: '#8A5A00' },
  statValue: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  statValueFlag: { color: '#B91C1C' },
  acceptButton: { marginTop: SPACING.md },
  rejectNote: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.sm,
    borderRadius: 10,
    backgroundColor: '#FDECEC',
  },
  rejectNoteText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: '#B91C1C',
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  detailsCard: {
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 10 },
  detailLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  detailValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: '600',
  },
});
