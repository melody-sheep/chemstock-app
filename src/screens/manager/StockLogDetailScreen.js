// src/screens/manager/StockLogDetailScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRoute } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import LiveStatusPill from '../../components/common/LiveStatusPill';
import SectionHeader from '../../components/common/SectionHeader';
import Icon from '../../components/common/Icon';
import SaveableQRCode from '../../components/common/SaveableQRCode';
import ImageViewerModal from '../../components/common/ImageViewerModal';
import inventoryService from '../../services/inventoryService';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { getLogGps, getLogItems } from '../../utils/stockLogUtils';
import { cleanDeviceOs } from '../../utils/deviceInfo';
import { formatDateTime } from '../../utils/formatters';

// Same colours the ledger uses for each kind of log.
const TYPE_TONE = {
  receive: { label: 'Received', color: '#0096C7', bg: '#CAF0F8' },
  release: { label: 'Released', color: '#4c9f70', bg: '#4c9f7020' },
  delivery: { label: 'Delivered', color: '#4c9f70', bg: '#4c9f7020' },
};

// Sharp MFG / EXP chips, the same colours as on Receive Stock.
const DATE_TONE = {
  MFG: { solid: '#1E6FE0' },
  EXP: { solid: '#D6336C' },
};

// Short footnote under each kind of record.
const NOTE_BY_TYPE = {
  receive: 'A saved record of stock received into the branch. It cannot be edited. Scan its QR code anytime to track the batch.',
  release: 'A saved record of stock released from the branch. It cannot be edited. Scan its QR code anytime to track the release.',
  delivery: 'A saved record of a completed delivery, with where it was handed over. It cannot be edited.',
};

const imageFor = (name) => PRODUCT_CATALOG.find((p) => p.code === name || p.name === name)?.image;

