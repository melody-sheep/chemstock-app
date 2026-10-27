// src/components/common/ScanResultSheet.js
// What the Manager sees after scanning a stock batch QR: the batch's products with their pictures,
// quantities, stock level and expiry — instead of one block of plain text in an alert.
// Takes the summary from utils/scanLookup (describeReceivingScan). View only: it reads, never writes.
import React from 'react';
import { View, Text, Image, ScrollView, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import CustomModal from './Modal';
import Button from './Button';
import Icon from './Icon';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import { STOCK_HEALTHY_THRESHOLD, NEAR_EXPIRY_DAYS } from '../../constants/inventory';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { daysUntil, formatDisplayDate } from '../../utils/formatters';
import { isExpired } from '../../utils/expiry';

// Same stock-level colours as the Stock tab.
const LEVEL = {
  healthy: { label: 'In-stock', bg: '#E1F4E8', color: '#1E7A3A' },
  low: { label: 'Almost out', bg: '#FFF1D6', color: '#B26400' },
  out: { label: 'Out of stock', bg: '#FDECEC', color: '#B91C1C' },
};

const levelOf = (quantity) => (quantity <= 0 ? LEVEL.out : quantity < STOCK_HEALTHY_THRESHOLD ? LEVEL.low : LEVEL.healthy);

const imageFor = (row) =>
  PRODUCT_CATALOG.find((p) => p.code === row.productCode || p.code === row.productName)?.image;

function expiryTag(expDate) {
  if (!expDate) return null;
  if (isExpired(expDate)) return { label: 'Expired', bg: '#FDECEC', color: '#B91C1C' };
  const days = daysUntil(expDate);
  if (days !== null && days <= NEAR_EXPIRY_DAYS) return { label: 'Near expiry', bg: '#FFF1D6', color: '#B26400' };
  return null;
}

const HEADERS = {
  found: { icon: 'checkCircle', color: COLORS.success, weight: 'fill' },
  nomatch: { icon: 'question', color: '#B26400', weight: 'fill' },
  error: { icon: 'warningTriangle', color: COLORS.error, weight: 'fill' },
};

export default function ScanResultSheet({ summary, onClose, onScanAgain }) {
  const status = summary?.status || 'error';
  const header = HEADERS[status] || HEADERS.error;
  const batch = summary?.batch;
  const items = batch?.items || [];

  return (
    <CustomModal visible={!!summary} onClose={onClose} height="auto" maxHeight={700}>
      {!!summary && (
        <>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <View style={[styles.headerCircle, { backgroundColor: header.color + '1F' }]}>
              <Icon name={header.icon} size={26} color={header.color} weight={header.weight} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>{status === 'found' ? 'Batch found' : summary.title}</Text>
              {status === 'found' && !!batch?.receivedAt && (
                <Text style={styles.subtitle}>Received {formatDisplayDate(batch.receivedAt)}</Text>
              )}
            </View>
          </View>

          {status === 'found' ? (
            <>
              <View style={styles.chipRow}>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{items.length} product{items.length === 1 ? '' : 's'}</Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{batch?.totalUnits ?? 0} units remaining</Text>
                </View>
              </View>

              <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                {items.map((row, index) => {
                  const image = imageFor(row);
                  const level = levelOf(row.quantity);
                  const expiry = expiryTag(row.expDate);
                  return (
                    <View key={`${row.batchNumber}-${index}`} style={[styles.itemRow, index > 0 && styles.itemRowDivider]}>
                      <View style={styles.thumb}>
                        {image ? (
                          <Image source={image} style={styles.thumbImage} resizeMode="contain" />
                        ) : (
                          <Icon name="package" size={24} color="#94a3b8" />
                        )}
                      </View>
                      <View style={styles.itemText}>
                        <Text style={styles.itemName} numberOfLines={1}>{row.productName}</Text>
                        <Text style={styles.itemBatch} numberOfLines={1} ellipsizeMode="middle">{row.batchNumber}</Text>
                        {!!row.expDate && (
                          <View style={styles.expRow}>
                            <Text style={styles.expText}>Exp {formatDisplayDate(row.expDate)}</Text>
                            {!!expiry && (
                              <View style={[styles.tag, { backgroundColor: expiry.bg }]}>
                                <Text style={[styles.tagText, { color: expiry.color }]}>{expiry.label}</Text>
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                      <View style={styles.itemRight}>
                        <Text style={styles.qty}>{row.quantity}</Text>
                        <Text style={styles.qtyUnit}>pcs</Text>
                        <View style={[styles.tag, { backgroundColor: level.bg }]}>
                          <Text style={[styles.tagText, { color: level.color }]}>{level.label}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </>
          ) : (
            <Text style={styles.message}>{summary.message}</Text>
          )}

          <Button title="Done" variant="black" onPress={onClose} height={48} fontSize={16} borderRadius={24} width="100%" style={styles.doneButton} />
          {!!onScanAgain && (
            <Button
              title="Scan another"
              variant="outline"
              icon="qrCode"
              onPress={onScanAgain}
              hasShadow={false}
              height={48}
              fontSize={16}
              borderRadius={24}
              width="100%"
              style={styles.scanButton}
            />
          )}
        </>
      )}
    </CustomModal>
  );
}

ScanResultSheet.propTypes = {
  summary: PropTypes.shape({
    status: PropTypes.string,
    title: PropTypes.string,
    message: PropTypes.string,
    batch: PropTypes.object,
  }),
  onClose: PropTypes.func.isRequired,
  onScanAgain: PropTypes.func,
};

const styles = StyleSheet.create({
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#DADDE3', marginTop: -8, marginBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  title: { fontSize: TYPOGRAPHY.fontSize.lg, color: '#272632', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  subtitle: { marginTop: 1, fontSize: 12, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.regular },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, backgroundColor: '#EAF4FF' },
  chipText: { fontSize: 12, color: '#0085F9', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  list: { marginTop: 12, borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 12, backgroundColor: '#FFFFFF', maxHeight: 360 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  itemRowDivider: { borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  thumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#F7F8FA', borderWidth: 1, borderColor: '#EEEEEE', alignItems: 'center', justifyContent: 'center', padding: 4 },
  thumbImage: { width: '100%', height: '100%' },
  itemText: { flex: 1 },
  itemName: { fontSize: TYPOGRAPHY.fontSize.base, color: '#272632', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  itemBatch: { marginTop: 1, fontSize: 11, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.regular },
  expRow: { marginTop: 3, flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  expText: { fontSize: 12, color: '#555353', fontFamily: TYPOGRAPHY.fontFamily.regular },
  itemRight: { alignItems: 'flex-end' },
  qty: { fontSize: 20, color: '#272632', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', lineHeight: 22 },
  qtyUnit: { fontSize: 11, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.regular, marginBottom: 4 },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  tagText: { fontSize: 11, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  message: { marginTop: 12, fontSize: TYPOGRAPHY.fontSize.base, color: COLORS.textSecondary, lineHeight: 22, fontFamily: TYPOGRAPHY.fontFamily.regular },
  doneButton: { marginTop: 16 },
  scanButton: { marginTop: 8 },
});
