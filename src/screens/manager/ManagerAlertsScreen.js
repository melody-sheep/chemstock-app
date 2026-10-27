// src/screens/manager/ManagerAlertsScreen.js
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import Alert from '../../utils/appAlert';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import useCachedFocusLoader from '../../hooks/useCachedFocusLoader';
import useConnectionStatus from '../../hooks/useConnectionStatus';
import useOnlineLabel from '../../hooks/useOnlineLabel';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import Icon from '../../components/common/Icon';
import UserAvatar from '../../components/common/UserAvatar';
import BottomNavBar, { useBottomNavBarHeight } from '../../components/common/BottomNavBar';
import CustomModal from '../../components/common/Modal';
import BranchSelector from '../../components/common/BranchSelector';
import QRScannerModal from '../../components/common/QRScannerModal';
import SectionHeader from '../../components/common/SectionHeader';
import Button from '../../components/common/Button';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import { describeReceivingScan } from '../../utils/scanLookup';
import ScanResultSheet from '../../components/common/ScanResultSheet';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import authService from '../../services/authService';
import reportService from '../../services/reportService';
import agentService from '../../services/agentService';
import requestService from '../../services/requestService';
import { formatDisplayDate } from '../../utils/formatters';
import { getInitials } from '../../utils/initials';
import friendlyError from '../../utils/friendlyError';

const ALL_BRANCHES_ID = 'all';

const productImageFor = (code) => PRODUCT_CATALOG.find((product) => product.code === code)?.image;
const productTintFor = (code) => PRODUCT_CATALOG.find((product) => product.code === code)?.tint;

// Returns the full alerts snapshot. If both sub-fetches failed (e.g. fully
// offline), keeps the previous snapshot entirely rather than blanking it.
const loadAlertsData = async (previous) => {
  const [manager, alertsResult, agentsResult] = await Promise.all([
    authService.getCurrentUser(),
    reportService.getBranchDiscrepancies(200),
    agentService.getMyAgentAccounts(),
  ]);
  const prev = previous?.managerId === manager?.id ? previous : null;

  if (!alertsResult.success && !agentsResult.success && prev) {
    return prev;
  }

  const managerBranches = await requestService.getAgentBranches(manager?.branchIds || []);

  return {
    managerId: manager?.id,
    alerts: alertsResult.success ? alertsResult.data : prev?.alerts ?? [],
    photoUrlByAgentId: agentsResult.success
      ? Object.fromEntries(agentsResult.data.map((a) => [a.id, a.profilePhotoUrl]))
      : prev?.photoUrlByAgentId ?? {},
    branches: managerBranches,
  };
};

// Three states, one colour each: settled (green), a return waiting on the manager (amber), open (red).
function alertStatus(alert) {
  if (alert.resolutionStatus === 'resolved') return { label: 'Settled', color: '#1E7A3A', bg: '#EAFBF2' };
  if (alert.latestRequest?.status === 'pending') return { label: 'Return pending', color: '#B26400', bg: '#FFF1D6' };
  if (alert.carryForwardEnabled) return { label: 'Unreported', color: '#8A5A00', bg: '#FFF1D6' };
  return { label: 'Open', color: '#B91C1C', bg: '#FDECEC' };
}

