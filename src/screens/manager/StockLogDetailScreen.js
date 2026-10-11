// src/screens/manager/StockLogDetailScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRoute } from '@react-navigation/native';
import Header from '../../components/common/Header';
import Icon from '../../components/common/Icon';
import SaveableQRCode from '../../components/common/SaveableQRCode';
import inventoryService from '../../services/inventoryService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { getLogGps, getLogItems } from '../../utils/stockLogUtils';

export default function StockLogDetailScreen() {
  const route = useRoute();
  const log = route.params?.log;
  const recipientNameById = route.params?.recipientNameById || {};

  const [photoUrl, setPhotoUrl] = useState(null);
  const [isPhotoLoading, setIsPhotoLoading] = useState(false);

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
          <Header showBackButton title="Log Detail" height={56} backgroundColor="#03045E" textColor="#FFFFFF" />
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

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton
          title="Log Detail"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
        />

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.detailTitle}>{getTitle()}</Text>
          <Text style={styles.detailSubtitle}>
            {new Date(log.created_at).toLocaleString()}
          </Text>

          <View style={styles.sectionHeader}>
            <Icon name="package" size={14} color={COLORS.textTertiary} />
            <Text style={styles.detailSectionLabel}>Items</Text>
          </View>
          <View style={styles.itemsCard}>
            {getLogItems(log).map((item, index) => (
              <View
                key={`${item.key}-${index}`}
                style={[styles.itemRow, index === 0 && styles.itemRowFirst]}
              >
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>
                  Qty: {item.qty}
                  {item.mfgDate ? `   Mfg: ${new Date(item.mfgDate).toLocaleDateString()}` : ''}
                  {item.expDate ? `   Exp: ${new Date(item.expDate).toLocaleDateString()}` : ''}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.sectionHeader}>
            <Icon name="idCard" size={14} color={COLORS.textTertiary} />
            <Text style={styles.detailSectionLabel}>Details</Text>
          </View>
          <View style={styles.metaCard}>
            {getLogGps(log) && (
              <View style={styles.metaRow}>
                <Icon name="location" size={16} color={COLORS.error} />
                <Text style={styles.metaText}>
                  {getLogGps(log).latitude.toFixed(5)}, {getLogGps(log).longitude.toFixed(5)}
                </Text>
              </View>
            )}
            {log.media?.device_model && (
              <View style={styles.metaRow}>
                <Icon name="package" size={16} color={COLORS.textSecondary} />
                <Text style={styles.metaText}>
                  {[log.media.device_model, log.media.device_os].filter(Boolean).join(' - ')}
                </Text>
              </View>
            )}
          </View>

          {log.logType !== 'delivery' && (
            <>
              <View style={styles.sectionHeader}>
                <Icon name="qrCode" size={14} color={COLORS.textTertiary} />
                <Text style={styles.detailSectionLabel}>
                  {log.logType === 'release' ? 'Release QR Code' : 'Shipment QR Code'}
                </Text>
              </View>
              <SaveableQRCode value={log.qr_code} size={180} style={styles.qrCard} />

              {log.media?.storage_path && (
                <>
                  <View style={styles.sectionHeader}>
                    <Icon name="camera" size={14} color={COLORS.textTertiary} />
                    <Text style={styles.detailSectionLabel}>
                      {log.logType === 'release' ? 'Release Proof' : 'Shipment Proof'}
                    </Text>
                  </View>
                  {isPhotoLoading ? (
                    <ActivityIndicator
                      size="small"
                      color={COLORS.primary}
                      style={{ marginVertical: SPACING.md }}
                    />
                  ) : photoUrl ? (
                    <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" />
                  ) : (
                    <Text style={styles.emptyText}>Photo unavailable.</Text>
                  )}
                </>
              )}
            </>
          )}
        </ScrollView>
      </View>
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
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING['3xl'],
  },
  detailTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
  },
  detailSubtitle: {
    marginTop: 4,
    marginBottom: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textTertiary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  detailSectionLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textTertiary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  itemsCard: {
    borderWidth: 1,
    borderColor: '#ECEEF1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  itemRow: {
    padding: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#F4F5F7',
  },
  itemRowFirst: { borderTopWidth: 0 },
  itemName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textPrimary,
  },
  itemMeta: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  metaCard: {
    borderWidth: 1,
    borderColor: '#ECEEF1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  metaText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  qrCard: {
    marginBottom: SPACING.md,
    alignSelf: 'center',
  },
  photo: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
});
