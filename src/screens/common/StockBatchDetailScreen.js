// src/screens/common/StockBatchDetailScreen.js
// Opened by tapping a StockBatchCard on either Manager or Sales Rep Stock
// screens. Reuses QRSuccessView (same layout as the post-registration QR
// screen in ReceiveStockPreviewScreen) so a lost/damaged shelf label for an
// existing batch can be reprinted, re-saved, or re-shared on demand.
import React from 'react';
import { View, Text, Image, ScrollView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import Header from '../../components/common/Header';
import QRSuccessView from '../../components/common/QRSuccessView';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import { TYPOGRAPHY } from '../../styles/typography';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { formatDisplayDate } from '../../utils/formatters';

export default function StockBatchDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { productName, quantity, batchNumber, expDate, mfgDate, branchName, hideQr, productCode, branchId } = route.params || {};
  const image = PRODUCT_CATALOG.find((p) => p.code === productCode)?.image;

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
        {hideQr ? (
          // Sales Rep: product first (image, then details), with a shortcut
          // to request more of it from the branch.
          <ScrollView contentContainerStyle={styles.productContent} showsVerticalScrollIndicator={false}>
            <View style={styles.imageCard}>
              {image ? (
                <Image source={image} style={styles.productImage} resizeMode="contain" />
              ) : (
                <Icon name="package" size={56} color="#94a3b8" />
              )}
            </View>
            <Text style={styles.productTitle}>{productName || 'Product'}</Text>
            {!!productCode && <Text style={styles.productCode}>Code: {productCode}</Text>}

            <View style={styles.detailCard}>
              {receipt.map((row, index) => (
                <View key={row.label} style={[styles.detailRow, index > 0 && styles.detailRowDivider]}>
                  <Text style={styles.detailLabel}>{row.label}</Text>
                  <Text style={styles.detailValue}>{row.value}</Text>
                </View>
              ))}
            </View>

            <Button
              title="Request This Product"
              variant="black"
              icon="plus"
              height={48}
              fontSize={15}
              onPress={() => navigation.navigate('RequestStockSR', { prefillProductCode: productCode, branchId })}
              disabled={!productCode}
              style={styles.fullWidth}
            />
            <Button
              title="Back to Stock"
              variant="outline"
              height={44}
              fontSize={15}
              hasShadow={false}
              onPress={() => navigation.goBack()}
              style={[styles.fullWidth, styles.secondaryButton]}
            />
          </ScrollView>
        ) : (
        <QRSuccessView
          title={productName || 'Batch Details'}
          subtitle={hideQr ? 'Batch information for this product.' : 'Scan this code anytime to track this batch.'}
          qrValue={batchNumber}
          receipt={receipt}
          onDone={() => navigation.goBack()}
          hideQr={hideQr}
        />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  productContent: { padding: SPACING.lg, alignItems: 'center' },
  imageCard: {
    width: 180,
    height: 180,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEFF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  productImage: { width: 140, height: 140 },
  productTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    color: '#272632',
    textAlign: 'center',
  },
  productCode: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  detailCard: {
    alignSelf: 'stretch',
    marginTop: SPACING.lg,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAEFF5',
    backgroundColor: '#FFFFFF',
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, gap: SPACING.md },
  detailRowDivider: { borderTopWidth: 1, borderTopColor: '#EEF2F7' },
  detailLabel: { fontSize: TYPOGRAPHY.fontSize.sm, fontFamily: TYPOGRAPHY.fontFamily.medium, color: COLORS.textSecondary },
  detailValue: {
    flexShrink: 1,
    textAlign: 'right',
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    color: '#272632',
  },
  fullWidth: { width: '100%' },
  secondaryButton: { marginTop: SPACING.sm },
});
