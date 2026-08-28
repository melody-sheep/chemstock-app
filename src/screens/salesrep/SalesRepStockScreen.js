// src/screens/salesrep/SalesRepStockScreen.js
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from '../../components/common/Icon';
import Input from '../../components/common/Input';
import Header from '../../components/common/Header';
import BottomNavBar from '../../components/common/BottomNavBar';
import authService from '../../services/authService';
import inventoryService from '../../services/inventoryService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { STOCK_HEALTHY_THRESHOLD, NEAR_EXPIRY_DAYS } from '../../constants/inventory';

function isNearExpiry(expDate) {
  if (!expDate) return false;
  return (new Date(expDate).getTime() - Date.now()) / 86400000 <= NEAR_EXPIRY_DAYS;
}

export default function SalesRepStockScreen() {
  const navigation = useNavigation();
  const [searchText, setSearchText] = useState('');
  const [agent, setAgent] = useState(null);
  const [stock, setStock] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadStock = useCallback(async () => {
    setIsLoading(true);
    const currentAgent = await authService.getCurrentUser();
    setAgent(currentAgent);
    const result = await inventoryService.getSrInventory(currentAgent?.id);
    setStock(result.success ? result.data : []);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStock();
    }, [loadStock])
  );


  const handleTabPress = (key) => {
    if (key === 'dashboard') {
      navigation.navigate('SalesRepDashboard');
    } else if (key === 'stock') {
      // already here
    } else if (key === 'reports') {
      navigation.navigate('SalesRepReports');
    } else if (key === 'settings') {
      navigation.navigate('SalesRepSettings');
    }
  };

  // remaining_quantity (not quantity) is what's actually still on hand —
  // quantity stays fixed at the originally-received amount forever, while
  // remaining_quantity is drained by daily-report submission and
  // discrepancy resolution. A batch fully consumed by either of those
  // (remaining_quantity 0) is no longer "in stock" and shouldn't render.
  const currentStock = stock.filter((row) => row.remaining_quantity > 0);

  const query = searchText.trim().toLowerCase();
  const visibleStock = currentStock.filter((row) => {
    if (!query) return true;
    return row.product_name?.toLowerCase().includes(query) || row.product_code?.toLowerCase().includes(query);
  });
  const healthyStock = visibleStock.filter((row) => row.remaining_quantity >= STOCK_HEALTHY_THRESHOLD);
  const lowStock = visibleStock.filter((row) => row.remaining_quantity < STOCK_HEALTHY_THRESHOLD);
  const totalUnits = currentStock.reduce((sum, row) => sum + row.remaining_quantity, 0);

  const renderProductCard = (item) => (
    <View key={item.id} style={styles.productCard}>
      <View style={styles.thumbnailWrap}>
        <View style={styles.thumbnail}>
          <Icon name="package" size={22} color="#94a3b8" />
        </View>
        <View style={styles.qtyBadge}>
          <Text style={styles.qtyBadgeText}>{item.remaining_quantity} pcs</Text>
        </View>
      </View>

      <Text style={styles.productName} numberOfLines={1}>{item.product_name}</Text>
      {item.batch_number && <Text style={styles.productMeta} numberOfLines={1}>BN: {item.batch_number}</Text>}
      <Text style={styles.productMeta} numberOfLines={1}>Code: {item.product_code}</Text>

      {item.mfg_date && (
        <View style={styles.dateRow}>
          <Icon name="calendar" size={12} color="#03045E" />
          <Text style={styles.dateText}>Mfg: {new Date(item.mfg_date).toLocaleDateString()}</Text>
        </View>
      )}
      {item.exp_date && (
        <View style={styles.dateRow}>
          <Icon name="calendar" size={12} color="#F04D59" />
          <Text style={styles.dateText}>Exp: {new Date(item.exp_date).toLocaleDateString()}</Text>
        </View>
      )}

      {isNearExpiry(item.exp_date) ? (
        <View style={styles.nearExpiryTag}>
          <Icon name="warningTriangle" size={9} color="#B26400" />
          <Text style={styles.nearExpiryText}>Near Expiry Batch</Text>
        </View>
      ) : (
        <View style={styles.salableTag}>
          <View style={styles.salableDot} />
          <Text style={styles.salableText}>Salable</Text>
        </View>
      )}
    </View>
  );

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <Header
          title="Stock Inventory"
          titleAlign="left"
          showDocumentIcon
          onDocumentPress={() => navigation.navigate('SalesRepLogs')}
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
        />

        <View style={styles.bannerBar}>
          <View>
            <Text style={styles.bannerTitle}>My Handheld Stock</Text>
            <Text style={styles.bannerSubtitle}>Personal Inventory</Text>
          </View>
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Online</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.agentCard}>
            <View style={styles.agentHeaderRow}>
              <Text style={styles.agentHeaderText}>Branch: {agent?.branchName || '—'}</Text>
            </View>

            <View style={styles.agentBodyRow}>
              <View style={styles.avatarWrap}>
                <Icon name="person" size={28} color="#94a3b8" />
              </View>
              <View style={styles.agentInfo}>
                <Text style={styles.agentName}>{agent?.full_name || agent?.username || ''}</Text>
                <Text style={styles.agentRole}>
                  {agent?.role === 'collector' ? 'Collector' : 'Sales Representative'}
                </Text>
              </View>
              <Icon name="boxPackage" size={40} color="#03045E" />
            </View>

            <View style={styles.agentFooterRow}>
              <Text style={styles.summaryText}>
                {currentStock.length} batch{currentStock.length === 1 ? '' : 'es'}, {totalUnits} unit{totalUnits === 1 ? '' : 's'} on hand
              </Text>
            </View>
          </View>

          <View style={styles.searchRow}>
            <View style={styles.searchInputWrap}>
              <Input icon="search" placeholder="Search products" value={searchText} onChangeText={setSearchText} />
            </View>
            <View style={styles.filterButtonWrap}>
              <Icon name="filter" size={20} color={COLORS.primary} />
            </View>
          </View>

          {isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : currentStock.length === 0 ? (
            <View style={styles.loadingWrap}>
              <Icon name="boxPackage" size={32} color={COLORS.textSecondary} />
              <Text style={styles.emptyStateText}>No stock yet — accept a release to see it here.</Text>
            </View>
          ) : (
            <>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>In-Stocks (Healthy Levels)</Text>
                <View style={[styles.statusDotSmall, { backgroundColor: '#22C55E' }]} />
              </View>
              <View style={styles.cardGrid}>
                {healthyStock.length === 0 ? (
                  <Text style={styles.emptyStateText}>None right now.</Text>
                ) : (
                  healthyStock.map(renderProductCard)
                )}
              </View>

              <View style={[styles.sectionHeaderRow, styles.sectionSpacing]}>
                <Text style={styles.sectionTitle}>Almost Out of Stock</Text>
                <View style={[styles.statusDotSmall, { backgroundColor: '#FF7800' }]} />
              </View>
              <View style={styles.cardGrid}>
                {lowStock.length === 0 ? (
                  <Text style={styles.emptyStateText}>None right now.</Text>
                ) : (
                  lowStock.map(renderProductCard)
                )}
              </View>
            </>
          )}

          <View style={{ height: 24 }} />
        </ScrollView>

        <BottomNavBar activeTab="stock" onTabPress={handleTabPress} onFabPress={() => {}} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  bannerBar: {
    backgroundColor: '#EAFBF8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#D3F5EE',
  },
  bannerTitle: {
    color: '#272632',
    fontSize: 19,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  bannerSubtitle: {
    color: '#555353',
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
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
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 96,
  },
  agentCard: {
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 18,
  },
  agentHeaderRow: {
    backgroundColor: '#03045E',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  agentHeaderText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  agentBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F1F3F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentInfo: {
    flex: 1,
  },
  agentName: {
    fontSize: 15,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  agentRole: {
    fontSize: 12,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  agentFooterRow: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
  },
  summaryText: {
    fontSize: 12,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyStateText: {
    fontSize: 12,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 16,
  },
  searchInputWrap: {
    flex: 1,
  },
  filterButtonWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#757575',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7FEFF',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionSpacing: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 15,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  statusDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  productCard: {
    width: '47%',
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 14,
    padding: 10,
  },
  thumbnailWrap: {
    position: 'relative',
    marginBottom: 8,
  },
  thumbnail: {
    width: '100%',
    height: 72,
    borderRadius: 10,
    backgroundColor: '#F1F3F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#03045E',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  qtyBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  productName: {
    fontSize: 13,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  productMeta: {
    fontSize: 10,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  dateText: {
    fontSize: 10,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  nearExpiryTag: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFF1D6',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 3,
  },
  nearExpiryText: {
    fontSize: 8,
    color: '#B26400',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  salableTag: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EAFBF2',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 4,
  },
  salableDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  salableText: {
    fontSize: 8,
    color: '#1E7A3A',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
});
