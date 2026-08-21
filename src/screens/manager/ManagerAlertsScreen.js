// src/screens/manager/ManagerAlertsScreen.js
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import Icon from '../../components/common/Icon';
import BottomNavBar from '../../components/common/BottomNavBar';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const TODAYS_ALERTS = [
  {
    id: 'a1',
    code: 'LIN-60ML',
    fullName: 'LIN-60ML [full name]',
    date: 'mm - dd - yyyy',
    missing: 1,
    agentName: 'Jay Dela Cruz',
    agentRole: 'Sales Rep',
    released: 10,
    reported: 8,
    returned: 1,
  },
  {
    id: 'a2',
    code: 'LIN-120ML',
    fullName: 'LIN-120ML [full name]',
    date: 'mm - dd - yyyy',
    missing: 2,
    agentName: 'Maria S.',
    agentRole: 'Sales Rep',
    released: 15,
    reported: 12,
    returned: 1,
  },
];

export default function ManagerAlertsScreen() {
  const navigation = useNavigation();

  const handleTabPress = (key) => {
    if (key === 'dashboard') {
      navigation.navigate('ManagerDashboard');
    } else if (key === 'stock') {
      navigation.navigate('ManagerStock');
    } else {
      Alert.alert('Coming Soon', `${key.charAt(0).toUpperCase()}${key.slice(1)} isn't built yet.`);
    }
  };

  const handleFilterPress = () => {
    Alert.alert('Filter Alerts', 'Filtering by branch, agent, or discrepancy type is coming soon.');
  };

  const handleOpenAlert = (alert) => {
    Alert.alert(
      `${alert.code} Discrepancy`,
      `${alert.agentName} (${alert.agentRole})\nReleased: ${alert.released}x\nReported: ${alert.reported} sold (${alert.returned} return)\nMissing: ${alert.missing}x`
    );
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

        <SecondaryHeader height={72} backgroundColor="#FFEEEE" borderColor="#FFD5D5">
          <View style={styles.bannerRow}>
            <Text style={styles.bannerTitle}>Alerts and Discrepancies</Text>
            <View style={styles.onlinePill}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Online</Text>
            </View>
          </View>
        </SecondaryHeader>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Todays Alerts</Text>
            <View style={styles.alertDot} />
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={handleFilterPress} accessibilityLabel="Filter alerts" accessibilityRole="button">
              <Icon name="filter" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.alertsList}>
            {TODAYS_ALERTS.map((alert) => (
              <TouchableOpacity
                key={alert.id}
                style={styles.alertCard}
                onPress={() => handleOpenAlert(alert)}
                activeOpacity={0.7}
              >
                <View style={styles.alertTopRow}>
                  <View style={styles.avatarWrap}>
                    <Icon name="person" size={22} color="#94a3b8" />
                  </View>

                  <View style={styles.alertDetails}>
                    <Text style={styles.alertCode} numberOfLines={1}>Code: {alert.code}</Text>
                    <Text style={styles.alertFullName} numberOfLines={1}>{alert.fullName}</Text>
                    <Text style={styles.alertMeta}>Date: {alert.date}</Text>
                  </View>

                  <View style={styles.missingWrap}>
                    <View style={styles.warningIconWrap}>
                      <Icon name="warningTriangle" size={18} color="#F04D59" weight="fill" />
                    </View>
                    <Text style={styles.missingText}>{alert.missing}x Missing</Text>
                  </View>
                </View>

                <View style={styles.agentRow}>
                  <Text style={styles.agentName}>{alert.agentName}</Text>
                  <Text style={styles.agentRole}>{alert.agentRole}</Text>
                </View>

                <View style={styles.figuresRow}>
                  <View style={styles.figurePill}>
                    <Text style={styles.figurePillText}>Released: {alert.released}x</Text>
                  </View>
                  <View style={styles.figurePill}>
                    <Text style={styles.figurePillText}>
                      Reported: {alert.reported} sold ({alert.returned} return)
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>

        <BottomNavBar activeTab="dashboard" onTabPress={handleTabPress} onFabPress={() => {}} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  bannerRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
  },
  bannerTitle: {
    fontSize: 19,
    color: '#B91C1C',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    flexShrink: 1,
    marginRight: 8,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' },
  onlineText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.success,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: 96,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  alertDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  alertsList: {
    gap: 16,
  },
  alertCard: {
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 14,
    padding: 12,
  },
  alertTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F3F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  alertDetails: {
    flex: 1,
  },
  alertCode: {
    fontSize: 15,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  alertFullName: {
    fontSize: 12,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  alertMeta: {
    fontSize: 11,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 4,
  },
  missingWrap: {
    alignItems: 'center',
  },
  warningIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFEEEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  missingText: {
    marginTop: 4,
    fontSize: 11,
    color: '#B91C1C',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
  },
  agentName: {
    fontSize: 13,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  agentRole: {
    fontSize: 11,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  figuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  figurePill: {
    backgroundColor: '#EAFBF2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  figurePillText: {
    fontSize: 10,
    color: '#1E7A3A',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
});
