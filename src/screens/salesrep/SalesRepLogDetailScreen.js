import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRoute } from '@react-navigation/native';
import UserAvatar from '../../components/common/UserAvatar';
import authService from '../../services/authService';
import { getDeliveryParties } from '../../services/presenceService';
import { getInitials } from '../../utils/initials';
import { cleanDeviceOs } from '../../utils/deviceInfo';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import SectionHeader from '../../components/common/SectionHeader';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import { formatDateTime } from '../../utils/formatters';
import Icon from '../../components/common/Icon';
import SaveableQRCode from '../../components/common/SaveableQRCode';
import ImageViewerModal from '../../components/common/ImageViewerModal';
import inventoryService from '../../services/inventoryService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const REQUEST_STATUS_META = {
  pending: { label: 'Pending', color: COLORS.accentGold },
  accepted: { label: 'Accepted', color: COLORS.success },
  declined: { label: 'Declined', color: COLORS.error },
};

// Sharp MFG / EXP chips, the same colours as on Receive Stock.
const DATE_TONE = { MFG: '#1E6FE0', EXP: '#D6336C' };
const imageFor = (item) => PRODUCT_CATALOG.find((p) => p.code === item.productCode || p.code === item.productName)?.image;

const REQUEST_TONE = {
  pending: { label: 'Pending', color: '#B26400', bg: '#FFF1D6' },
  accepted: { label: 'Accepted', color: '#1E7A3A', bg: '#EAFBF2' },
  declined: { label: 'Declined', color: '#B91C1C', bg: '#FBDCDC' },
};

const NOTE_BY_TYPE = {
  request: 'A saved record of the stock request you sent. It cannot be edited.',
  delivery: 'A saved record of a delivery that reached you. It cannot be edited.',
  accepted: 'A saved record of stock you accepted. It cannot be edited. Scan its QR code anytime to track the release.',
};

