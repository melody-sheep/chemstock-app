// src/screens/salesrep/SalesRepBackpackScreen.js
// A Sales Rep's personal stock — what they have accepted and are carrying.
// Separate from the Stock tab, which shows the branch warehouse.
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import StockBatchCard from '../../components/common/StockBatchCard';
import SkeletonBlock from '../../components/ui/SkeletonBlock';
import Icon from '../../components/common/Icon';
import authService from '../../services/authService';
import inventoryService from '../../services/inventoryService';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const BANNER_HEIGHT = 76;

export default function SalesRepBackpackScreen() {
  const navigation = useNavigation();
  const [agent, setAgent] = useState(null);
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadBackpack = useCallback(async () => {
    setIsLoading(true);
    const currentAgent = await authService.getCurrentUser();
    setAgent(currentAgent);
    const result = await inventoryService.getSrInventory(currentAgent?.id);
    setItems(result.success ? result.data.filter((row) => row.remaining_quantity > 0) : []);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBackpack();
    }, [loadBackpack])
  );

  const totalUnits = items.reduce((sum, row) => sum + row.remaining_quantity, 0);

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          title="My Backpack"
          titleAlign="left"
          showBackButton
          backButtonText="Back"
          onBackPress={() => navigation.goBack()}
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
        />

        <SecondaryHeader height={BANNER_HEIGHT}>
          <View style={styles.bannerRow}>
            <View style={styles.bannerTextCol}>
              <Text style={styles.bannerName} numberOfLines={1}>
                {agent?.full_name || agent?.username || ''}
              </Text>
              <Text style={styles.bannerSubtitle}>Personal Inventory</Text>
            </View>
            <View style={styles.totalPill}>
              <Icon name="backpack" size={14} color={COLORS.primary} />
              <Text style={styles.totalText}>
                {totalUnits} unit{totalUnits === 1 ? '' : 's'}
              </Text>
            </View>
          </View>
        </SecondaryHeader>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <View style={styles.grid}>
              <SkeletonBlock width={144} height={200} borderRadius={14} />
              <SkeletonBlock width={144} height={200} borderRadius={14} />
            </View>
          ) : items.length === 0 ? (
            <Text style={styles.emptyText}>Nothing in your backpack yet. Accept a release to see it here.</Text>
          ) : (
            <View style={styles.grid}>
              {items.map((row) => (
                <StockBatchCard
                  key={row.id}
                  productName={row.product_name}
                  image={PRODUCT_CATALOG.find((p) => p.code === row.product_code)?.image}
                  quantity={row.remaining_quantity}
                  batchNumber={row.batch_number}
                  expDate={row.exp_date}
                />
              ))}
            </View>
          )}
        </ScrollView>
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
  bannerTextCol: { flexShrink: 1 },
  bannerName: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  bannerSubtitle: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  totalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '12',
  },
  totalText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.primary,
  },
  content: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: 96 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
});
