// src/screens/salesrep/AlertsDiscrepanciesSR.js
import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import Icon from '../../components/common/Icon';
import { TYPOGRAPHY } from '../../styles/typography';

const PENDING_ITEMS = [
  {
    id: 'C',
    code: 'Product C Code Name',
    fullName: 'Product  C Full Product Name',
    dateGiven: 'mm - dd - yyyy',
    inCustody: 15,
    released: 15,
    sold: 13,
    returned: 1,
    missing: 1,
  },
];

const SETTLED_ITEMS = [
  {
    id: 'X1',
    code: 'Product [x] Code Name',
    fullName: 'Product  [x] Full Product Name',
    dateGiven: 'mm - dd - yyyy',
    inCustody: '[x]',
    released: '[x]',
    sold: '[x]',
    returned: '[x]',
    missing: '[x]',
  },
  {
    id: 'X2',
    code: 'Product [x] Code Name',
    fullName: 'Product  [x] Full Product Name',
    dateGiven: 'mm - dd - yyyy',
    inCustody: '[x]',
    released: '[x]',
    sold: '[x]',
    returned: '[x]',
    missing: '[x]',
  },
];

export default function AlertsDiscrepanciesSR() {
  const navigation = useNavigation();

  const handleBack = () => navigation.goBack();

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
          <Text style={styles.bannerTitle}>Alerts and Discrepancies</Text>
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Online</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Pending</Text>
            <View style={styles.pendingDot} />
          </View>

          <View style={styles.itemsList}>
            {PENDING_ITEMS.map((item) => (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemTopRow}>
                  <View style={styles.thumbnailWrap}>
                    <View style={styles.thumbnail}>
                      <Icon name="package" size={26} color="#94a3b8" />
                    </View>
                    <View style={styles.warningIconWrap}>
                      <Icon name="warningTriangle" size={16} color="#F04D59" weight="fill" />
                    </View>
                  </View>

                  <View style={styles.itemDetails}>
                    <View style={styles.itemNameRow}>
                      <Text style={styles.itemCode} numberOfLines={1}>{item.code}</Text>
                      <View style={styles.missingBadge}>
                        <Text style={styles.missingBadgeText}>{item.missing} Missing</Text>
                      </View>
                    </View>
                    <Text style={styles.itemFullName} numberOfLines={1}>{item.fullName}</Text>
                    <Text style={styles.itemMeta}>Date given: {item.dateGiven}</Text>
                    <Text style={styles.itemMeta}>In Custody: {item.inCustody}</Text>
                  </View>
                </View>

                <View style={styles.figuresRow}>
                  <View style={styles.figureColumn}>
                    <Text style={styles.figureLabel}>Released</Text>
                    <View style={styles.figureBox}>
                      <Text style={styles.figureValue}>{item.released}</Text>
                    </View>
                  </View>
                  <View style={styles.figureColumn}>
                    <Text style={styles.figureLabel}>Sold</Text>
                    <View style={styles.figureBox}>
                      <Text style={styles.figureValue}>{item.sold}</Text>
                    </View>
                  </View>
                  <View style={styles.figureColumn}>
                    <Text style={styles.figureLabel}>Return</Text>
                    <View style={styles.figureBox}>
                      <Text style={styles.figureValue}>{item.returned}</Text>
                    </View>
                  </View>
                  <View style={styles.figureColumn}>
                    <Text style={[styles.figureLabel, styles.missingLabel]}>Missing</Text>
                    <View style={[styles.figureBox, styles.figureBoxError]}>
                      <Text style={[styles.figureValue, styles.figureValueError]}>{item.missing}</Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Settled</Text>
            <View style={styles.settledDot} />
          </View>

          <View style={styles.itemsList}>
            {SETTLED_ITEMS.map((item) => (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemTopRow}>
                  <View style={styles.thumbnailWrap}>
                    <View style={styles.thumbnail}>
                      <Icon name="package" size={26} color="#94a3b8" />
                    </View>
                    <View style={styles.settledIconWrap}>
                      <Icon name="checkmark" size={13} color="#FFFFFF" weight="bold" />
                    </View>
                  </View>

                  <View style={styles.itemDetails}>
                    <View style={styles.itemNameRow}>
                      <Text style={styles.itemCode} numberOfLines={1}>{item.code}</Text>
                      <View style={styles.settledBadge}>
                        <Text style={styles.settledBadgeText}>Settled</Text>
                      </View>
                    </View>
                    <Text style={styles.itemFullName} numberOfLines={1}>{item.fullName}</Text>
                    <Text style={styles.itemMeta}>Date given: {item.dateGiven}</Text>
                    <Text style={styles.itemMeta}>In Custody: {item.inCustody}</Text>
                  </View>
                </View>

                <View style={styles.figuresRow}>
                  <View style={styles.figureColumn}>
                    <Text style={styles.figureLabel}>Released</Text>
                    <View style={styles.figureBox}>
                      <Text style={styles.figureValue}>{item.released}</Text>
                    </View>
                  </View>
                  <View style={styles.figureColumn}>
                    <Text style={styles.figureLabel}>Sold</Text>
                    <View style={styles.figureBox}>
                      <Text style={styles.figureValue}>{item.sold}</Text>
                    </View>
                  </View>
                  <View style={styles.figureColumn}>
                    <Text style={styles.figureLabel}>Return</Text>
                    <View style={styles.figureBox}>
                      <Text style={styles.figureValue}>{item.returned}</Text>
                    </View>
                  </View>
                  <View style={styles.figureColumn}>
                    <Text style={styles.figureLabel}>Missing</Text>
                    <View style={styles.figureBox}>
                      <Text style={styles.figureValue}>{item.missing}</Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
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
    backgroundColor: '#FF7800',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
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
  itemsList: {
    gap: 16,
    marginBottom: 24,
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
    alignItems: 'center',
  },
  thumbnail: {
    width: 80,
    height: 90,
    borderRadius: 10,
    backgroundColor: '#F1F3F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningIconWrap: {
    marginTop: 8,
  },
  settledIconWrap: {
    marginTop: 8,
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
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
  itemMeta: {
    fontSize: 11,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
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
  figureLabel: {
    fontSize: 11,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    marginBottom: 4,
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
