// src/screens/salesrep/SalesRepReportsScreen.js
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import Icon from '../../components/common/Icon';
import BottomNavBar from '../../components/common/BottomNavBar';
import { TYPOGRAPHY } from '../../styles/typography';

const WEEK_SUMMARY = [
  { key: 'given', icon: 'boxPackage', bg: '#EDEBFF', value: '150', label: 'Given Stock' },
  { key: 'sold', icon: 'checkmarkCircle', iconColor: '#FFFFFF', bg: '#3B2FC9', value: '132', label: 'Sold Stocks' },
  { key: 'return', icon: 'returns', iconColor: '#FFFFFF', bg: '#F72E75', value: '15', label: 'Return' },
];

const DAILY_REPORTS = [
  {
    id: 'r1',
    date: 'May 20, 2026',
    given: 50,
    sold: 47,
    returns: 3,
    discrepancy: 0,
    status: 'Reviewed',
  },
  {
    id: 'r2',
    date: 'May 19, 2026',
    given: 45,
    sold: 40,
    returns: 4,
    discrepancy: 1,
    status: 'Reviewed',
  },
  {
    id: 'r3',
    date: 'May 18, 2026',
    given: 55,
    sold: 45,
    returns: 8,
    discrepancy: 2,
    status: 'Pending',
  },
];

export default function SalesRepReportsScreen() {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState('reports');

  const handleBack = () => navigation.goBack();

  const handleTabPress = (key) => {
    setActiveTab(key);
    if (key === 'dashboard') {
      navigation.navigate('SalesRepDashboard');
    } else if (key === 'stock') {
      navigation.navigate('SalesRepStock');
    } else if (key !== 'reports') {
      Alert.alert('Coming Soon', `${key.charAt(0).toUpperCase()}${key.slice(1)} isn't built yet.`);
    }
  };

  const handleViewReport = (report) => {
    Alert.alert('Report Detail', `Opening the itemized breakdown for ${report.date}.`);
  };

  const handleSubmitToday = () => {
    navigation.navigate('SubmitReportSR');
  };

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable onPress={handleBack} style={styles.iconButton}>
            <Icon name="arrowLeft" size={20} color="#FFFFFF" />
          </Pressable>

          <Text style={styles.topBarTitle}>Reports</Text>

          <View style={styles.iconButton}>
            <Icon name="document" size={20} color="#FFFFFF" />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.summaryHeaderRow}>
            <Text style={styles.summaryTitle}>This Week's Summary</Text>
            <View style={styles.statusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Online</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            {WEEK_SUMMARY.map((stat) => (
              <View key={stat.key} style={styles.statCard}>
                <View style={[styles.statIconWrap, { backgroundColor: stat.bg }]}>
                  <Icon name={stat.icon} size={18} color={stat.iconColor || '#03045E'} weight={stat.iconColor ? 'fill' : 'regular'} />
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>

          <Pressable style={styles.submitBanner} onPress={handleSubmitToday}>
            <View style={styles.submitBannerIconWrap}>
              <Icon name="document" size={22} color="#03045E" />
            </View>
            <View style={styles.submitBannerTextWrap}>
              <Text style={styles.submitBannerTitle}>Submit Today's Report</Text>
              <Text style={styles.submitBannerSubtitle}>Finalize sold, returned, and discrepancy figures for today.</Text>
            </View>
            <Icon name="arrowRight" size={18} color="#555353" />
          </Pressable>

          <Text style={styles.listTitle}>Daily Report History</Text>

          <View style={styles.reportsList}>
            {DAILY_REPORTS.map((report) => (
              <Pressable key={report.id} style={styles.reportCard} onPress={() => handleViewReport(report)}>
                <View style={styles.reportTopRow}>
                  <View style={styles.reportDateWrap}>
                    <Icon name="calendar" size={16} color="#03045E" />
                    <Text style={styles.reportDate}>{report.date}</Text>
                  </View>
                  <View
                    style={[
                      styles.reportStatusPill,
                      report.status === 'Reviewed' ? styles.reportStatusReviewed : styles.reportStatusPending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.reportStatusText,
                        report.status === 'Reviewed' ? styles.reportStatusTextReviewed : styles.reportStatusTextPending,
                      ]}
                    >
                      {report.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.figuresRow}>
                  <View style={styles.figureColumn}>
                    <Text style={styles.figureLabel}>Given</Text>
                    <Text style={styles.figureValue}>{report.given}</Text>
                  </View>
                  <View style={styles.figureColumn}>
                    <Text style={styles.figureLabel}>Sold</Text>
                    <Text style={styles.figureValue}>{report.sold}</Text>
                  </View>
                  <View style={styles.figureColumn}>
                    <Text style={styles.figureLabel}>Returns</Text>
                    <Text style={styles.figureValue}>{report.returns}</Text>
                  </View>
                  <View style={styles.figureColumn}>
                    <Text style={styles.figureLabel}>Discrepancy</Text>
                    <Text style={[styles.figureValue, report.discrepancy > 0 && styles.figureValueError]}>
                      {report.discrepancy}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>

        <BottomNavBar activeTab={activeTab} onTabPress={handleTabPress} onFabPress={() => {}} />
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
    paddingBottom: 96,
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
    marginBottom: 18,
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
  submitBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DBE4EE',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 20,
  },
  submitBannerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EDEBFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  submitBannerTextWrap: {
    flex: 1,
  },
  submitBannerTitle: {
    fontSize: 15,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    marginBottom: 2,
  },
  submitBannerSubtitle: {
    fontSize: 11,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  listTitle: {
    color: '#272632',
    fontSize: 17,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    marginBottom: 12,
  },
  reportsList: {
    gap: 12,
  },
  reportCard: {
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 14,
    padding: 12,
  },
  reportTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  reportDateWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reportDate: {
    fontSize: 13,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  reportStatusPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  reportStatusReviewed: {
    backgroundColor: '#EAFBF2',
  },
  reportStatusPending: {
    backgroundColor: '#FFF1D6',
  },
  reportStatusText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  reportStatusTextReviewed: {
    color: '#1E7A3A',
  },
  reportStatusTextPending: {
    color: '#B26400',
  },
  figuresRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  figureColumn: {
    alignItems: 'flex-start',
  },
  figureLabel: {
    fontSize: 10,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginBottom: 2,
  },
  figureValue: {
    fontSize: 15,
    color: '#03045E',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  figureValueError: {
    color: '#B91C1C',
  },
});
