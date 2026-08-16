// src/screens/manager/ManageAccountsScreen.js
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Dimensions, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Header from '../../components/common/Header';
import Button from '../../components/common/Button';
import LogListItem from '../../components/common/LogListItem';
import agentService from '../../services/agentService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const { width: screenWidth } = Dimensions.get('window');

const SECTIONS = [
  { role: 'sales_rep', title: 'Sales Representatives', icon: 'person', iconColor: COLORS.primary, emptyText: 'No sales reps yet.' },
  { role: 'collector', title: 'Collectors', icon: 'trayDown', iconColor: COLORS.secondary, emptyText: 'No collectors yet.' },
];

export default function ManageAccountsScreen() {
  const navigation = useNavigation();
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    const result = await agentService.getMyAgentAccounts();
    setAccounts(result.success ? result.data : []);
    setIsLoading(false);
  }, []);

  // Refetch every time this screen regains focus, so an account created via
  // "Add Account" shows up immediately on the way back without a manual refresh.
  useFocusEffect(
    useCallback(() => {
      loadAccounts();
    }, [loadAccounts])
  );

  const buttonWidth = screenWidth - SPACING.lg * 2;

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton={true}
          backButtonText="Back"
          title="Manage Accounts"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
        />

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {SECTIONS.map((section) => {
              const rows = accounts.filter((a) => a.role === section.role);
              return (
                <View key={section.role} style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    {section.title} ({rows.length})
                  </Text>
                  {rows.length === 0 ? (
                    <Text style={styles.emptyText}>{section.emptyText}</Text>
                  ) : (
                    <View style={styles.list}>
                      {rows.map((account) => (
                        <LogListItem
                          key={account.id}
                          icon={section.icon}
                          iconColor={section.iconColor}
                          text={`${account.full_name} (${account.username})`}
                        />
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}

        <View style={styles.bottomBar}>
          <Button
            title="Add Account"
            onPress={() => navigation.navigate('AgentAccounts')}
            variant="black"
            width={buttonWidth}
            height={50}
            borderRadius={12}
          />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: SPACING.lg, paddingBottom: 24 },
  section: { marginBottom: SPACING.xl },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  list: { gap: SPACING.sm },
  bottomBar: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    backgroundColor: COLORS.background,
  },
});
