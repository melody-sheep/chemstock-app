// src/screens/manager/ManageReturnsScreen.js
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import Icon from '../../components/common/Icon';
import BottomNavBar from '../../components/common/BottomNavBar';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const TABS = [
  { key: 'pending', label: 'Pending Returns' },
  { key: 'confirmed', label: 'Confirmed Returns' },
];

const PENDING_RETURNS = [
  { id: 'ret1', repName: 'Jay Dela Cruz', role: 'Sales Rep', date: 'mm - dd - yyyy', batchId: 'RTN-2026-0522-IPN' },
  { id: 'ret2', repName: 'Carlo Reyes', role: 'Sales Rep', date: 'mm - dd - yyyy', batchId: 'RTN-2026-0523-IPN' },
];

const CONFIRMED_RETURNS = [
  { id: 'ret3', repName: 'Maria Santos', role: 'Sales Rep', date: 'mm - dd - yyyy', batchId: 'RTN-2026-0510-IPN' },
];

export default function ManageReturnsScreen() {
  const navigation = useNavigation();
  const [activeSubTab, setActiveSubTab] = useState('pending');

  const handleTabPress = (key) => {
    if (key === 'dashboard') {
      navigation.navigate('ManagerDashboard');
    } else if (key === 'stock') {
      navigation.navigate('ManagerStock');
    } else if (key === 'settings') {
      navigation.navigate('ManagerSettings');
    } else {
      navigation.navigate('ComingSoon', { tabKey: key, role: 'manager' });
    }
  };

  const visibleReturns = activeSubTab === 'pending' ? PENDING_RETURNS : CONFIRMED_RETURNS;

  const handleOpenReturn = (item) => {
    if (activeSubTab !== 'pending') return;
    navigation.navigate('ReturnStockVerify', { returnRequest: item });
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

        <SecondaryHeader height={56}>
          <View style={styles.titleRow}>
            <Text style={styles.pageTitle}>Manage Returns</Text>
            <View style={styles.onlinePill}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Online</Text>
            </View>
          </View>
        </SecondaryHeader>

        <View style={styles.tabRow}>
          {TABS.map((tab) => {
            const isActive = tab.key === activeSubTab;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
                onPress={() => setActiveSubTab(tab.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {visibleReturns.length === 0 ? (
            <Text style={styles.emptyText}>
              No {activeSubTab === 'pending' ? 'pending' : 'confirmed'} returns right now.
            </Text>
          ) : (
            visibleReturns.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.returnCard}
                onPress={() => handleOpenReturn(item)}
                activeOpacity={activeSubTab === 'pending' ? 0.7 : 1}
              >
                <View style={styles.returnAvatar}>
                  <Icon name="person" size={22} color="#94a3b8" />
                </View>

                <View style={styles.returnInfo}>
                  <Text style={styles.returnName} numberOfLines={1}>
                    {item.repName} <Text style={styles.returnRole}>({item.role})</Text>
                  </Text>
                  <Text style={styles.returnDate}>Date: {item.date}</Text>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    activeSubTab === 'pending' ? styles.statusBadgePending : styles.statusBadgeConfirmed,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      activeSubTab === 'pending' ? styles.statusBadgeTextPending : styles.statusBadgeTextConfirmed,
                    ]}
                  >
                    {activeSubTab === 'pending' ? 'Pending' : 'Confirmed'}
                  </Text>
                </View>

                {activeSubTab === 'pending' && (
                  <Icon name="arrowRight" size={18} color="#94a3b8" style={styles.chevron} />
                )}
              </TouchableOpacity>
            ))
          )}

          <View style={{ height: 24 }} />
        </ScrollView>

        <BottomNavBar activeTab="dashboard" onTabPress={handleTabPress} onFabPress={() => {}} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
  },
  pageTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' },
  onlineText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.success,
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    borderRadius: 12,
    backgroundColor: '#F1F3F6',
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
  },
  tabButtonTextActive: {
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: 96,
    gap: SPACING.sm,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  returnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  returnAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F3F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  returnInfo: {
    flex: 1,
  },
  returnName: {
    fontSize: 14,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  returnRole: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: '400',
    color: '#555353',
    fontSize: 12,
  },
  returnDate: {
    fontSize: 11,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 3,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusBadgePending: {
    backgroundColor: '#FFF1D6',
  },
  statusBadgeConfirmed: {
    backgroundColor: '#EAFBF2',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  statusBadgeTextPending: {
    color: '#B26400',
  },
  statusBadgeTextConfirmed: {
    color: '#1E7A3A',
  },
  chevron: {
    marginLeft: 2,
  },
});
