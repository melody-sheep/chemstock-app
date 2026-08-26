// src/screens/manager/ReturnStockVerifyScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, TextInput, Alert, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import Icon from '../../components/common/Icon';
import CustomModal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import reportService from '../../services/reportService';
import { supabase } from '../../services/supabaseClient';
import { formatDisplayDate, formatDateTime } from '../../utils/formatters';

const SHIPMENT_BUCKET = 'shipment-media';

export default function ReturnStockVerifyScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const returnRequest = route.params?.returnRequest;

  const [photoUrl, setPhotoUrl] = useState(null);
  const [isRejectModalVisible, setIsRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadPhoto() {
      if (!returnRequest?.media?.storagePath) return;
      const { data } = await supabase.storage
        .from(SHIPMENT_BUCKET)
        .createSignedUrl(returnRequest.media.storagePath, 60 * 10);
      if (!cancelled) setPhotoUrl(data?.signedUrl || null);
    }
    loadPhoto();
    return () => {
      cancelled = true;
    };
  }, [returnRequest?.media?.storagePath]);

  if (!returnRequest) {
    return (
      <View style={styles.container}>
        <Header
          showBackButton
          backButtonText="Reports & Returns"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
        />
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>This return request could not be loaded.</Text>
        </View>
      </View>
    );
  }

  const handleApprove = () => {
    Alert.alert(
      'Approve Return',
      `This will restock ${Math.abs(returnRequest.discrepancy)} unit(s) of ${returnRequest.productCode} into branch inventory.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setIsSubmitting(true);
            const result = await reportService.acceptDiscrepancyResolution(returnRequest.resolutionRequestId);
            setIsSubmitting(false);
            if (!result.success) {
              Alert.alert('Failed', result.message || 'Could not approve this return.');
              return;
            }
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleReject = async () => {
    setIsSubmitting(true);
    const result = await reportService.rejectDiscrepancyResolution(
      returnRequest.resolutionRequestId,
      rejectReason.trim() || null
    );
    setIsSubmitting(false);
    setIsRejectModalVisible(false);
    if (!result.success) {
      Alert.alert('Failed', result.message || 'Could not reject this return.');
      return;
    }
    navigation.goBack();
  };

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton
          backButtonText="Reports & Returns"
          showDocumentIcon
          onDocumentPress={() => navigation.navigate('StockLogs')}
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
        />

        <SecondaryHeader height={72}>
          <View style={styles.verificationHeader}>
            <View style={styles.verificationTitleRow}>
              <Text style={styles.verificationTitle}>Active Verification:</Text>
              <View style={styles.onlinePill}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>Online</Text>
              </View>
            </View>
            <Text style={styles.verificationLine}>
              <Text style={styles.verificationLabel}>Sales Rep: </Text>
              {returnRequest.agentName}
            </Text>
            <Text style={styles.verificationLine}>
              <Text style={styles.verificationLabel}>Report Date: </Text>
              {formatDisplayDate(returnRequest.reportDate)}
            </Text>
          </View>
        </SecondaryHeader>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Discrepancy Detail</Text>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: returnRequest.discrepancy < 0 ? '#EF4444' : '#B26400' },
              ]}
            />
          </View>

          <View style={styles.itemCard}>
            <View style={styles.thumbnail}>
              <Icon name="package" size={24} color="#94a3b8" />
            </View>

            <View style={styles.itemDetails}>
              <Text style={styles.itemCode} numberOfLines={1}>{returnRequest.productCode}</Text>
              <Text style={styles.itemFullName} numberOfLines={1}>{returnRequest.productName}</Text>
            </View>

            <View style={[styles.qtyBadge, returnRequest.discrepancy < 0 ? styles.qtyBadgeDamaged : styles.qtyBadgeGood]}>
              <Text style={[styles.qtyBadgeText, returnRequest.discrepancy < 0 ? styles.qtyBadgeTextDamaged : styles.qtyBadgeTextGood]}>
                {Math.abs(returnRequest.discrepancy)}
              </Text>
            </View>
          </View>

          <Text style={[styles.listTitle, styles.sectionSpacing]}>Photo Proof</Text>
          <View style={styles.photoCard}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.photoLarge} resizeMode="cover" />
            ) : (
              <View style={styles.thumbnailLarge}>
                <Icon name="package" size={40} color="#D8DEE8" />
              </View>
            )}
          </View>

          <View style={styles.locationCard}>
            {returnRequest.gps && (
              <View style={styles.locationRow}>
                <View style={styles.locationLeft}>
                  <Icon name="location" size={18} color="#F04D59" />
                  <Text style={styles.detailLabel}>GPS</Text>
                </View>
                <Text style={styles.detailValue}>
                  {returnRequest.gps.latitude.toFixed(4)}°, {returnRequest.gps.longitude.toFixed(4)}°
                </Text>
              </View>
            )}
            {returnRequest.media?.deviceModel && (
              <View style={styles.locationRow}>
                <View style={styles.locationLeft}>
                  <Icon name="moreVertical" size={18} color="#00B4D8" />
                  <Text style={styles.detailLabel}>Device</Text>
                </View>
                <Text style={styles.detailValue}>{returnRequest.media.deviceModel}</Text>
              </View>
            )}
            <View style={[styles.locationRow, styles.lastLocationRow]}>
              <View style={styles.locationLeft}>
                <Icon name="clock" size={18} color="#00B4D8" />
                <Text style={styles.detailLabel}>Requested</Text>
              </View>
              <Text style={styles.detailValue}>{formatDateTime(new Date(returnRequest.createdAt))}</Text>
            </View>
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <Pressable
              style={[styles.rejectButton, isSubmitting && styles.buttonDisabled]}
              onPress={() => setIsRejectModalVisible(true)}
              disabled={isSubmitting}
            >
              <Text style={styles.rejectButtonText}>Reject</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
              onPress={handleApprove}
              disabled={isSubmitting}
            >
              <Text style={styles.primaryButtonText}>Approve Return</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <CustomModal visible={isRejectModalVisible} onClose={() => setIsRejectModalVisible(false)} height={320}>
        <Text style={styles.modalTitle}>Reject Return Request</Text>
        <Text style={styles.modalSubtitle}>
          Optionally let {returnRequest.agentName} know why — they can resubmit after this.
        </Text>
        <TextInput
          style={styles.reasonInput}
          placeholder="Reason (optional)"
          value={rejectReason}
          onChangeText={setRejectReason}
          multiline
        />
        <Button title="Confirm Reject" variant="black" onPress={handleReject} disabled={isSubmitting} style={{ marginTop: SPACING.md }} />
      </CustomModal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  verificationHeader: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  verificationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  verificationTitle: {
    fontSize: 15,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' },
  onlineText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.success,
  },
  verificationLine: {
    fontSize: 12,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 4,
  },
  verificationLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    color: '#272632',
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionSpacing: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 15,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#F1F3F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemDetails: {
    flex: 1,
  },
  itemCode: {
    fontSize: 14,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  itemFullName: {
    fontSize: 11,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  qtyBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBadgeGood: {
    backgroundColor: '#EAFBF2',
  },
  qtyBadgeDamaged: {
    backgroundColor: '#FBDCDC',
  },
  qtyBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  qtyBadgeTextGood: {
    color: '#1E7A3A',
  },
  qtyBadgeTextDamaged: {
    color: '#B91C1C',
  },
  listTitle: {
    color: '#272632',
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    marginBottom: 10,
  },
  photoCard: {
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 16,
    padding: 12,
  },
  thumbnailLarge: {
    height: 140,
    borderRadius: 12,
    backgroundColor: '#F1F3F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoLarge: {
    width: '100%',
    height: 220,
    borderRadius: 12,
  },
  locationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAEFF5',
    paddingHorizontal: 12,
    marginTop: 16,
  },
  locationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  lastLocationRow: {
    borderBottomWidth: 0,
  },
  locationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    color: '#555353',
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  detailValue: {
    color: '#272632',
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#03045E',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#EF4444',
  },
  rejectButtonText: {
    color: '#B91C1C',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  modalTitle: {
    fontSize: 17,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 4,
    marginBottom: 14,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#DBE4EE',
    borderRadius: 12,
    padding: 12,
    minHeight: 90,
    textAlignVertical: 'top',
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: '#272632',
  },
});
