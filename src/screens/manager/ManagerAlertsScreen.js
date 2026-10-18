// src/screens/manager/ManagerAlertsScreen.js
import React, { useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import useCachedFocusLoader from '../../hooks/useCachedFocusLoader';
import useConnectionStatus from '../../hooks/useConnectionStatus';
import useOnlineLabel from '../../hooks/useOnlineLabel';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import Icon from '../../components/common/Icon';
import UserAvatar from '../../components/common/UserAvatar';
import BottomNavBar from '../../components/common/BottomNavBar';
import CustomModal from '../../components/common/Modal';
import BranchSelector from '../../components/common/BranchSelector';
import QRScannerModal from '../../components/common/QRScannerModal';
import GlassPanel from '../../components/common/GlassPanel';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import { describeReceivingScan } from '../../utils/scanLookup';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import authService from '../../services/authService';
import reportService from '../../services/reportService';
import agentService from '../../services/agentService';
import requestService from '../../services/requestService';
import { formatDisplayDate } from '../../utils/formatters';
import { getInitials } from '../../utils/initials';

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

export default function ManagerAlertsScreen() {
  const navigation = useNavigation();
  const connection = useConnectionStatus();
  const onlineLabel = useOnlineLabel();
  const { data: snapshot, isLoading, isUnavailable } = useCachedFocusLoader('manager-alerts', loadAlertsData);
  const alerts = snapshot?.alerts ?? [];
  const photoUrlByAgentId = snapshot?.photoUrlByAgentId ?? {};
  const branches = snapshot?.branches ?? [];
  const [selectedBranchId, setSelectedBranchId] = useState(ALL_BRANCHES_ID);
  const [sortNewestFirst, setSortNewestFirst] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [isScannerVisible, setIsScannerVisible] = useState(false);

  const handleScanned = async (qrCode) => {
    setIsScannerVisible(false);
    const currentManager = await authService.getCurrentUser();
    const summary = await describeReceivingScan(qrCode, currentManager?.branchIds || []);
    Alert.alert(summary.title, summary.message);
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
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {branchFilterOptions.length > 1 && (
              <View style={styles.branchFilterWrap}>
                <BranchSelector
                  branches={branchFilterOptions}
                  selectedId={selectedBranchId}
                  onSelect={setSelectedBranchId}
                  edgePadding={SPACING.md}
                  truncateToFirstWord
                />
              </View>
            )}

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>All Alerts</Text>
              <View style={styles.alertDot} />
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
                  return (
                    <TouchableOpacity
                      key={alert.reportItemId}
                      style={styles.alertCard}
                      onPress={() => setSelectedAlert(alert)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.alertTopRow}>
                        <UserAvatar
                          photoUrl={photoUrlByAgentId[alert.agentId]}
                          fallbackText={getInitials(alert.agentName)}
                          size={44}
                          backgroundColor="#F1F3F6"
                          fallbackTextColor={COLORS.primary}
                          style={styles.avatarMargin}
                        />

                        <View style={styles.alertDetails}>
                          <Text style={styles.alertAgentName} numberOfLines={1}>{alert.agentName}</Text>
                          <View style={styles.codeRow}>
                            <View
                              style={[
                                styles.productThumbSmWrap,
                                { backgroundColor: productTintFor(alert.productCode) || COLORS.textWhite },
                              ]}
                            >
                              {productImageFor(alert.productCode) ? (
                                <Image
                                  source={productImageFor(alert.productCode)}
                                  style={styles.productThumbSm}
                                  resizeMode="contain"
                                />
                              ) : (
                                <Icon name="package" size={14} color={COLORS.primary} />
                              )}
                            </View>
                            <Text style={styles.alertCode} numberOfLines={1}>{alert.productCode}</Text>
                          </View>
                          <Text style={styles.alertFullName} numberOfLines={1}>{alert.productName}</Text>
                          <View style={styles.alertMetaRow}>
                            <Icon name="calendar" size={10} color={COLORS.textTertiary} />
                            <Text style={styles.alertMeta}>{formatDisplayDate(alert.reportDate)}</Text>
                            {alert.branchName && (
                              <View style={styles.branchBadge}>
                                <Icon name="building" size={10} color={COLORS.primary} />
                                <Text style={styles.branchBadgeText} numberOfLines={1}>{alert.branchName}</Text>
                              </View>
                            )}
                          </View>
                        </View>

                        <View style={styles.missingWrap}>
                          <View style={styles.warningIconWrap}>
                            <Icon name="warningTriangle" size={18} color={COLORS.error} weight="fill" />
                          </View>
                          <Text style={styles.missingText}>
                            {Math.abs(alert.discrepancy)}x {isLoss ? 'Missing' : 'Over'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.agentRow}>
                        <Text style={styles.agentName}>{alert.agentName}</Text>
                        <Text style={styles.agentRole}>Sales Rep</Text>
                        {alert.resolutionStatus === 'resolved' && (
                          <Text style={styles.settledTag}>Settled</Text>
                        )}
                        {alert.latestRequest?.status === 'pending' && (
                          <Text style={styles.pendingTag}>Return Pending</Text>
                        )}
                      </View>

                      <View style={styles.figuresRow}>
                        <View style={styles.figurePill}>
                          <Icon name="package" size={12} color="#1E7A3A" />
                          <Text style={styles.figurePillText}>In Custody: {alert.inCustodyQuantity}x</Text>
                        </View>
                        <View style={styles.figurePill}>
                          <Icon name="notePencil" size={12} color="#1E7A3A" />
                          <Text style={styles.figurePillText}>
                            Reported: {alert.soldQuantity} sold ({alert.returnQuantity} return)
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <View style={{ height: 24 }} />
          </ScrollView>
        )}

        <BottomNavBar activeTab="dashboard" onTabPress={handleTabPress} onFabPress={() => setIsScannerVisible(true)} />
      </View>

      <QRScannerModal
        visible={isScannerVisible}
        onClose={() => setIsScannerVisible(false)}
        onScanned={handleScanned}
      />

      <CustomModal visible={!!selectedAlert} onClose={() => setSelectedAlert(null)} height={480}>
        {selectedAlert && (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.modalHeroRow}>
              <View
                style={[
                  styles.modalThumbWrap,
                  { backgroundColor: productTintFor(selectedAlert.productCode) || COLORS.textWhite },
                ]}
              >
                {productImageFor(selectedAlert.productCode) ? (
                  <Image
                    source={productImageFor(selectedAlert.productCode)}
                    style={styles.modalThumb}
                    resizeMode="contain"
                  />
                ) : (
                  <Icon name="package" size={32} color={COLORS.primary} />
                )}
              </View>
              <View style={styles.modalHeroText}>
                <Text style={styles.modalTitle} numberOfLines={1}>{selectedAlert.productCode}</Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>{selectedAlert.productName}</Text>
                <View style={styles.modalMetaRow}>
                  <Icon name="person" size={11} color={COLORS.textTertiary} />
                  <Text style={styles.modalMeta} numberOfLines={1}>{selectedAlert.agentName}</Text>
                </View>
                {!!selectedAlert.branchName && (
                  <View style={styles.modalMetaRow}>
                    <Icon name="building" size={11} color={COLORS.textTertiary} />
                    <Text style={styles.modalMeta} numberOfLines={1}>{selectedAlert.branchName}</Text>
                  </View>
                )}
                <View style={styles.modalMetaRow}>
                  <Icon name="calendar" size={11} color={COLORS.textTertiary} />
                  <Text style={styles.modalMeta} numberOfLines={1}>{formatDisplayDate(selectedAlert.reportDate)}</Text>
                </View>
              </View>
            </View>

            <View style={styles.modalFiguresRow}>
              <View style={styles.modalFigureColumn}>
                <Icon name="package" size={16} color={COLORS.primary} />
                <Text style={styles.modalFigureLabel}>In Custody</Text>
                <Text style={styles.modalFigureValue}>{selectedAlert.inCustodyQuantity}</Text>
              </View>
              <View style={styles.modalFigureColumn}>
                <Icon name="notePencil" size={16} color={COLORS.primary} />
                <Text style={styles.modalFigureLabel}>Sold</Text>
                <Text style={styles.modalFigureValue}>{selectedAlert.soldQuantity}</Text>
              </View>
              <View style={styles.modalFigureColumn}>
                <Icon name="returnBox" size={16} color={COLORS.primary} />
                <Text style={styles.modalFigureLabel}>Return</Text>
                <Text style={styles.modalFigureValue}>{selectedAlert.returnQuantity}</Text>
              </View>
              <View style={[styles.modalFigureColumn, styles.modalFigureColumnFlag]}>
                <Icon name="warningTriangle" size={16} color={COLORS.error} />
                <Text style={[styles.modalFigureLabel, styles.modalFigureLabelFlag]}>
                  {selectedAlert.discrepancyType === 'loss' ? 'Missing' : 'Over'}
                </Text>
                <Text style={[styles.modalFigureValue, styles.modalFigureValueFlag]}>
                  {Math.abs(selectedAlert.discrepancy)}
                </Text>
              </View>
            </View>

            <GlassPanel style={styles.modalStatusPanel}>
              <View style={styles.modalStatusRow}>
                <Icon
                  name={
                    selectedAlert.resolutionStatus === 'resolved'
                      ? 'checkCircle'
                      : selectedAlert.latestRequest?.status === 'pending'
                      ? 'clock'
                      : 'sealWarning'
                  }
                  size={16}
                  color={
                    selectedAlert.resolutionStatus === 'resolved'
                      ? COLORS.success
                      : selectedAlert.latestRequest?.status === 'pending'
                      ? COLORS.warning
                      : COLORS.textSecondary
                  }
                  weight="fill"
                />
                <Text style={styles.modalStatusText}>
                  {selectedAlert.resolutionStatus === 'resolved'
                    ? 'This discrepancy has been settled.'
                    : selectedAlert.latestRequest?.status === 'pending'
                    ? 'A return request from this Sales Rep is pending your review in Reports & Returns.'
                    : 'No return request has been submitted for this discrepancy yet.'}
                </Text>
              </View>
            </GlassPanel>
          </ScrollView>
        )}
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
    paddingBottom: 96,
  },
  branchFilterWrap: {
    marginHorizontal: -SPACING.lg,
    marginBottom: SPACING.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  alertDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.error,
  },
  sortRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F3F6',
    borderRadius: 999,
    padding: 3,
  },
  sortPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  sortPillActive: {
    backgroundColor: '#FFFFFF',
  },
  sortPillText: {
    fontSize: 11,
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
    gap: SPACING.md,
  },
  alertCard: {
    borderWidth: 1,
    borderColor: '#ECEEF1',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: SPACING.sm,
  },
  alertTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarMargin: {
    marginRight: SPACING.sm,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: 4,
  },
  productThumbSmWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  productThumbSm: { width: '100%', height: '100%' },
  alertDetails: {
    flex: 1,
  },
  alertAgentName: {
    fontSize: 12,
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  alertCode: {
    flexShrink: 1,
    fontSize: 15,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  alertFullName: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  alertMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  alertMeta: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  branchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    maxWidth: 130,
    marginLeft: 4,
  },
  branchBadgeText: {
    fontSize: 10,
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  missingWrap: {
    alignItems: 'center',
    marginLeft: SPACING.sm,
  },
  warningIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.error + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  missingText: {
    marginTop: 4,
    fontSize: 11,
    color: COLORS.error,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
  },
  agentName: {
    fontSize: 13,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  agentRole: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  settledTag: {
    marginLeft: 'auto',
    fontSize: 10,
    color: COLORS.success,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  pendingTag: {
    marginLeft: 'auto',
    fontSize: 10,
    color: '#B26400',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  figuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: SPACING.sm,
  },
  figurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EAFBF2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  figurePillText: {
    fontSize: 10,
    color: '#1E7A3A',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
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
    marginBottom: 6,
  },
  modalMeta: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    flexShrink: 1,
  },
  modalHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  modalThumbWrap: {
    width: 64,
    height: 64,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  modalThumb: { width: '100%', height: '100%' },
  modalHeroText: { flex: 1 },
  modalMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  modalFiguresRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: SPACING.md,
  },
  modalFigureColumn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 10,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
  },
  modalFigureColumnFlag: {
    borderColor: COLORS.error + '30',
    backgroundColor: COLORS.error + '08',
  },
  modalFigureLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  modalFigureLabelFlag: {
    color: COLORS.error,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  modalFigureValue: {
    fontSize: 18,
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  modalFigureValueFlag: {
    color: COLORS.error,
  },
  modalStatusText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    lineHeight: 18,
  },
  modalStatusPanel: {
    borderRadius: 12,
    padding: SPACING.sm,
  },
  modalStatusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
});
