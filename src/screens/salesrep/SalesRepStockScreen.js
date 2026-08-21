// src/screens/salesrep/SalesRepStockScreen.js
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import Icon from '../../components/common/Icon';
import Input from '../../components/common/Input';
import BottomNavBar from '../../components/common/BottomNavBar';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../styles/typography';

const AGENT = {
  name: 'Jay Sultan',
  role: 'Sales Representative',
  branch: 'Iponan Cdo Sales Rep',
  pendingItems: 1,
  missingItems: 1,
};

const HEALTHY_STOCK = [
  {
    id: 'LIN-24-123',
    name: 'Liniment X',
    type: 'Type: Lorem ipsum.',
    idCode: 'BTN-LIN-24-123',
    mfg: '05/20/2026',
    exp: '08/20/2026',
    urgent: true,
    qty: 10,
    nearExpiry: true,
  },
  {
    id: 'LIN-24-124',
    name: 'Liniment Y',
    type: 'Type: Lorem ipsum.',
    idCode: 'BTN-LIN-24-124',
    mfg: '05/20/2026',
    exp: '08/20/2030',
    urgent: false,
    qty: 12,
    nearExpiry: false,
  },
];

const LOW_STOCK = [
  {
    id: 'MNT-OIL-X',
    name: 'MNT-OIL-X',
    type: 'Type: Lorem ipsum.',
    idCode: 'BTN-LIN-24-123',
    mfg: '05/20/2026',
    exp: '08/20/2026',
    urgent: false,
    qty: 2,
    nearExpiry: false,
  },
];

export default function SalesRepStockScreen() {
  const navigation = useNavigation();
  const [searchText, setSearchText] = useState('');

  const handleBack = () => navigation.goBack();

  const handleTabPress = (key) => {
    if (key === 'dashboard') {
      navigation.navigate('SalesRepDashboard');
    } else if (key === 'stock') {
      // already here
    } else {
      Alert.alert('Coming Soon', `${key.charAt(0).toUpperCase()}${key.slice(1)} isn't built yet.`);
    }
  };

  const handleViewSummary = () => {
    Alert.alert('Handheld Stock', 'This will show the full breakdown of pending and missing items.');
  };

  const renderProductCard = (item) => (
    <View key={item.id} style={styles.productCard}>
      <View style={styles.thumbnailWrap}>
        <View style={styles.thumbnail}>
          <Icon name="package" size={22} color="#94a3b8" />
        </View>
        <View style={styles.qtyBadge}>
          <Text style={styles.qtyBadgeText}>{item.qty} pcs</Text>
        </View>
      </View>

      <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.productMeta} numberOfLines={1}>{item.type}</Text>
      <Text style={styles.productMeta} numberOfLines={1}>ID : {item.idCode}</Text>

      <View style={styles.dateRow}>
        <Icon name="calendar" size={12} color="#03045E" />
        <Text style={styles.dateText}>Mfg: {item.mfg}</Text>
      </View>
      <View style={styles.dateRow}>
        <Icon name="calendar" size={12} color="#F04D59" />
        <Text style={styles.dateText}>
          Exp: {item.exp}{item.urgent && <Text style={styles.urgentText}> (Urgent!)</Text>}
        </Text>
      </View>

      {item.nearExpiry ? (
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
        <View style={styles.topBar}>
          <Pressable onPress={handleBack} style={styles.iconButton}>
            <Icon name="arrowLeft" size={20} color="#FFFFFF" />
          </Pressable>

          <Text style={styles.topBarTitle}>Sales Rep Dashboard</Text>

          <View style={styles.iconButton}>
            <Icon name="document" size={20} color="#FFFFFF" />
          </View>
        </View>

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
              <Text style={styles.agentHeaderText}>Branch: {AGENT.branch}</Text>
            </View>

            <View style={styles.agentBodyRow}>
              <View style={styles.avatarWrap}>
                <Icon name="person" size={28} color="#94a3b8" />
              </View>
              <View style={styles.agentInfo}>
                <Text style={styles.agentName}>{AGENT.name}</Text>
                <Text style={styles.agentRole}>{AGENT.role}</Text>
              </View>
              <Icon name="boxPackage" size={40} color="#03045E" />
            </View>

            <View style={styles.agentFooterRow}>
              <View style={styles.pendingTag}>
                <Icon name="document" size={12} color="#B26400" />
                <Text style={styles.pendingTagText}>{AGENT.pendingItems} Pending Item</Text>
              </View>
              <View style={styles.missingTag}>
                <Icon name="warningTriangle" size={12} color="#B91C1C" />
                <Text style={styles.missingTagText}>{AGENT.missingItems} Missing Item</Text>
              </View>
              <Pressable style={styles.viewButton} onPress={handleViewSummary}>
                <Text style={styles.viewButtonText}>View</Text>
              </Pressable>
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

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>In-Stocks (Healthy Levels)</Text>
            <View style={[styles.statusDotSmall, { backgroundColor: '#22C55E' }]} />
          </View>
          <View style={styles.cardGrid}>
            {HEALTHY_STOCK.map(renderProductCard)}
          </View>

          <View style={[styles.sectionHeaderRow, styles.sectionSpacing]}>
            <Text style={styles.sectionTitle}>Almost Out of Stock</Text>
            <View style={[styles.statusDotSmall, { backgroundColor: '#FF7800' }]} />
          </View>
          <View style={styles.cardGrid}>
            {LOW_STOCK.map(renderProductCard)}
          </View>

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
  topBar: {
    height: 56,
    backgroundColor: '#03045E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  iconButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
    flexWrap: 'wrap',
  },
  pendingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF1D6',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  pendingTagText: {
    fontSize: 10,
    color: '#B26400',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  missingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FBDCDC',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  missingTagText: {
    fontSize: 10,
    color: '#B91C1C',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  viewButton: {
    flex: 1,
    minWidth: 70,
    backgroundColor: '#03045E',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  viewButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
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
  urgentText: {
    color: '#F04D59',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
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
