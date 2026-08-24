// src/screens/manager/ReturnStockVerifyScreen.js
import React from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import Icon from '../../components/common/Icon';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const GOOD_CONDITION_ITEMS = [
  {
    id: 'A',
    code: 'Product A Code Name',
    fullName: 'Product  A Full Product Name',
    dateGiven: 'mm - dd - yyyy',
    inCustody: 20,
    qty: 1,
  },
  {
    id: 'B',
    code: 'Product B Code Name',
    fullName: 'Product  B Full Product Name',
    dateGiven: 'mm - dd - yyyy',
    inCustody: 15,
    qty: 2,
  },
];

const DAMAGED_CONDITION_ITEMS = [
  {
    id: 'C',
    code: 'Product C Code Name',
    fullName: 'Product  C Full Product Name',
    dateGiven: 'mm - dd - yyyy',
    inCustody: 15,
    qty: 1,
  },
];

export default function ReturnStockVerifyScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const returnRequest = route.params?.returnRequest || {
    repName: 'Jay Dela Cruz',
    batchId: 'RTN-2026-0522-IPN',
  };

  const handleApprove = () => {
    Alert.alert(
      'Approve Return',
      `This will restock the verified items and close batch ${returnRequest.batchId}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Approve', onPress: () => navigation.goBack() },
      ]
    );
  };

  const renderItem = (item, tone) => (
    <View key={item.id} style={styles.itemCard}>
      <View style={styles.thumbnail}>
        <Icon name="package" size={24} color="#94a3b8" />
      </View>

      <View style={styles.itemDetails}>
        <Text style={styles.itemCode} numberOfLines={1}>{item.code}</Text>
        <Text style={styles.itemFullName} numberOfLines={1}>{item.fullName}</Text>
        <Text style={styles.itemMeta}>Date given: {item.dateGiven}</Text>
        <Text style={styles.itemMeta}>In Custody: {item.inCustody}</Text>
      </View>

      <View style={[styles.qtyBadge, tone === 'good' ? styles.qtyBadgeGood : styles.qtyBadgeDamaged]}>
        <Text style={[styles.qtyBadgeText, tone === 'good' ? styles.qtyBadgeTextGood : styles.qtyBadgeTextDamaged]}>
          {item.qty}
        </Text>
      </View>
    </View>
  );

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton
          backButtonText="Return Stocks"
          showDocumentIcon
          onDocumentPress={() => navigation.navigate('StockLogs')}
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
        />

        <SecondaryHeader height={72}>
          <View style={styles.verificationHeader}>
            <View style={styles.verificationTitleRow}>
              <Text style={styles.verificationTitle}>Active Verification:</Text>
              <View style={styles.onlinePill}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>Online</Text>
              </View>
            </View>
            <Text style={styles.verificationLine}>
              <Text style={styles.verificationLabel}>Sales Rep: </Text>
              {returnRequest.repName}
            </Text>
            <Text style={styles.verificationLine}>
              <Text style={styles.verificationLabel}>Batch ID: </Text>
              {returnRequest.batchId}
            </Text>
          </View>
        </SecondaryHeader>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Review Good Condition Stock</Text>
            <View style={[styles.statusDot, { backgroundColor: '#22C55E' }]} />
          </View>
          <View style={styles.itemsList}>
            {GOOD_CONDITION_ITEMS.map((item) => renderItem(item, 'good'))}
          </View>

          <View style={[styles.sectionHeaderRow, styles.sectionSpacing]}>
            <Text style={styles.sectionTitle}>Review Damaged Condition Stock</Text>
            <View style={[styles.statusDot, { backgroundColor: '#EF4444' }]} />
          </View>
          <View style={styles.itemsList}>
            {DAMAGED_CONDITION_ITEMS.map((item) => renderItem(item, 'damaged'))}
          </View>

          <Text style={[styles.listTitle, styles.sectionSpacing]}>Photo Proof</Text>
          <View style={styles.photoCard}>
            <View style={styles.thumbnailLarge}>
              <Icon name="package" size={40} color="#D8DEE8" />
            </View>
          </View>

          <View style={styles.locationCard}>
            <View style={styles.locationRow}>
              <View style={styles.locationLeft}>
                <Icon name="location" size={18} color="#F04D59" />
                <Text style={styles.detailLabel}>GPS</Text>
              </View>
              <Text style={styles.detailValue}>14.5995°N, 120.9842°E</Text>
            </View>
            <View style={styles.locationRow}>
              <View style={styles.locationLeft}>
                <Icon name="package" size={18} color="#03045E" />
                <Text style={styles.detailLabel}>Branch</Text>
              </View>
              <Text style={styles.detailValue}>Regency II, Iponan</Text>
            </View>
            <View style={styles.locationRow}>
              <View style={styles.locationLeft}>
                <Icon name="moreVertical" size={18} color="#00B4D8" />
                <Text style={styles.detailLabel}>Device</Text>
              </View>
              <Text style={styles.detailValue}>Infinix Zero 30 5G</Text>
            </View>
            <View style={[styles.locationRow, styles.lastLocationRow]}>
              <View style={styles.locationLeft}>
                <Icon name="clock" size={18} color="#00B4D8" />
                <Text style={styles.detailLabel}>Time</Text>
              </View>
              <Text style={styles.detailValue}>May 20, 2024 | 02:30 PM</Text>
            </View>
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={styles.primaryButton} onPress={handleApprove}>
            <Text style={styles.primaryButtonText}>Approve Return</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  verificationHeader: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  verificationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  verificationTitle: {
    fontSize: 15,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' },
  onlineText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.success,
  },
  verificationLine: {
    fontSize: 12,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 4,
  },
  verificationLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    color: '#272632',
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
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
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  itemsList: {
    gap: 12,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#F1F3F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemDetails: {
    flex: 1,
  },
  itemCode: {
    fontSize: 14,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  itemFullName: {
    fontSize: 11,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  itemMeta: {
    fontSize: 10,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 3,
  },
  qtyBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBadgeGood: {
    backgroundColor: '#EAFBF2',
  },
  qtyBadgeDamaged: {
    backgroundColor: '#FBDCDC',
  },
  qtyBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  qtyBadgeTextGood: {
    color: '#1E7A3A',
  },
  qtyBadgeTextDamaged: {
    color: '#B91C1C',
  },
  listTitle: {
    color: '#272632',
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    marginBottom: 10,
  },
  photoCard: {
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 16,
    padding: 12,
  },
  thumbnailLarge: {
    height: 140,
    borderRadius: 12,
    backgroundColor: '#F1F3F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAEFF5',
    paddingHorizontal: 12,
    marginTop: 16,
  },
  locationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  lastLocationRow: {
    borderBottomWidth: 0,
  },
  locationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    color: '#555353',
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  detailValue: {
    color: '#272632',
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
  },
  primaryButton: {
    backgroundColor: '#03045E',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
});