export default function ManagerAlertsScreen() {
  const navigation = useNavigation();
  const bottomNavHeight = useBottomNavBarHeight();
  const connection = useConnectionStatus();
  const onlineLabel = useOnlineLabel();
  const { data: snapshot, isLoading, isUnavailable, refreshControl } = useCachedFocusLoader('manager-alerts', loadAlertsData);
  const alerts = snapshot?.alerts ?? [];
  const photoUrlByAgentId = snapshot?.photoUrlByAgentId ?? {};
  const branches = snapshot?.branches ?? [];
  const [selectedBranchId, setSelectedBranchId] = useState(ALL_BRANCHES_ID);
  const [sortNewestFirst, setSortNewestFirst] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [scanSummary, setScanSummary] = useState(null);
  const [isNudging, setIsNudging] = useState(false);

  // Nudge: reminds the Sales Rep about this item (their bell and a push on their phone). The server allows one
  // reminder per item every 3 hours and says when the next one is allowed.
  const handleNudge = async (alert) => {
    if (isNudging) return;
    if (!connection.online) {
      Alert.alert('No Internet Connection', 'Sending a reminder needs a connection. Connect and try again.');
      return;
    }
    setIsNudging(true);
    const result = await reportService.nudgeReportItem(alert.reportItemId);
    setIsNudging(false);
    const name = alert.agentName || 'the Sales Rep';
    if (!result.success) {
      Alert.alert('Reminder Not Sent', friendlyError(result.message) || 'Please try again.');
      return;
    }
    if (result.data?.sent) {
      Alert.alert('Reminder Sent', `${name} gets a notification about ${Math.abs(alert.discrepancy)} ${alert.productCode}.`);
      return;
    }
    const next = result.data?.nextAllowedAt
      ? new Date(result.data.nextAllowedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : null;
    Alert.alert('Already Reminded', `You reminded ${name} about this item recently.${next ? ` You can remind them again after ${next}.` : ''}`);
  };

  // Sent here from a log row or a notification: open that discrepancy instead of leaving you on the list.
  // A report id opens it only when the report has a single discrepancy; with several, the list stays.
  const route = useRoute();
  const focusId = route.params?.focusId || null;
  const openedFocusIdRef = useRef(null);
  useEffect(() => {
    if (!focusId) {
      openedFocusIdRef.current = null;
      return;
    }
    if (isLoading || openedFocusIdRef.current === focusId) return;
    const sameReport = alerts.filter((a) => a.reportId === focusId);
    const match = alerts.find((a) => a.reportItemId === focusId) || (sameReport.length === 1 ? sameReport[0] : null);
    if (match) {
      openedFocusIdRef.current = focusId;
      setSelectedAlert(match);
    }
  }, [focusId, isLoading, alerts]);

  const handleScanned = async (qrCode) => {
    setIsScannerVisible(false);
    const currentManager = await authService.getCurrentUser();
    const summary = await describeReceivingScan(qrCode, currentManager?.branchIds || []);
    setScanSummary(summary);
  };

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

  // "All Branches" is only offered when there's actually more than one —
  // BranchSelector itself renders nothing for a single-branch account, so
  // prepending it only when branches.length > 1 keeps that same behavior.
  const branchFilterOptions =
    branches.length > 1 ? [{ id: ALL_BRANCHES_ID, name: 'All Branches' }, ...branches] : branches;

  const branchFilteredAlerts =
    selectedBranchId === ALL_BRANCHES_ID ? alerts : alerts.filter((a) => a.branchId === selectedBranchId);

  const sortedAlerts = [...branchFilteredAlerts].sort((a, b) => {
    const diff = new Date(a.reportDate).getTime() - new Date(b.reportDate).getTime();
    return sortNewestFirst ? -diff : diff;
  });

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

        <SecondaryHeader height={72}>
          <View style={styles.bannerRow}>
            <View style={styles.bannerTextCol}>
              <Text style={styles.bannerTitle} numberOfLines={1}>Alerts and Discrepancies</Text>
              <Text style={styles.bannerSubtitle}>Discrepancy reports from agents</Text>
            </View>
            <View style={styles.onlinePill}>
              <View style={[styles.onlineDot, !connection.online && styles.onlineDotOffline]} />
              <Text style={[styles.onlineText, !connection.online && styles.onlineTextOffline]}>
                {onlineLabel}
              </Text>
            </View>
          </View>
        </SecondaryHeader>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
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

            <View style={styles.sectionHeaderRow}>
              <SectionHeader icon="warningTriangle" size="md" label={`All alerts (${sortedAlerts.length})`} style={styles.alertsLabel} />
              <View style={{ flex: 1 }} />
              <View style={styles.sortRow}>
                <TouchableOpacity
                  style={[styles.sortPill, sortNewestFirst && styles.sortPillActive]}
                  onPress={() => setSortNewestFirst(true)}
                >
                  <Text style={[styles.sortPillText, sortNewestFirst && styles.sortPillTextActive]}>Newest</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sortPill, !sortNewestFirst && styles.sortPillActive]}
                  onPress={() => setSortNewestFirst(false)}
                >
                  <Text style={[styles.sortPillText, !sortNewestFirst && styles.sortPillTextActive]}>Oldest</Text>
                </TouchableOpacity>
              </View>
            </View>

            {sortedAlerts.length === 0 ? (
              <Text style={styles.emptyText}>{isUnavailable ? 'Not saved on this phone yet — connect to the internet to load it.' : 'No discrepancy alerts right now.'}</Text>
            ) : (
              <View style={styles.alertsList}>
                {sortedAlerts.map((alert) => {
                  const isLoss = alert.discrepancyType === 'loss';
                  const status = alertStatus(alert);
                  const isSettled = alert.resolutionStatus === 'resolved';
                  const image = productImageFor(alert.productCode);
                  return (
                    <TouchableOpacity
                      key={alert.reportItemId}
                      style={styles.alertCard}
                      onPress={() => setSelectedAlert(alert)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.productThumbWrap}>
                        {image ? (
                          <Image source={image} style={styles.productThumb} resizeMode="contain" />
                        ) : (
                          <Icon name="package" size={22} color={COLORS.textSecondary} />
                        )}
                      </View>

                      <View style={styles.alertDetails}>
                        <View style={styles.alertTitleRow}>
                          <Text style={styles.alertCode} numberOfLines={1}>{alert.productCode}</Text>
                          <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
                            <Text style={[styles.statusPillText, { color: status.color }]}>{status.label}</Text>
                          </View>
                        </View>
                        <View style={styles.alertAgentRow}>
                          <UserAvatar
                            photoUrl={photoUrlByAgentId[alert.agentId]}
                            fallbackText={getInitials(alert.agentName)}
                            size={18}
                            backgroundColor="#F1F3F6"
                            fallbackTextColor={COLORS.primary}
                          />
                          <Text style={styles.alertAgent}>
                            {alert.agentName}
                            {alert.branchName ? ` · ${alert.branchName}` : ''}
                          </Text>
                        </View>
                        <View style={styles.alertMetaRow}>
                          <Icon name="calendar" size={14} color={COLORS.textSecondary} />
                          <Text style={styles.alertMeta}>{formatDisplayDate(alert.reportDate)}</Text>
                          <Text style={styles.alertMeta}>·</Text>
                          <Text style={[
                            styles.alertMissing,
                            alert.carryForwardEnabled && styles.alertCarryForward,
                            isSettled && styles.alertMissingMuted,
                          ]}>
                            {Math.abs(alert.discrepancy)}x {alert.carryForwardEnabled ? 'Unreported' : isLoss ? 'Missing' : 'Over'}
                          </Text>
                        </View>
                      </View>
                      <Icon name="arrowRight" size={16} color="#94a3b8" />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <View style={{ height: 24 }} />
          </ScrollView>
        )}

        <BottomNavBar activeTab="dashboard" onTabPress={handleTabPress} onFabPress={() => setIsScannerVisible(true)} fabLabel="Scan" />
      </View>

      <QRScannerModal
        visible={isScannerVisible}
        onClose={() => setIsScannerVisible(false)}
        onScanned={handleScanned}
      />

      <CustomModal visible={!!selectedAlert} onClose={() => setSelectedAlert(null)} height="auto" maxHeight={640}>
        {selectedAlert && (() => {
          const status = alertStatus(selectedAlert);
          const isResolved = selectedAlert.resolutionStatus === 'resolved';
          const isPending = selectedAlert.latestRequest?.status === 'pending';
          const image = productImageFor(selectedAlert.productCode);
          return (
            <>
              <View style={styles.sheetHandle} />
              <View style={styles.modalHeroRow}>
                <View style={styles.modalThumbWrap}>
                  {image ? (
                    <Image source={image} style={styles.modalThumb} resizeMode="contain" />
                  ) : (
                    <Icon name="package" size={28} color={COLORS.textSecondary} />
                  )}
                </View>
                <View style={styles.modalHeroText}>
                  <Text style={styles.modalTitle} numberOfLines={1}>{selectedAlert.productCode}</Text>
                  {!!selectedAlert.productName && selectedAlert.productName !== selectedAlert.productCode && (
                    <Text style={styles.modalSubtitle} numberOfLines={1}>{selectedAlert.productName}</Text>
                  )}
                </View>
                <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
                  <Text style={[styles.statusPillText, { color: status.color }]}>{status.label}</Text>
                </View>
              </View>

              <View style={styles.modalMetaWrap}>
                <View style={styles.modalMetaRow}>
                  <Icon name="person" size={14} color={COLORS.textSecondary} />
                  <Text style={styles.modalMeta}>{selectedAlert.agentName}</Text>
                </View>
                {!!selectedAlert.branchName && (
                  <View style={styles.modalMetaRow}>
                    <Icon name="building" size={14} color={COLORS.textSecondary} />
                    <Text style={styles.modalMeta}>{selectedAlert.branchName}</Text>
                  </View>
                )}
                <View style={styles.modalMetaRow}>
                  <Icon name="calendar" size={14} color={COLORS.textSecondary} />
                  <Text style={styles.modalMeta}>{formatDisplayDate(selectedAlert.reportDate)}</Text>
                </View>
              </View>

              <View style={styles.modalFiguresRow}>
                <View style={styles.modalFigureColumn}>
                  <Text style={styles.modalFigureLabel}>In custody</Text>
                  <Text style={styles.modalFigureValue}>{selectedAlert.inCustodyQuantity}</Text>
                </View>
                <View style={styles.modalFigureColumn}>
                  <Text style={styles.modalFigureLabel}>Sold</Text>
                  <Text style={styles.modalFigureValue}>{selectedAlert.soldQuantity}</Text>
                </View>
                <View style={styles.modalFigureColumn}>
                  <Text style={styles.modalFigureLabel}>Return</Text>
                  <Text style={styles.modalFigureValue}>{selectedAlert.returnQuantity}</Text>
                </View>
                <View style={[
                  styles.modalFigureColumn,
                  selectedAlert.carryForwardEnabled ? styles.modalFigureColumnCarryForward : styles.modalFigureColumnFlag,
                ]}>
                  <Text style={[
                    styles.modalFigureLabel,
                    selectedAlert.carryForwardEnabled ? styles.modalFigureLabelCarryForward : styles.modalFigureLabelFlag,
                  ]}>
                    {selectedAlert.carryForwardEnabled ? 'Unreported' : selectedAlert.discrepancyType === 'loss' ? 'Missing' : 'Over'}
                  </Text>
                  <Text style={[
                    styles.modalFigureValue,
                    selectedAlert.carryForwardEnabled ? styles.modalFigureValueCarryForward : styles.modalFigureValueFlag,
                  ]}>
                    {Math.abs(selectedAlert.discrepancy)}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.modalStatusPanel,
                  { backgroundColor: isResolved ? '#EAFBF2' : isPending ? '#FFF3E0' : '#F1F3F6' },
                ]}
              >
                <Icon
                  name={isResolved ? 'checkCircle' : isPending ? 'clock' : 'sealWarning'}
                  size={18}
                  color={isResolved ? COLORS.success : isPending ? '#B26400' : COLORS.textSecondary}
                  weight="fill"
                />
                <Text
                  style={[
                    styles.modalStatusText,
                    { color: isResolved ? '#1E7A3A' : isPending ? '#8A5A00' : COLORS.textSecondary },
                  ]}
                >
                  {isResolved
                    ? 'This discrepancy has been settled.'
                    : isPending
                    ? 'A return request from this Sales Rep is pending your review in Reports & Returns.'
                    : selectedAlert.carryForwardEnabled
                    ? 'Not included in this report. These units remain in the Sales Rep’s inventory for the next report; this does not confirm physical loss.'
                    : 'No return request has been submitted for this discrepancy yet.'}
                </Text>
              </View>

              {!isResolved && !isPending && (
                <>
                  <Button
                    title={isNudging ? 'Sending…' : `Nudge ${selectedAlert.agentName || 'Sales Rep'}`}
                    variant="black"
                    onPress={() => handleNudge(selectedAlert)}
                    disabled={isNudging}
                    hasShadow={false}
                    height={48}
                    fontSize={16}
                    borderRadius={24}
                    style={styles.nudgeButton}
                  />
                  <Text style={styles.nudgeHint}>Sends a reminder to their phone. Once every 3 hours per item.</Text>
                </>
              )}

              <Button
                title="Close"
                variant="outline"
                onPress={() => setSelectedAlert(null)}
                hasShadow={false}
                height={48}
                fontSize={16}
                borderRadius={24}
                style={styles.closeButton}
              />
            </>
          );
        })()}
      </CustomModal>
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
  bannerRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
  },
  bannerTextCol: { flexShrink: 1, flex: 1, marginRight: SPACING.sm },
  bannerTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  bannerSubtitle: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' },
  onlineDotOffline: { backgroundColor: COLORS.warning },
  onlineText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.success,
  },
  onlineTextOffline: { color: COLORS.warning },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: 150,
  },
  branchFilterWrap: {
    marginBottom: SPACING.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  alertsLabel: { marginTop: 0, marginBottom: 0 },
  sortRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F3F6',
    borderRadius: 999,
    padding: 3,
  },
  sortPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  sortPillActive: {
    backgroundColor: '#FFFFFF',
  },
  sortPillText: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: COLORS.textSecondary,
  },
  sortPillTextActive: {
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  alertsList: {
    gap: SPACING.sm,
  },
  nudgeButton: { marginTop: SPACING.md },
  nudgeHint: { marginTop: 6, textAlign: 'center', fontSize: 12, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.regular },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: SPACING.sm,
  },
  productThumbWrap: {
    width: 56,
    height: 56,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  productThumb: { width: '100%', height: '100%' },
  alertDetails: {
    flex: 1,
    gap: 4,
  },
  alertTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  alertCode: {
    flexShrink: 1,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusPillText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  alertAgentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  alertAgent: {
    flexShrink: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  alertMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  alertMeta: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  alertMissing: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.error,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  alertCarryForward: { color: '#8A5A00' },
  alertMissingMuted: {
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
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
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  modalSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  modalHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  modalThumbWrap: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  modalThumb: { width: '100%', height: '100%' },
  modalHeroText: { flex: 1 },
  modalMetaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: SPACING.md,
    rowGap: 6,
    marginBottom: SPACING.md,
  },
  modalMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  modalMeta: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  modalFiguresRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: SPACING.md,
  },
  modalFigureColumn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F5F6F9',
  },
  modalFigureColumnFlag: {
    backgroundColor: '#FDECEC',
  },
  modalFigureColumnCarryForward: { backgroundColor: '#FFF7E6' },
  modalFigureLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  modalFigureLabelFlag: {
    color: '#B91C1C',
  },
  modalFigureLabelCarryForward: { color: '#8A5A00' },
  modalFigureValue: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  modalFigureValueFlag: {
    color: '#B91C1C',
  },
  modalFigureValueCarryForward: { color: '#8A5A00' },
  modalStatusPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: 12,
    padding: SPACING.sm,
  },
  modalStatusText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    lineHeight: 20,
  },
  closeButton: { marginTop: SPACING.md },
});
