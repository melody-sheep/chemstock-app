// src/screens/salesrep/ReturnStocksSR.js
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../../components/common/Icon';
import CustomModal from '../../components/common/Modal';
import { TYPOGRAPHY } from '../../styles/typography';
import { COLORS } from '../../constants/colors';
import authService from '../../services/authService';
import reportService from '../../services/reportService';
import { supabase } from '../../services/supabaseClient';
import { formatRelativeTime } from '../../utils/formatters';

// Read-only status list of this SR's own return/resolve-discrepancy
// requests. The submission form itself lives on ResolveDiscrepancyScreen,
// reached only from a pending item on AlertsDiscrepanciesSR.
const STATUS_META = {
  pending: { label: 'Pending', bg: '#FFF1D6', text: '#B26400' },
  accepted: { label: 'Accepted', bg: '#EAFBF2', text: '#1E7A3A' },
  rejected: { label: 'Rejected', bg: '#FBDCDC', text: '#B91C1C' },
};

const SHIPMENT_BUCKET = 'shipment-media';

export default function ReturnStocksSR() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    const agent = await authService.getCurrentUser();
    const result = await reportService.getMyReturnRequests(agent?.id, 50);
    setRequests(result.success ? result.data : []);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [loadRequests])
  );

  const handleBack = () => navigation.goBack();

  const handleOpenRequest = async (request) => {
    setSelectedRequest(request);
    setPhotoUrl(null);
    if (request.media?.storagePath) {
      const { data } = await supabase.storage
        .from(SHIPMENT_BUCKET)
        .createSignedUrl(request.media.storagePath, 60 * 10);
      setPhotoUrl(data?.signedUrl || null);
    }
  };

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <View style={[styles.topBar, { height: 56 + insets.top, paddingTop: insets.top }]}>
          <Pressable onPress={handleBack} style={styles.iconButton}>
            <Icon name="arrowLeft" size={20} color="#FFFFFF" />
          </Pressable>

          <Text style={styles.topBarTitle}>Return Stocks</Text>

          <View style={styles.iconButton}>
            <Icon name="document" size={20} color="#FFFFFF" />
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : requests.length === 0 ? (
          <View style={styles.loadingWrap}>
            <Icon name="returnBox" size={32} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No return requests yet.</Text>
            <Text style={styles.emptySubtext}>
              Requests you send from a discrepancy alert will show up here.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {requests.map((request) => {
              const meta = STATUS_META[request.status] || STATUS_META.pending;

              return (
                <Pressable
                  key={request.resolutionRequestId}
                  style={styles.requestCard}
                  onPress={() => handleOpenRequest(request)}
                >
                  <View style={styles.requestTopRow}>
                    <View style={styles.thumbnail}>
                      <Icon name="package" size={24} color="#94a3b8" />
                    </View>

                    <View style={styles.requestDetails}>
                      <Text style={styles.requestCode} numberOfLines={1}>{request.productCode}</Text>
                      <Text style={styles.requestName} numberOfLines={1}>{request.productName}</Text>
                      <Text style={styles.requestMeta}>Sent {formatRelativeTime(request.createdAt)}</Text>
                    </View>

                    <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: meta.text }]}>{meta.label}</Text>
                    </View>
                  </View>

                  {request.status === 'rejected' && request.rejectReason && (
                    <Text style={styles.rejectReasonText}>Reason: {request.rejectReason}</Text>
                  )}
                </Pressable>
              );
            })}
            <View style={{ height: 24 }} />
          </ScrollView>
        )}
      </View>

      <CustomModal visible={!!selectedRequest} onClose={() => setSelectedRequest(null)} height={520}>
        {selectedRequest && (
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>{selectedRequest.productCode}</Text>
            <Text style={styles.modalSubtitle}>{selectedRequest.productName}</Text>

            <View style={styles.modalStatusRow}>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: (STATUS_META[selectedRequest.status] || STATUS_META.pending).bg },
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    { color: (STATUS_META[selectedRequest.status] || STATUS_META.pending).text },
                  ]}
                >
                  {(STATUS_META[selectedRequest.status] || STATUS_META.pending).label}
                </Text>
              </View>
              <Text style={styles.modalMeta}>Discrepancy: {Math.abs(selectedRequest.discrepancy)} units</Text>
            </View>

            {selectedRequest.status === 'rejected' && selectedRequest.rejectReason && (
              <Text style={styles.rejectReasonText}>Reason: {selectedRequest.rejectReason}</Text>
            )}

            {photoUrl && (
              <Image source={{ uri: photoUrl }} style={styles.modalPhoto} resizeMode="cover" />
            )}

            {selectedRequest.gps && (
              <Text style={styles.modalMeta}>
                GPS: {selectedRequest.gps.latitude.toFixed(4)}, {selectedRequest.gps.longitude.toFixed(4)}
              </Text>
            )}
          </ScrollView>
        )}
      </CustomModal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    height: 56,
    backgroundColor: '#03045E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  iconButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24 },
  emptyText: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  emptySubtext: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 12,
  },
  requestCard: {
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 14,
    padding: 12,
  },
  requestTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnail: {
    width: 52,
    height: 58,
    borderRadius: 10,
    backgroundColor: '#F1F3F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  requestDetails: {
    flex: 1,
  },
  requestCode: {
    fontSize: 14,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  requestName: {
    fontSize: 12,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  requestMeta: {
    fontSize: 11,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 4,
  },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusBadgeText: { fontSize: 10, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  rejectReasonText: {
    marginTop: 8,
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: '#B91C1C',
  },
  modalTitle: {
    fontSize: 17,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
    marginBottom: 14,
  },
  modalStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  modalMeta: {
    fontSize: 12,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 8,
  },
  modalPhoto: {
    width: '100%',
    height: 220,
    borderRadius: 14,
    marginTop: 12,
  },
});
