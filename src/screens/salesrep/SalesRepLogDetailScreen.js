import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRoute } from '@react-navigation/native';
import Header from '../../components/common/Header';
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

export default function SalesRepLogDetailScreen() {
  const route = useRoute();
  const log = route.params?.log;

  const [photoUrl, setPhotoUrl] = useState(null);
  const [isPhotoLoading, setIsPhotoLoading] = useState(false);
  const [isViewerVisible, setIsViewerVisible] = useState(false);

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

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.detailTitle}>{getTitle()}</Text>
          <Text style={styles.detailSubtitle}>
            {new Date(log.createdAt).toLocaleString()}
          </Text>

          {log.logType === 'request' && log.status === 'declined' && log.declineReason && (
            <View style={styles.declineBanner}>
              <Icon name="warningTriangle" size={16} color={COLORS.error} />
              <Text style={styles.declineText}>{log.declineReason}</Text>
            </View>
          )}

          <View style={styles.sectionHeader}>
            <Icon name="package" size={14} color={COLORS.textTertiary} />
            <Text style={styles.detailSectionLabel}>Items</Text>
          </View>
          <View style={styles.itemsCard}>
            {(log.items || []).map((item, index) => (
              <View
                key={`${item.productCode}-${index}`}
                style={[styles.itemRow, index === 0 && styles.itemRowFirst]}
              >
                <Text style={styles.itemName}>{item.productName}</Text>
                <Text style={styles.itemMeta}>
                  Qty: {item.quantity}
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
                <Icon name="person" size={16} color={COLORS.primary} />
                <Text style={styles.metaText}>{log.collectorName || 'Collector'} (Collector)</Text>
              </View>
            )}
            {(log.logType === 'request' ? log.deviceModel : log.media?.deviceModel) && (
              <View style={styles.metaRow}>
                <Icon name="package" size={16} color={COLORS.textSecondary} />
                <Text style={styles.metaText}>
                  {log.logType === 'request'
                    ? [log.deviceModel, log.deviceOs].filter(Boolean).join(' - ')
                    : [log.media.deviceModel, log.media.deviceOs].filter(Boolean).join(' - ')}
                </Text>
              </View>
            )}
          </View>

          {log.logType !== 'request' && log.logType !== 'delivery' && (
            <>
              <View style={styles.sectionHeader}>
                <Icon name="qrCode" size={14} color={COLORS.textTertiary} />
                <Text style={styles.detailSectionLabel}>Release QR Code</Text>
              </View>
              <SaveableQRCode value={log.qrCode} size={180} style={styles.qrCard} />

              {log.media?.storagePath && (
                <>
                  <View style={styles.sectionHeader}>
                    <Icon name="camera" size={14} color={COLORS.textTertiary} />
                    <Text style={styles.detailSectionLabel}>Acceptance Proof</Text>
                  </View>
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
  },
  photoWrap: {
    width: '100%',
    height: 180,
    borderRadius: 8,
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
