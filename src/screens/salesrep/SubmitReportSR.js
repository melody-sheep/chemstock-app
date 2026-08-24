// src/screens/salesrep/SubmitReportSR.js
import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import Icon from '../../components/common/Icon';
import { TYPOGRAPHY } from '../../styles/typography';

const SUMMARY_STATS = [
  { key: 'given', icon: 'boxPackage', bg: '#EDEBFF', value: '50', label: 'Given Stock' },
  { key: 'sold', icon: 'checkmarkCircle', iconColor: '#FFFFFF', bg: '#3B2FC9', value: '47', label: 'Sold Stocks' },
  { key: 'return', icon: 'returns', iconColor: '#FFFFFF', bg: '#F72E75', value: '3', label: 'Return' },
];

const REPORT_ITEMS = [
  {
    id: 'A',
    code: 'Product A Code Name',
    fullName: 'Product  A Full Product Name',
    dateGiven: 'mm - dd - yyyy',
    inCustody: 20,
    sold: 19,
    returns: 1,
    discrepancy: 0,
    verified: true,
    nearExpiry: true,
  },
  {
    id: 'B',
    code: 'Product B Code Name',
    fullName: 'Product  B Full Product Name',
    dateGiven: 'mm - dd - yyyy',
    inCustody: 15,
    sold: 15,
    returns: 0,
    discrepancy: 0,
    verified: true,
    nearExpiry: false,
  },
  {
    id: 'C',
    code: 'Product C Code Name',
    fullName: 'Product  C Full Product Name',
    dateGiven: 'mm - dd - yyyy',
    inCustody: 15,
    sold: 13,
    returns: 1,
    discrepancy: 1,
    verified: false,
    nearExpiry: false,
    hasDiscrepancyWarning: true,
  },
];

export default function SubmitReportSR() {
  const navigation = useNavigation();

  const handleBack = () => navigation.goBack();

  const handleFinalize = () => {
    Alert.alert('Submit Daily Report', 'This will finalize and submit today’s report.');
  };

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable onPress={handleBack} style={styles.iconButton}>
            <Icon name="arrowLeft" size={20} color="#FFFFFF" />
          </Pressable>

          <Text style={styles.topBarTitle}>Submit Report</Text>

          <View style={styles.iconButton}>
            <Icon name="document" size={20} color="#FFFFFF" />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.summaryHeaderRow}>
            <Text style={styles.summaryTitle}>Today's Report Summary (Daily)</Text>
            <View style={styles.statusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Online</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            {SUMMARY_STATS.map((stat) => (
              <View key={stat.key} style={styles.statCard}>
                <View style={[styles.statIconWrap, { backgroundColor: stat.bg }]}>
                  <Icon name={stat.icon} size={18} color={stat.iconColor || '#03045E'} weight={stat.iconColor ? 'fill' : 'regular'} />
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.itemsList}>
            {REPORT_ITEMS.map((item) => (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemTopRow}>
                  <View style={styles.thumbnailWrap}>
                    <View style={styles.thumbnail}>
                      <Icon name="package" size={26} color="#94a3b8" />
                    </View>
                    {item.nearExpiry && (
                      <View style={styles.nearExpiryTag}>
                        <Icon name="warningTriangle" size={9} color="#B26400" />
                        <Text style={styles.nearExpiryText}>Near Expiry Batch</Text>
                      </View>
                    )}
                    {item.hasDiscrepancyWarning && (
                      <View style={styles.warningIconWrap}>
                        <Icon name="warningTriangle" size={16} color="#F04D59" weight="fill" />
                      </View>
                    )}
                  </View>

                  <View style={styles.itemDetails}>
                    <View style={styles.itemNameRow}>
                      <Text style={styles.itemCode} numberOfLines={1}>{item.code}</Text>
                      <View style={[styles.statusBadge, item.verified ? styles.statusBadgeSuccess : styles.statusBadgeError]}>
                        <Icon name={item.verified ? 'checkmark' : 'xCircle'} size={12} color="#FFFFFF" weight="bold" />
                      </View>
                    </View>
                    <Text style={styles.itemFullName} numberOfLines={1}>{item.fullName}</Text>
                    <Text style={styles.itemMeta}>Date given: {item.dateGiven}</Text>
                    <Text style={styles.itemMeta}>In Custody: {item.inCustody}</Text>
                  </View>
                </View>

                <View style={styles.figuresRow}>
                  <View style={styles.figureColumn}>
                    <Text style={styles.figureLabel}>Sold:</Text>
                    <View style={styles.figureBox}>
                      <Text style={styles.figureValue}>{item.sold}</Text>
                    </View>
                  </View>
                  <View style={styles.figureColumn}>
                    <Text style={styles.figureLabel}>Returns</Text>
                    <View style={styles.figureBox}>
                      <Text style={styles.figureValue}>{item.returns}</Text>
                    </View>
                  </View>
                  <View style={styles.figureColumn}>
                    <Text style={styles.figureLabel}>Discrepancy:</Text>
                    <View style={[styles.figureBox, item.discrepancy > 0 ? styles.figureBoxError : styles.figureBoxSuccess]}>
                      <Text style={[styles.figureValue, item.discrepancy > 0 ? styles.figureValueError : styles.figureValueSuccess]}>
                        {item.discrepancy}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={styles.primaryButton} onPress={handleFinalize}>
            <Text style={styles.primaryButtonText}>Finalize & Submit Daily Report</Text>
          </Pressable>
        </View>
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
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  summaryTitle: {
    fontSize: 17,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
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
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'flex-start',
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 1,
  },
  itemsList: {
    gap: 16,
  },
  itemCard: {
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 14,
    padding: 12,
  },
  itemTopRow: {
    flexDirection: 'row',
  },
  thumbnailWrap: {
    marginRight: 12,
  },
  thumbnail: {
    width: 80,
    height: 90,
    borderRadius: 10,
    backgroundColor: '#F1F3F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearExpiryTag: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1D6',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 3,
    gap: 3,
  },
  nearExpiryText: {
    fontSize: 8,
    color: '#B26400',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  warningIconWrap: {
    marginTop: 8,
    alignItems: 'center',
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
  statusBadge: {
    width: 22,
    height: 22,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadgeSuccess: {
    backgroundColor: '#22C55E',
  },
  statusBadgeError: {
    backgroundColor: '#EF4444',
  },
  itemFullName: {
    fontSize: 12,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  itemMeta: {
    fontSize: 11,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 4,
  },
  figuresRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  figureColumn: {
    flex: 1,
  },
  figureLabel: {
    fontSize: 11,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    marginBottom: 4,
  },
  figureBox: {
    borderWidth: 1,
    borderColor: '#DBE4EE',
    borderRadius: 8,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  figureBoxSuccess: {
    backgroundColor: '#DFFBE9',
    borderColor: '#DFFBE9',
  },
  figureBoxError: {
    backgroundColor: '#FBDCDC',
    borderColor: '#FBDCDC',
  },
  figureValue: {
    fontSize: 13,
    color: '#03045E',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  figureValueSuccess: {
    color: '#1E7A3A',
  },
  figureValueError: {
    color: '#B91C1C',
  },
  footer: {
    paddingHorizontal: 16,
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
