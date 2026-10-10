// src/screens/salesrep/AlertsDiscrepanciesSR.js
import React from 'react';
import { View, Text, Image, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import useCachedFocusLoader from '../../hooks/useCachedFocusLoader';
import useConnectionStatus from '../../hooks/useConnectionStatus';
import useOutbox from '../../hooks/useOutbox';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import Icon from '../../components/common/Icon';
import { TYPOGRAPHY } from '../../styles/typography';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { formatClockTime } from '../../utils/formatters';
import authService from '../../services/authService';
import reportService from '../../services/reportService';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';

// A failed fetch keeps the previous list instead of blanking it.
const loadDiscrepanciesData = async (previous) => {
  const agent = await authService.getCurrentUser();
  const prev = previous?.agentId === agent?.id ? previous : null;
  const result = await reportService.getMyDiscrepancies(agent?.id, 50);
  return {
    agentId: agent?.id,
    discrepancies: result.success ? result.data : prev?.discrepancies ?? [],
  };
};

export default function AlertsDiscrepanciesSR() {
  const navigation = useNavigation();
  const connection = useConnectionStatus();
  const { data: snapshot, isLoading } = useCachedFocusLoader('sales-rep-discrepancies', loadDiscrepanciesData);
  const discrepancies = snapshot?.discrepancies ?? [];
  const { pending: queuedResolutions } = useOutbox('discrepancy_resolution');
  const queuedReportItemIds = new Set(queuedResolutions.map((e) => e.payload?.reportItemId));

  const handleBack = () => navigation.goBack();

  const pendingItems = discrepancies.filter((d) => d.resolutionStatus === 'open');
  const settledItems = discrepancies.filter((d) => d.resolutionStatus === 'resolved');

  const renderPendingCard = (item) => (
    <Pressable
      key={item.reportItemId}
      style={styles.itemCard}
      onPress={() => navigation.navigate('ResolveDiscrepancy', { reportItem: item })}
    >
      <View style={styles.itemTopRow}>
        <View style={styles.thumbnailWrap}>
          <View style={styles.thumbnail}>
            {PRODUCT_CATALOG.find((p) => p.code === item.productCode)?.image ? (
              <Image
                source={PRODUCT_CATALOG.find((p) => p.code === item.productCode).image}
                style={styles.thumbnailImage}
                resizeMode="contain"
              />
            ) : (
              <Icon name="package" size={26} color="#94a3b8" />
            )}
          </View>
        </View>

        <View style={styles.itemDetails}>
          <View style={styles.itemNameRow}>
            <Text style={styles.itemCode} numberOfLines={1}>{item.productCode}</Text>
            <View style={item.discrepancyType === 'loss' ? styles.missingBadge : styles.overBadge}>
              <Text style={styles.missingBadgeText}>
                {Math.abs(item.discrepancy)} {item.discrepancyType === 'loss' ? 'Missing' : 'Over'}
              </Text>
            </View>
          </View>
          <Text style={styles.itemFullName} numberOfLines={1}>{item.productName}</Text>
          <View style={styles.itemMetaRow}>
            <Icon name="trayDown" size={11} color="#555353" />
            <Text style={styles.itemMeta}>In Custody: {item.inCustodyQuantity}</Text>
          </View>
          {queuedReportItemIds.has(item.reportItemId) ? (
            // Queued locally, not yet synced — the server doesn't know about
            // this request yet, so it takes priority over whatever
            // latestRequest says below.
            <Text style={styles.queuedRequestText}>⏳ Saved offline — will send once you're back online</Text>
          ) : item.latestRequest?.status === 'pending' ? (
            <Text style={styles.pendingRequestText}>Return request pending manager review</Text>
          ) : item.latestRequest?.status === 'rejected' ? (
            <Text style={styles.rejectedRequestText}>
              Last request rejected{item.latestRequest.rejectReason ? `: ${item.latestRequest.rejectReason}` : ''} — tap to resubmit
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.figuresRow}>
        <View style={styles.figureColumn}>
          <View style={styles.figureLabelRow}>
            <Icon name="trayDown" size={11} color="#272632" />
            <Text style={styles.figureLabel}>Released</Text>
          </View>
          <View style={styles.figureBox}>
            <Text style={styles.figureValue}>{item.inCustodyQuantity}</Text>
          </View>
        </View>
        <View style={styles.figureColumn}>
          <View style={styles.figureLabelRow}>
            <Icon name="checkCircle" size={11} color="#272632" />
            <Text style={styles.figureLabel}>Sold</Text>
          </View>
          <View style={styles.figureBox}>
            <Text style={styles.figureValue}>{item.soldQuantity}</Text>
          </View>
        </View>
        <View style={styles.figureColumn}>
          <View style={styles.figureLabelRow}>
            <Icon name="returns" size={11} color="#272632" />
            <Text style={styles.figureLabel}>Return</Text>
          </View>
          <View style={styles.figureBox}>
            <Text style={styles.figureValue}>{item.returnQuantity}</Text>
          </View>
        </View>
        <View style={styles.figureColumn}>
          <View style={styles.figureLabelRow}>
            <Icon name="warningTriangle" size={11} color="#B91C1C" />
            <Text style={[styles.figureLabel, styles.missingLabel]}>
              {item.discrepancyType === 'loss' ? 'Missing' : 'Over'}
            </Text>
          </View>
          <View style={[styles.figureBox, styles.figureBoxError]}>
            <Text style={[styles.figureValue, styles.figureValueError]}>{Math.abs(item.discrepancy)}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );

  const renderSettledCard = (item) => (
    <Pressable
      key={item.reportItemId}
      style={styles.itemCard}
      onPress={() => navigation.navigate('ResolveDiscrepancy', { reportItem: item })}
    >
      <View style={styles.itemTopRow}>
        <View style={styles.thumbnailWrap}>
          <View style={styles.thumbnail}>
            {PRODUCT_CATALOG.find((p) => p.code === item.productCode)?.image ? (
              <Image
                source={PRODUCT_CATALOG.find((p) => p.code === item.productCode).image}
                style={styles.thumbnailImage}
                resizeMode="contain"
              />
            ) : (
              <Icon name="package" size={26} color="#94a3b8" />
            )}
          </View>
        </View>

        <View style={styles.itemDetails}>
          <View style={styles.itemNameRow}>
            <Text style={styles.itemCode} numberOfLines={1}>{item.productCode}</Text>
            <View style={styles.settledBadge}>
              <Text style={styles.settledBadgeText}>Settled</Text>
            </View>
          </View>
          <Text style={styles.itemFullName} numberOfLines={1}>{item.productName}</Text>
          <View style={styles.itemMetaRow}>
            <Icon name="trayDown" size={11} color="#555353" />
            <Text style={styles.itemMeta}>In Custody: {item.inCustodyQuantity}</Text>
          </View>
        </View>
      </View>

      <View style={styles.figuresRow}>
        <View style={styles.figureColumn}>
          <View style={styles.figureLabelRow}>
            <Icon name="trayDown" size={11} color="#272632" />
            <Text style={styles.figureLabel}>Released</Text>
          </View>
          <View style={styles.figureBox}>
            <Text style={styles.figureValue}>{item.inCustodyQuantity}</Text>
          </View>
        </View>
        <View style={styles.figureColumn}>
          <View style={styles.figureLabelRow}>
            <Icon name="checkCircle" size={11} color="#272632" />
            <Text style={styles.figureLabel}>Sold</Text>
          </View>
          <View style={styles.figureBox}>
            <Text style={styles.figureValue}>{item.soldQuantity}</Text>
          </View>
        </View>
        <View style={styles.figureColumn}>
          <View style={styles.figureLabelRow}>
            <Icon name="returns" size={11} color="#272632" />
            <Text style={styles.figureLabel}>Return</Text>
          </View>
          <View style={styles.figureBox}>
            <Text style={styles.figureValue}>{item.returnQuantity}</Text>
          </View>
        </View>
        <View style={styles.figureColumn}>
          <View style={styles.figureLabelRow}>
            <Icon name="warningTriangle" size={11} color="#272632" />
            <Text style={styles.figureLabel}>{item.discrepancyType === 'loss' ? 'Missing' : 'Over'}</Text>
          </View>
          <View style={styles.figureBox}>
            <Text style={styles.figureValue}>{Math.abs(item.discrepancy)}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <Header
          showBackButton
          backButtonText="Sales Rep Dashboard"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
          onBackPress={handleBack}
        />

        <SecondaryHeader height={72}>
          <View style={styles.bannerRow}>
            <Text style={styles.bannerTitle}>Alerts and Discrepancies</Text>
            <View style={styles.onlinePill}>
              <View style={[styles.onlineDot, !connection.online && styles.onlineDotOffline]} />
              <Text style={[styles.onlineText, !connection.online && styles.onlineTextOffline]}>
                {connection.online ? 'Online' : `Offline · ${formatClockTime(connection.lastOnlineAt)}`}
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
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Pending</Text>
              <View style={styles.pendingDot} />
            </View>

            {pendingItems.length === 0 ? (
              <Text style={styles.emptyText}>No pending discrepancies. Nice work!</Text>
            ) : (
              <View style={styles.itemsList}>{pendingItems.map(renderPendingCard)}</View>
            )}

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Settled</Text>
              <View style={styles.settledDot} />
            </View>

            {settledItems.length === 0 ? (
              <Text style={styles.emptyText}>No settled discrepancies yet.</Text>
            ) : (
              <View style={styles.itemsList}>{settledItems.map(renderSettledCard)}</View>
            )}
          </ScrollView>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  bannerRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
  },
  bannerTitle: {
    color: '#272632',
    fontSize: 19,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    flexShrink: 1,
    marginRight: 8,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 32,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  pendingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF7800',
  },
  settledDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginBottom: 24,
  },
  itemsList: {
    gap: 16,
    marginBottom: 24,
  },
  itemCard: {
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 8,
    padding: 12,
  },
  itemTopRow: {
    flexDirection: 'row',
  },
  thumbnailWrap: {
    marginRight: 12,
    alignItems: 'center',
  },
  thumbnail: {
    width: 80,
    height: 90,
    borderRadius: 8,
    backgroundColor: '#F1F3F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailImage: {
    width: '70%',
    height: '70%',
  },
  itemDetails: {
    flex: 1,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemCode: {
    flex: 1,
    fontSize: 15,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    marginRight: 8,
  },
  missingBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  overBadge: {
    backgroundColor: '#B26400',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  missingBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  settledBadge: {
    backgroundColor: '#6B7280',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  settledBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  itemFullName: {
    fontSize: 12,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  itemMeta: {
    fontSize: 11,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  queuedRequestText: {
    fontSize: 10,
    color: '#1E7A3A',
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginTop: 4,
  },
  pendingRequestText: {
    fontSize: 10,
    color: '#B26400',
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginTop: 4,
  },
  rejectedRequestText: {
    fontSize: 10,
    color: '#B91C1C',
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginTop: 4,
  },
  figuresRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  figureColumn: {
    flex: 1,
  },
  figureLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  figureLabel: {
    fontSize: 11,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  missingLabel: {
    color: '#B91C1C',
  },
  figureBox: {
    borderWidth: 1,
    borderColor: '#DBE4EE',
    borderRadius: 8,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  figureBoxError: {
    borderColor: '#EF4444',
    backgroundColor: '#FFFFFF',
  },
  figureValue: {
    fontSize: 13,
    color: '#03045E',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  figureValueError: {
    color: '#EF4444',
  },
});
