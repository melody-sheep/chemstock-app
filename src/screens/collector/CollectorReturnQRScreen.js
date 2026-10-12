// src/screens/collector/CollectorReturnQRScreen.js
// Shown right after a Collector initiates a return (CollectorAcceptDeliveriesScreen),
// and reopenable any time from the "Returning to Manager" list to show the
// QR again. Reuses QRSuccessView — same "reprint anytime" pattern as
// StockBatchDetailScreen. This QR is only ever looked up by
// confirm_collector_return (the Manager's Receive Stock scan), never by any
// Sales Rep flow.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import Header from '../../components/common/Header';
import QRSuccessView from '../../components/common/QRSuccessView';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';

export default function CollectorReturnQRScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { qrCode, items, branchName } = route.params || {};

  const itemSummary = (items || [])
    .map((item) => `${item.productName} x${item.quantity}`)
    .join(', ') || '—';

  const receipt = [
    { label: 'Branch', value: branchName || '—' },
    { label: 'Items', value: itemSummary },
  ];

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton
          backButtonText="Accept Deliveries"
          title="Return to Manager"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
        />
        <QRSuccessView
          title="Show This QR to Your Manager"
          subtitle="Your manager scans this in Receive Stock to confirm the return and credit it back to inventory."
          qrValue={qrCode}
          receipt={receipt}
          onDone={() => navigation.navigate('CollectorAcceptDeliveries')}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
});
