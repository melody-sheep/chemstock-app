// src/screens/common/StockBatchDetailScreen.js
// Opened by tapping a StockBatchCard on either Manager or Sales Rep Stock
// screens. Reuses QRSuccessView (same layout as the post-registration QR
// screen in ReceiveStockPreviewScreen) so a lost/damaged shelf label for an
// existing batch can be reprinted, re-saved, or re-shared on demand.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import Header from '../../components/common/Header';
import QRSuccessView from '../../components/common/QRSuccessView';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { formatDisplayDate } from '../../utils/formatters';

export default function StockBatchDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { productName, quantity, batchNumber, expDate, mfgDate, branchName } = route.params || {};

  const receipt = [
    { label: 'Product', value: productName || '—' },
    { label: 'Branch', value: branchName || '—' },
    { label: 'Quantity', value: `${quantity ?? 0} pcs` },
    { label: 'Mfg Date', value: formatDisplayDate(mfgDate) || '—' },
    { label: 'Exp Date', value: formatDisplayDate(expDate) || '—' },
  ];

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton
          backButtonText="Stock"
          title="Batch Details"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
        />
        <QRSuccessView
          title={productName || 'Batch Details'}
          subtitle="Scan this code anytime to track this batch."
          qrValue={batchNumber}
          receipt={receipt}
          onDone={() => navigation.goBack()}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
});
