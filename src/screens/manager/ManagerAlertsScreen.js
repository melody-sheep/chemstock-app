// src/screens/manager/ManagerAlertsScreen.js
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import Icon from '../../components/common/Icon';
import UserAvatar from '../../components/common/UserAvatar';
import BottomNavBar from '../../components/common/BottomNavBar';
import CustomModal from '../../components/common/Modal';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import reportService from '../../services/reportService';
import agentService from '../../services/agentService';
import { formatDisplayDate } from '../../utils/formatters';
import { getInitials } from '../../utils/initials';

export default function ManagerAlertsScreen() {
  const navigation = useNavigation();
  const [alerts, setAlerts] = useState([]);
  const [photoUrlByAgentId, setPhotoUrlByAgentId] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [sortNewestFirst, setSortNewestFirst] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState(null);

  const loadAlerts = useCallback(async () => {
    setIsLoading(true);
    const [alertsResult, agentsResult] = await Promise.all([
      reportService.getBranchDiscrepancies(200),
      agentService.getMyAgentAccounts(),
    ]);
    setAlerts(alertsResult.success ? alertsResult.data : []);
    setPhotoUrlByAgentId(
      agentsResult.success
        ? Object.fromEntries(agentsResult.data.map((a) => [a.id, a.profilePhotoUrl]))
        : {}
    );
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAlerts();
    }, [loadAlerts])
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

  const sortedAlerts = [...alerts].sort((a, b) => {
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

        <SecondaryHeader height={72} backgroundColor="#FFEEEE" borderColor="#FFD5D5">
          <View style={styles.bannerRow}>
            <Text style={styles.bannerTitle}>Alerts and Discrepancies</Text>
            <View style={styles.onlinePill}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Online</Text>
            </View>
          </View>
        </SecondaryHeader>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
              <Text style={styles.emptyText}>No discrepancy alerts right now.</Text>
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
                          <Text style={styles.alertCode} numberOfLines={1}>Code: {alert.productCode}</Text>
                          <Text style={styles.alertFullName} numberOfLines={1}>{alert.productName}</Text>
                          <Text style={styles.alertMeta}>Date: {formatDisplayDate(alert.reportDate)}</Text>
                        </View>

                        <View style={styles.missingWrap}>
                          <View style={styles.warningIconWrap}>
                            <Icon name="warningTriangle" size={18} color="#F04D59" weight="fill" />
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
                          <Text style={styles.figurePillText}>In Custody: {alert.inCustodyQuantity}x</Text>
                        </View>
                        <View style={styles.figurePill}>
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

        <BottomNavBar activeTab="dashboard" onTabPress={handleTabPress} onFabPress={() => {}} />
      </View>

      <CustomModal visible={!!selectedAlert} onClose={() => setSelectedAlert(null)} height={440}>
        {selectedAlert && (
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>{selectedAlert.productCode}</Text>
            <Text style={styles.modalSubtitle}>{selectedAlert.productName}</Text>
            <Text style={styles.modalMeta}>{selectedAlert.agentName} · {formatDisplayDate(selectedAlert.reportDate)}</Text>

            <View style={styles.modalFiguresRow}>
              <View style={styles.modalFigureColumn}>
                <Text style={styles.modalFigureLabel}>In Custody</Text>
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
              <View style={styles.modalFigureColumn}>
                <Text style={styles.modalFigureLabel}>
                  {selectedAlert.discrepancyType === 'loss' ? 'Missing' : 'Over'}
                </Text>
                <Text style={[styles.modalFigureValue, styles.modalFigureValueFlag]}>
                  {Math.abs(selectedAlert.discrepancy)}
                </Text>
              </View>
            </View>

            <Text style={styles.modalStatusText}>
              {selectedAlert.resolutionStatus === 'resolved'
                ? 'This discrepancy has been settled.'
                : selectedAlert.latestRequest?.status === 'pending'
                ? 'A return request from this Sales Rep is pending your review in Reports & Returns.'
                : 'No return request has been submitted for this discrepancy yet.'}
            </Text>
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
  bannerTitle: {
    fontSize: 19,
    color: '#B91C1C',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    flexShrink: 1,
    marginRight: 8,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' },
  onlineText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.success,
  },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: 96,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  alertDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
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
    fontWeight: '700',
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  alertsList: {
    gap: 16,
  },
  alertCard: {
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 14,
    padding: 12,
  },
  alertTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarMargin: {
    marginRight: 12,
  },
  alertDetails: {
    flex: 1,
  },
  alertCode: {
    fontSize: 15,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  alertFullName: {
    fontSize: 12,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  alertMeta: {
    fontSize: 11,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 4,
  },
  missingWrap: {
    alignItems: 'center',
  },
  warningIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFEEEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  missingText: {
    marginTop: 4,
    fontSize: 11,
    color: '#B91C1C',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
  },
  agentName: {
    fontSize: 13,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  agentRole: {
    fontSize: 11,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  settledTag: {
    marginLeft: 'auto',
    fontSize: 10,
    color: '#1E7A3A',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  pendingTag: {
    marginLeft: 'auto',
    fontSize: 10,
    color: '#B26400',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  figuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  figurePill: {
    backgroundColor: '#EAFBF2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  figurePillText: {
    fontSize: 10,
    color: '#1E7A3A',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  modalTitle: {
    fontSize: 17,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  modalMeta: {
    fontSize: 11,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 4,
    marginBottom: 16,
  },
  modalFiguresRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  modalFigureColumn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalFigureLabel: {
    fontSize: 10,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginBottom: 4,
  },
  modalFigureValue: {
    fontSize: 16,
    color: '#03045E',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  modalFigureValueFlag: {
    color: '#B91C1C',
  },
  modalStatusText: {
    fontSize: 12,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    lineHeight: 18,
  },
});
