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
import { formatDisplayDate, daysUntil } from '../../utils/formatters';
import { STOCK_HEALTHY_THRESHOLD, NEAR_EXPIRY_DAYS } from '../../constants/inventory';

export default function StockBatchDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { productName, quantity, batchNumber, expDate, mfgDate, branchName, hideQr, productCode, branchId } = route.params || {};
  // The Manager's stock card passes the product's name (equal to its code) and no code.
  const image = PRODUCT_CATALOG.find((p) => p.code === productCode || p.code === productName)?.image;

  const receipt = [
    { label: 'Product', value: productName || '—' },
    { label: 'Branch', value: branchName || '—' },
    { label: 'Quantity', value: `${quantity ?? 0} pcs` },
    { label: 'Mfg Date', value: formatDisplayDate(mfgDate) || '—' },
    { label: 'Exp Date', value: formatDisplayDate(expDate) || '—' },
  ];

  // Sales Rep view: colour the quantity by stock level and the expiry by how close it is.
  const qty = quantity ?? 0;
  const levelTone =
    qty <= 0
      ? { bg: '#FDECEC', color: '#B91C1C', label: 'Out of stock' }
      : qty < STOCK_HEALTHY_THRESHOLD
      ? { bg: '#FFF1D6', color: '#B26400', label: 'Almost out' }
      : { bg: '#E1F4E8', color: '#1E7A3A', label: 'In-stock' };
  const daysLeft = daysUntil(expDate);
  const expiryTone =
    daysLeft === null
      ? { bg: '#F1F3F6', color: '#6B7280', value: '—', hint: 'No expiry date' }
      : daysLeft < 0
      ? { bg: '#FDECEC', color: '#B91C1C', value: 'Expired', hint: `${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} ago` }
      : daysLeft <= NEAR_EXPIRY_DAYS
      ? { bg: '#FFF1D6', color: '#B26400', value: `${daysLeft} day${daysLeft === 1 ? '' : 's'}`, hint: 'Expires soon' }
      : {
          bg: '#E1F4E8',
          color: '#1E7A3A',
          value: daysLeft >= 365 ? `${Math.floor(daysLeft / 365)} yr${daysLeft >= 730 ? 's' : ''}` : daysLeft >= 60 ? `${Math.floor(daysLeft / 30)} months` : `${daysLeft} days`,
          hint: 'Until expiry',
        };
  const batchRows = [
    { icon: 'idCard', label: 'Batch no.', value: batchNumber || '—', stacked: true },
    { icon: 'calendar', label: 'Mfg date', value: formatDisplayDate(mfgDate) || '—' },
    { icon: 'clockCountdown', label: 'Exp date', value: formatDisplayDate(expDate) || '—' },
    { icon: 'location', label: 'Branch', value: branchName || '—' },
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
            <View style={[styles.levelPill, { backgroundColor: levelTone.bg }]}>
              <View style={[styles.levelDot, { backgroundColor: levelTone.color }]} />
              <Text style={[styles.levelPillText, { color: levelTone.color }]}>{levelTone.label}</Text>
            </View>

            <View style={styles.statRow}>
              <View style={[styles.statTile, { backgroundColor: levelTone.bg }]}>
                <Text style={[styles.statValue, { color: levelTone.color }]}>{qty} pcs</Text>
                <Text style={[styles.statHint, { color: levelTone.color }]}>On hand</Text>
              </View>
              <View style={[styles.statTile, { backgroundColor: expiryTone.bg }]}>
                <Text style={[styles.statValue, { color: expiryTone.color }]}>{expiryTone.value}</Text>
                <Text style={[styles.statHint, { color: expiryTone.color }]}>{expiryTone.hint}</Text>
              </View>
            </View>

            <Text style={styles.sectionLabel}>BATCH</Text>
            <View style={styles.detailCard}>
              {batchRows.map((row, index) => (
                <View key={row.label} style={[styles.detailRow, index > 0 && styles.detailRowDivider, row.stacked && styles.detailRowStacked]}>
                  <View style={styles.detailLabelWrap}>
                    <Icon name={row.icon} size={18} color={COLORS.textSecondary} />
                    <Text style={styles.detailLabel}>{row.label}</Text>
                    {!row.stacked && (
                      <Text style={styles.detailValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{row.value}</Text>
                    )}
                  </View>
                  {row.stacked && (
                    <Text style={styles.detailValueStacked} selectable>{row.value}</Text>
                  )}
                </View>
              ))}
            </View>

            <Button
              title="Request This Product"
              variant="black"
              icon="plus"
              height={48}
              fontSize={15}
              borderRadius={24}
              onPress={() => navigation.navigate('RequestStockSR', { prefillProductCode: productCode, branchId })}
              disabled={!productCode}
              style={styles.fullWidth}
            />
          </ScrollView>
        ) : (
        <QRSuccessView
          title={productName || 'Batch Details'}
          subtitle={hideQr ? 'Batch information for this product.' : 'Scan this code anytime to track this batch.'}
          qrValue={batchNumber}
          receipt={receipt.filter((row) => row.label !== 'Product')}
          onDone={() => navigation.goBack()}
          hideQr={hideQr}
          headerImage={image || null}
          doneLabel="Close"
          doneIcon="xCircle"
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
  levelPill: { marginTop: SPACING.xs, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  levelDot: { width: 8, height: 8, borderRadius: 4 },
  levelPillText: { fontSize: TYPOGRAPHY.fontSize.sm, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  statRow: { alignSelf: 'stretch', flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  statTile: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14 },
  statValue: { fontSize: 22, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  statHint: { marginTop: 2, fontSize: TYPOGRAPHY.fontSize.xs, fontFamily: TYPOGRAPHY.fontFamily.medium },
  sectionLabel: { alignSelf: 'flex-start', marginTop: SPACING.lg, fontSize: 12, letterSpacing: 0.8, color: COLORS.textTertiary, fontFamily: TYPOGRAPHY.fontFamily.semibold, fontWeight: '600' },
  detailCard: {
    alignSelf: 'stretch',
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAEFF5',
    backgroundColor: '#FFFFFF',
  },
  detailRow: { paddingVertical: 12 },
  detailRowStacked: { gap: 6 },
  detailLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  detailValueStacked: {
    paddingLeft: 26,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    color: '#272632',
  },
  detailRowDivider: { borderTopWidth: 1, borderTopColor: '#EEF2F7' },
  detailLabel: { flexShrink: 0, fontSize: TYPOGRAPHY.fontSize.sm, fontFamily: TYPOGRAPHY.fontFamily.medium, color: COLORS.textSecondary },
  detailValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    color: '#272632',
  },
  fullWidth: { width: '100%' },
  secondaryButton: { marginTop: SPACING.sm },
});
