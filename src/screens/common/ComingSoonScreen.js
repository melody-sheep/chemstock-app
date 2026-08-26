// src/screens/common/ComingSoonScreen.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import Header from '../../components/common/Header';
import Icon from '../../components/common/Icon';
import BottomNavBar from '../../components/common/BottomNavBar';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const ROLE_LABELS = {
  manager: 'Manager',
  salesrep: 'Sales Rep',
  collector: 'Collector',
};

// Real route name for each tab, per role — only the tabs that actually have
// a built screen; any tab not listed here is still ComingSoon too, so
// pressing it just re-navigates here with different params instead of
// dead-ending on an alert.
const ROLE_ROUTES = {
  manager: { dashboard: 'ManagerDashboard', stock: 'ManagerStock', reports: 'ManagerReports', settings: 'ManagerSettings' },
  salesrep: { dashboard: 'SalesRepDashboard', stock: 'SalesRepStock', reports: 'SalesRepReports', settings: 'SalesRepSettings' },
  collector: { dashboard: 'CollectorDashboard', settings: 'CollectorSettings' },
};

/**
 * ComingSoonScreen - generic placeholder for a bottom-nav tab that doesn't
 * have a real screen yet (Manager Reports, Collector Stock/Reports). Real
 * navigation instead of a dead-end alert, so the tab bar's highlight/switch
 * behavior can actually be seen working for every tab, not just the built
 * ones. Pass `tabKey` + `role` as route params to say which tab/role this
 * instance represents.
 */
export default function ComingSoonScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { tabKey = 'settings', role = 'manager' } = route.params || {};

  const roleLabel = ROLE_LABELS[role] || role;
  const tabLabel = tabKey.charAt(0).toUpperCase() + tabKey.slice(1);
  const routes = ROLE_ROUTES[role] || {};

  const handleTabPress = (key) => {
    if (key === tabKey) return;
    const target = routes[key];
    if (target) {
      navigation.navigate(target);
    } else {
      navigation.navigate('ComingSoon', { tabKey: key, role });
    }
  };

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          title={`${roleLabel} ${tabLabel}`}
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
        />
        <View style={styles.body}>
          <Icon name="clock" size={48} color={COLORS.textSecondary} />
          <Text style={styles.title}>{tabLabel} is coming soon</Text>
          <Text style={styles.subtitle}>
            This section hasn't been built yet — the tab navigation itself works, this screen just isn't real yet.
          </Text>
        </View>
        <BottomNavBar activeTab={tabKey} onTabPress={handleTabPress} onFabPress={() => {}} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: SPACING.sm,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
