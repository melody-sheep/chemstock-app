// src/screens/salesrep/SalesRepStockRequestsScreen.js
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import Header from '../../components/common/Header';
import Icon from '../../components/common/Icon';
import authService from '../../services/authService';
import requestService from '../../services/requestService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { formatRelativeTime } from '../../utils/formatters';

// Same derived 4th state as the Manager's AgentStockRequestScreen —
// fulfilled_transaction_id (not the raw 'accepted' status) is what actually
// answers "did the release complete," per the reviewed request-flow design.
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

export default function SalesRepStockRequestsScreen() {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    const agent = await authService.getCurrentUser();
    const result = await requestService.getMyStockRequests(agent?.id, 50);
    setRequests(result.success ? result.data : []);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [loadRequests])
  );

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton
          backButtonText="Sales Rep Dashboard"
          title="My Stock Requests"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
        />

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : requests.length === 0 ? (
          <View style={styles.loadingWrap}>
            <Icon name="notePencil" size={32} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No stock requests yet.</Text>
            <Text style={styles.emptySubtext}>Requests you send to your manager will show up here.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {requests.map((request) => {
              const displayStatus = getDisplayStatus(request);
              const meta = STATUS_META[displayStatus];
              const units = (request.items || []).reduce((sum, item) => sum + item.quantity, 0);

              return (
                <View key={request.requestId} style={styles.requestCard}>
                  <View style={styles.requestHeaderRow}>
                    <Text style={styles.requestHeaderText}>
                      REQUEST: #{request.requestId.slice(0, 8).toUpperCase()}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: meta.text }]}>{meta.label}</Text>
                    </View>
                  </View>

                  <Text style={styles.requestMeta}>Sent {formatRelativeTime(request.createdAt)}</Text>
                  <Text style={styles.requestMeta}>
                    {units} unit{units === 1 ? '' : 's'} · {(request.items || []).length} product
                    {(request.items || []).length === 1 ? '' : 's'}
                  </Text>

                  <View style={styles.itemsList}>
                    {(request.items || []).map((item, index) => (
                      <View key={`${item.productCode}-${index}`} style={styles.itemRow}>
                        <Icon name="boxPackage" size={14} color={COLORS.primary} />
                        <Text style={styles.itemText}>{item.productName}</Text>
                        <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
                      </View>
                    ))}
                  </View>

                  {displayStatus === 'declined' && request.declineReason && (
                    <Text style={styles.declineReasonText}>Reason: {request.declineReason}</Text>
                  )}
                </View>
              );
            })}
            <View style={{ height: 24 }} />
          </ScrollView>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.xl },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textSecondary,
  },
  emptySubtext: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  content: { padding: SPACING.lg, gap: SPACING.md },
  requestCard: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: SPACING.md,
    gap: 4,
  },
  requestHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
  itemsList: { marginTop: SPACING.xs, gap: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemText: { flex: 1, fontSize: 12, fontFamily: TYPOGRAPHY.fontFamily.medium, color: '#272632' },
  itemQty: { fontSize: 12, fontFamily: TYPOGRAPHY.fontFamily.regular, color: COLORS.textSecondary },
  declineReasonText: {
    marginTop: SPACING.xs,
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.error,
  },
});