export default function StockLogDetailScreen() {
  const route = useRoute();
  const log = route.params?.log;
  const recipientNameById = route.params?.recipientNameById || {};

  const [photoUrl, setPhotoUrl] = useState(null);
  const [isPhotoLoading, setIsPhotoLoading] = useState(false);
  const [isViewerVisible, setIsViewerVisible] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadPhoto = async () => {
      if (!log?.media?.storage_path) return;
      setIsPhotoLoading(true);
      const url = await inventoryService.getShipmentPhotoUrl(log.media.storage_path);
      if (isMounted) {
        setPhotoUrl(url);
        setIsPhotoLoading(false);
      }
    };

    loadPhoto();
    return () => {
      isMounted = false;
    };
  }, [log]);

  if (!log) {
    return (
      <>
        <StatusBar style="light" />
        <View style={styles.container}>
          <Header showBackButton title="Log Detail" titleAlign="left" height={56} backgroundColor="#03045E" textColor="#FFFFFF" />
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No log data.</Text>
          </View>
        </View>
      </>
    );
  }

  const getTitle = () => {
    if (log.logType === 'delivery') {
      const targetName = recipientNameById[log.target_recipient_id] || 'Sales Rep';
      return `Delivery Completed — ${targetName}`;
    }
    if (log.logType === 'release') {
      return `Stock Released${recipientNameById[log.received_by] ? ` — ${recipientNameById[log.received_by]}` : ''}`;
    }
    return 'Stock Received';
  };

  const tone = TYPE_TONE[log.logType] || TYPE_TONE.receive;
  const items = getLogItems(log);
  const gps = getLogGps(log);
  const deviceText = log.media?.device_model
    ? [log.media.device_model, cleanDeviceOs(log.media.device_os)].filter(Boolean).join(' · ')
    : null;

  const renderDateChip = (label, value) => (
    <View style={[styles.dateChip, { backgroundColor: DATE_TONE[label].solid }]}>
      <Text style={styles.dateChipLabel}>{label}</Text>
      <Text style={styles.dateChipValue}>{new Date(value).toLocaleDateString()}</Text>
    </View>
  );

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton
          title="Log Detail"
          titleAlign="left"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
        />

        <SecondaryHeader height={76}>
          <View style={styles.titleRow}>
            <View style={styles.titleTextCol}>
              <Text style={styles.pageTitle} numberOfLines={2}>{getTitle()}</Text>
              <Text style={styles.pageSubtitle}>{formatDateTime(new Date(log.created_at))}</Text>
            </View>
            <View style={[styles.typePill, { backgroundColor: tone.bg }]}>
              <Text style={[styles.typePillText, { color: tone.color }]}>{tone.label}</Text>
            </View>
          </View>
        </SecondaryHeader>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <SectionHeader icon="package" size="md" label={`Items (${items.length})`} style={styles.labelFirst} />
          <View style={styles.itemsList}>
            {items.map((item, index) => {
              const image = imageFor(item.name);
              return (
                <View key={`${item.key}-${index}`} style={styles.itemCard}>
                  <View style={styles.itemThumb}>
                    {image ? (
                      <Image source={image} style={styles.itemImage} resizeMode="contain" />
                    ) : (
                      <Icon name="package" size={22} color={COLORS.textSecondary} />
                    )}
                  </View>
                  <View style={styles.itemInfo}>
                    <View style={styles.itemTitleRow}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemQty}>Qty {item.qty}</Text>
                    </View>
                    {(item.mfgDate || item.expDate) && (
                      <View style={styles.chipRow}>
                        {!!item.mfgDate && renderDateChip('MFG', item.mfgDate)}
                        {!!item.expDate && renderDateChip('EXP', item.expDate)}
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {(gps || deviceText) && (
            <>
              <SectionHeader icon="clipboardText" size="md" label="Details" style={styles.labelSpaced} />
              <View style={styles.metaCard}>
                {!!gps && (
                  <View style={styles.metaRow}>
                    <Icon name="location" size={16} color={COLORS.error} />
                    <Text style={styles.metaText}>
                      {gps.latitude.toFixed(5)}, {gps.longitude.toFixed(5)}
                    </Text>
                  </View>
                )}
                {!!deviceText && (
                  <View style={styles.metaRow}>
                    <Icon name="phone" size={16} color={COLORS.textSecondary} />
                    <Text style={styles.metaText}>{deviceText}</Text>
                  </View>
                )}
              </View>
            </>
          )}

          {log.logType !== 'delivery' && (
            <>
              <SectionHeader
                icon="qrCode"
                size="md"
                label={log.logType === 'release' ? 'Release QR code' : 'Shipment QR code'}
                style={styles.labelSpaced}
              />
              <SaveableQRCode value={log.qr_code} size={156} compact style={styles.qrCard} />

              {log.media?.storage_path && (
                <>
                  <SectionHeader
                    icon="camera"
                    size="md"
                    label={log.logType === 'release' ? 'Release proof' : 'Shipment proof'}
                    style={styles.labelSpaced}
                  />
                  {isPhotoLoading ? (
                    <ActivityIndicator
                      size="small"
                      color={COLORS.primary}
                      style={{ marginVertical: SPACING.md }}
                    />
                  ) : photoUrl ? (
                    <TouchableOpacity
                      style={styles.photoWrap}
                      onPress={() => setIsViewerVisible(true)}
                      activeOpacity={0.85}
                      accessibilityLabel="View full-size photo"
                      accessibilityRole="button"
                    >
                      <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" />
                      <View style={styles.expandBadge}>
                        <Icon name="expand" size={14} color="#FFFFFF" />
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.emptyText}>Photo unavailable.</Text>
                  )}
                </>
              )}
            </>
          )}

          <View style={styles.noteRow}>
            <Icon name="lock" size={13} color={COLORS.textTertiary} />
            <Text style={styles.noteText}>{NOTE_BY_TYPE[log.logType] || NOTE_BY_TYPE.receive}</Text>
          </View>
        </ScrollView>
      </View>

      <ImageViewerModal
        visible={isViewerVisible}
        onClose={() => setIsViewerVisible(false)}
        imageUri={photoUrl}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  titleTextCol: { flexShrink: 1, flex: 1 },
  pageTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  pageSubtitle: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  typePill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  typePillText: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING['3xl'],
  },
  labelFirst: { marginTop: SPACING.sm, marginBottom: 0 },
  labelSpaced: { marginTop: SPACING.lg, marginBottom: 0 },
  itemsList: { gap: SPACING.sm, marginTop: SPACING.sm },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
  },
  itemThumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  itemImage: { width: '100%', height: '100%' },
  itemInfo: { flex: 1, gap: 6 },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  itemName: {
    flexShrink: 1,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  itemQty: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.success,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: 0,
  },
  dateChipLabel: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
  },
  dateChipValue: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  metaCard: {
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  metaText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: SPACING.lg,
    paddingHorizontal: 4,
  },
  noteText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textTertiary,
  },
  qrCard: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  photoWrap: {
    marginTop: SPACING.sm,
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  expandBadge: {
    position: 'absolute',
    bottom: SPACING.sm,
    right: SPACING.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