export default function SalesRepLogDetailScreen() {
  const route = useRoute();
  const log = route.params?.log;

  const [photoUrl, setPhotoUrl] = useState(null);
  const [isPhotoLoading, setIsPhotoLoading] = useState(false);
  const [isViewerVisible, setIsViewerVisible] = useState(false);
  // The Collector on a delivery, with their current profile photo (the saved log only has the name).
  const [parties, setParties] = useState(null);
  useEffect(() => {
    if (log?.logType !== 'delivery' || !log?.transactionId) return undefined;
    let active = true;
    authService.getCurrentUser().then((user) =>
      getDeliveryParties(user?.id, log.transactionId).then((result) => {
        if (active) setParties(result);
      })
    );
    return () => {
      active = false;
    };
  }, [log]);

  useEffect(() => {
    let isMounted = true;

    const loadPhoto = async () => {
      const storagePath = log?.media?.storagePath;
      if (!storagePath) return;
      setIsPhotoLoading(true);
      const url = await inventoryService.getShipmentPhotoUrl(storagePath);
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
    if (log.logType === 'request') {
      const meta = REQUEST_STATUS_META[log.status] || REQUEST_STATUS_META.pending;
      return `Stock Request — ${meta.label}`;
    }
    if (log.logType === 'delivery') {
      return `Delivery Arrived — ${log.collectorName || 'Collector'}`;
    }
    return log.releasedByName ? `Stock Accepted — ${log.releasedByName}` : 'Stock Accepted';
  };

  const requestTone = REQUEST_TONE[log.status] || REQUEST_TONE.pending;
  const tone =
    log.logType === 'request'
      ? requestTone
      : log.logType === 'delivery'
      ? { label: 'Delivered', color: '#4c9f70', bg: '#4c9f7020' }
      : { label: 'Accepted', color: '#0096C7', bg: '#CAF0F8' };

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
              <Text style={styles.pageSubtitle}>{formatDateTime(new Date(log.createdAt))}</Text>
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
          {log.logType === 'request' && log.status === 'declined' && log.declineReason && (
            <View style={styles.declineBanner}>
              <Icon name="warningTriangle" size={16} color={COLORS.error} />
              <Text style={styles.declineText}>{log.declineReason}</Text>
            </View>
          )}

          <SectionHeader icon="package" size="md" label={`Items (${(log.items || []).length})`} style={styles.labelFirst} />
          <View style={styles.itemsList}>
            {(log.items || []).map((item, index) => {
              const image = imageFor(item);
              return (
                <View key={`${item.productCode}-${index}`} style={styles.itemCard}>
                  <View style={styles.itemThumb}>
                    {image ? (
                      <Image source={image} style={styles.itemImage} resizeMode="contain" />
                    ) : (
                      <Icon name="package" size={22} color={COLORS.textSecondary} />
                    )}
                  </View>
                  <View style={styles.itemInfo}>
                    <View style={styles.itemTitleRow}>
                      <Text style={styles.itemName}>{item.productName}</Text>
                      <Text style={styles.itemQty}>Qty {item.quantity}</Text>
                    </View>
                    {(item.mfgDate || item.expDate) && (
                      <View style={styles.chipRow}>
                        {!!item.mfgDate && (
                          <View style={[styles.dateChip, { backgroundColor: DATE_TONE.MFG }]}>
                            <Text style={styles.dateChipLabel}>MFG</Text>
                            <Text style={styles.dateChipValue}>{new Date(item.mfgDate).toLocaleDateString()}</Text>
                          </View>
                        )}
                        {!!item.expDate && (
                          <View style={[styles.dateChip, { backgroundColor: DATE_TONE.EXP }]}>
                            <Text style={styles.dateChipLabel}>EXP</Text>
                            <Text style={styles.dateChipValue}>{new Date(item.expDate).toLocaleDateString()}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          <SectionHeader icon="clipboardText" size="md" label="Details" style={styles.labelSpaced} />
          <View style={styles.metaCard}>
            {(log.logType === 'request' ? log.latitude != null : log.gps) && (
              <View style={styles.metaRow}>
                <Icon name="location" size={16} color={COLORS.error} />
                <Text style={styles.metaText}>
                  {log.logType === 'request'
                    ? `${log.latitude.toFixed(5)}, ${log.longitude.toFixed(5)}`
                    : `${log.gps.latitude.toFixed(5)}, ${log.gps.longitude.toFixed(5)}`}
                </Text>
              </View>
            )}
            {log.branchName && (
              <View style={styles.metaRow}>
                <Icon name="building" size={16} color={COLORS.primary} />
                <Text style={styles.metaText}>{log.branchName}</Text>
              </View>
            )}
            {log.logType === 'delivery' && (
              <View style={styles.metaRow}>
                <UserAvatar
                  photoUrl={parties?.collector?.photoUrl || null}
                  size={32}
                  fallbackText={getInitials(log.collectorName || 'Collector')}
                  backgroundColor="#FFF1D6"
                  fallbackTextColor="#B26400"
                />
                <Text style={styles.metaText}>{log.collectorName || 'Collector'} (Collector)</Text>
              </View>
            )}
            {log.logType !== 'request' && log.logType !== 'delivery' && !!log.releasedByName && (
              <View style={styles.metaRow}>
                <UserAvatar
                  size={32}
                  fallbackText={getInitials(log.releasedByName)}
                  backgroundColor="#EAF4FF"
                  fallbackTextColor="#03045E"
                />
                <Text style={styles.metaText}>Released by {log.releasedByName}</Text>
              </View>
            )}
            {(log.logType === 'request' ? log.deviceModel : log.media?.deviceModel) && (
              <View style={styles.metaRow}>
                <Icon name="phone" size={16} color={COLORS.textSecondary} />
                <Text style={styles.metaText}>
                  {log.logType === 'request'
                    ? [log.deviceModel, cleanDeviceOs(log.deviceOs)].filter(Boolean).join(' · ')
                    : [log.media.deviceModel, cleanDeviceOs(log.media.deviceOs)].filter(Boolean).join(' · ')}
                </Text>
              </View>
            )}
          </View>

          {log.logType !== 'request' && log.logType !== 'delivery' && (
            <>
              <SectionHeader icon="qrCode" size="md" label="Release QR code" style={styles.labelSpaced} />
              <SaveableQRCode value={log.qrCode} size={156} compact style={styles.qrCard} />

              {log.media?.storagePath && (
                <>
                  <SectionHeader icon="camera" size="md" label="Acceptance proof" style={styles.labelSpaced} />
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
            <Text style={styles.noteText}>{NOTE_BY_TYPE[log.logType] || NOTE_BY_TYPE.accepted}</Text>
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
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING['3xl'],
  },
  titleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm, paddingHorizontal: SPACING.md },
  titleTextCol: { flexShrink: 1, flex: 1 },
  pageTitle: { fontSize: TYPOGRAPHY.fontSize.lg, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: TYPOGRAPHY.fontWeight.bold, color: '#272632' },
  pageSubtitle: { marginTop: 2, fontSize: TYPOGRAPHY.fontSize.xs, fontFamily: TYPOGRAPHY.fontFamily.regular, color: COLORS.textSecondary },
  typePill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  typePillText: { fontSize: 12, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  labelFirst: { marginTop: SPACING.sm, marginBottom: 0 },
  labelSpaced: { marginTop: SPACING.lg, marginBottom: 0 },
  itemsList: { gap: SPACING.sm, marginTop: SPACING.sm },
  itemCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.sm, borderRadius: 12, borderWidth: 1, borderColor: '#E5E5E5', backgroundColor: '#FFFFFF' },
  itemThumb: { width: 52, height: 52, borderRadius: 10, borderWidth: 1, borderColor: '#EEEEEE', alignItems: 'center', justifyContent: 'center', padding: 4 },
  itemImage: { width: '100%', height: '100%' },
  itemInfo: { flex: 1, gap: 6 },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  itemQty: { fontSize: TYPOGRAPHY.fontSize.sm, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.success },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dateChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 26, paddingHorizontal: 8, borderRadius: 0 },
  dateChipLabel: { fontSize: 11, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  dateChipValue: { fontSize: 12, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', color: '#FFFFFF' },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: SPACING.lg, paddingHorizontal: 4 },
  noteText: { flex: 1, fontSize: 11, lineHeight: 16, fontFamily: TYPOGRAPHY.fontFamily.regular, color: COLORS.textTertiary },
  declineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.error + '30',
    backgroundColor: COLORS.error + '0D',
    marginBottom: SPACING.md,
  },
  declineText: {
    flex: 1,
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.error,
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
    flexShrink: 1,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  itemMeta: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
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
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
