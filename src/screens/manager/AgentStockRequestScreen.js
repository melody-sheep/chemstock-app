// src/screens/manager/AgentStockRequestScreen.js
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import Icon from '../../components/common/Icon';
import Button from '../../components/common/Button';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import requestService from '../../services/requestService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { formatRelativeTime } from '../../utils/formatters';

// The DB only ever tracks 3 statuses (pending/accepted/declined) —
// fulfilled_transaction_id is what actually answers "did the release
// complete," so the 4th display state ("Fulfilled") is derived here rather
// than stored, per the reviewed design (see 2026-08-24_stock_requests.sql).
function getDisplayStatus(request) {
  if (request.status === 'accepted' && request.fulfilledTransactionId) return 'fulfilled';
  if (request.status === 'accepted') return 'preparing';
  return request.status;
}

const STATUS_META = {
  pending: { label: 'Pending', bg: '#FFF1D6', text: '#B26400' },
  preparing: { label: 'Preparing', bg: '#E3F2FF', text: '#0085F9' },
  fulfilled: { label: 'Fulfilled', bg: '#EAFBF2', text: '#1E7A3A' },
  declined: { label: 'Declined', bg: '#FBDCDC', text: '#B91C1C' },
};

export default function AgentStockRequestScreen() {
  const navigation = useNavigation();
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyRequestId, setBusyRequestId] = useState(null);
  const [declineTarget, setDeclineTarget] = useState(null);

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    const result = await requestService.getBranchStockRequests(50);
    setRequests(result.success ? result.data : []);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [loadRequests])
  );

  const handlePrepare = async (request) => {
    if (busyRequestId) return;
    setBusyRequestId(request.requestId);

    const result = await requestService.acceptStockRequest(request.requestId);
    setBusyRequestId(null);

    if (!result.success) {
      Alert.alert('Failed to Accept Request', result.message || 'Please try again.');
      return;
    }

    navigation.navigate('ReleaseStockRecipient', {
      prefillRequest: {
        requestId: request.requestId,
        requestedBy: { id: request.requestedById, fullName: request.requestedByName },
        items: request.items || [],
      },
    });
  };

  const confirmDecline = async () => {
    if (!declineTarget) return;
    setBusyRequestId(declineTarget.requestId);
    const result = await requestService.declineStockRequest(declineTarget.requestId, null);
    setBusyRequestId(null);
    setDeclineTarget(null);

    if (!result.success) {
      Alert.alert('Failed to Decline Request', result.message || 'Please try again.');
      return;
    }
    loadRequests();
  };

  const handleViewLogs = () => {
    navigation.navigate('StockLogs');
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

        <SecondaryHeader height={64} backgroundColor="#FFF5F8" borderColor="#F9C9DA">
          <View style={styles.titleRow}>
            <Text style={styles.pageTitle}>Agent Stock Request</Text>
          </View>
        </SecondaryHeader>

        <View style={styles.queueHeaderRow}>
          <View style={styles.onlineDot} />
          <Text style={styles.queueHeaderText}>Active Request Queue</Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : requests.length === 0 ? (
          <View style={styles.loadingWrap}>
            <Icon name="peopleGroup" size={32} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No stock requests yet.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {requests.map((request) => {
              const displayStatus = getDisplayStatus(request);
              const meta = STATUS_META[displayStatus];
              const isBusy = busyRequestId === request.requestId;

              return (
                <View key={request.requestId} style={styles.requestCard}>
                  <View style={styles.requestHeaderRow}>
                    <View style={styles.requestHeaderLeft}>
                      <Icon name="idCard" size={16} color={COLORS.primary} />
                      <Text style={styles.requestHeaderText}>
                        REQUEST: #{request.requestId.slice(0, 8).toUpperCase()}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: meta.text }]}>{meta.label}</Text>
                    </View>
                  </View>

                  <Text style={styles.requestMeta}>
                    From: {request.requestedByName} (Sales Rep)
                  </Text>
                  <Text style={styles.requestMeta}>Sent {formatRelativeTime(request.createdAt)}</Text>

                  <Text style={styles.itemsLabel}>Requested Items:</Text>
                  <View style={styles.itemsList}>
                    {(request.items || []).map((item, index) => (
                      <View key={`${item.productCode}-${index}`} style={styles.itemRow}>
                        <Icon name="boxPackage" size={14} color={COLORS.primary} />
                        <Text style={styles.itemText}>{item.productName}</Text>
                        <Text style={styles.itemQty}>Qty: {item.quantity}pcs</Text>
                      </View>
                    ))}
                  </View>

                  {displayStatus === 'declined' && request.declineReason && (
                    <Text style={styles.declineReasonText}>Reason: {request.declineReason}</Text>
                  )}

                  {(displayStatus === 'pending' || displayStatus === 'preparing') && (
                    <View style={styles.actionRow}>
                      <Button
                        title="Decline"
                        variant="outline"
                        onPress={() => setDeclineTarget(request)}
                        disabled={isBusy}
                        style={styles.actionButton}
                      />
                      {displayStatus === 'pending' && (
                        <Button
                          title={isBusy ? 'Preparing…' : 'Prepare'}
                          variant="black"
                          onPress={() => handlePrepare(request)}
                          loading={isBusy}
                          disabled={isBusy}
                          style={styles.actionButton}
                        />
                      )}
                    </View>
                  )}

                  {displayStatus === 'fulfilled' && (
                    <Button title="View Logs" variant="outline" onPress={handleViewLogs} style={styles.viewLogsButton} />
                  )}
                </View>
              );
            })}
            <View style={{ height: 24 }} />
          </ScrollView>
        )}
      </View>

      <ConfirmationDialog
        visible={!!declineTarget}
        onCancel={() => setDeclineTarget(null)}
        onConfirm={confirmDecline}
        icon="xCircle"
        title="Decline Request"
        description={`This will decline ${declineTarget?.requestedByName || 'this'}'s stock request. This can't be undone.`}
        confirmLabel="Decline"
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  titleRow: { flex: 1, justifyContent: 'center', paddingHorizontal: SPACING.md },
  pageTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#E63946',
  },
  queueHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F9C9DA',
  },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success },
  queueHeaderText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  content: { padding: SPACING.lg, gap: SPACING.md },
  requestCard: {
    borderWidth: 1,
    borderColor: '#F9C9DA',
    borderRadius: 12,
    backgroundColor: '#FFF9FB',
    padding: SPACING.md,
    gap: 4,
  },
  requestHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  requestHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  requestHeaderText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusBadgeText: { fontSize: 10, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: TYPOGRAPHY.fontWeight.bold },
  requestMeta: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  itemsLabel: {
    marginTop: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: '#272632',
  },
  itemsList: { marginTop: 4, gap: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemText: { flex: 1, fontSize: 12, fontFamily: TYPOGRAPHY.fontFamily.medium, color: '#272632' },
  itemQty: { fontSize: 12, fontFamily: TYPOGRAPHY.fontFamily.regular, color: COLORS.textSecondary },
  declineReasonText: {
    marginTop: SPACING.xs,
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.error,
  },
  actionRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  actionButton: { flex: 1 },
  viewLogsButton: { marginTop: SPACING.sm },
});
