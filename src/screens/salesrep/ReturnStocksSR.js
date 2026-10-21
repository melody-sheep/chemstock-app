// src/screens/salesrep/ReturnStocksSR.js
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from '../../components/common/Icon';
import CustomModal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import useCachedFocusLoader from '../../hooks/useCachedFocusLoader';
import useOutbox from '../../hooks/useOutbox';
import { TYPOGRAPHY } from '../../styles/typography';
import { COLORS } from '../../constants/colors';
import authService from '../../services/authService';
import reportService from '../../services/reportService';
import { supabase } from '../../services/supabaseClient';
import * as FileSystem from 'expo-file-system/legacy';
import { formatRelativeTime } from '../../utils/formatters';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import Header from '../../components/common/Header';

// Read-only status list of this SR's own return/resolve-discrepancy
// requests. The submission form itself lives on ResolveDiscrepancyScreen,
// reached only from a pending item on AlertsDiscrepanciesSR.
const STATUS_META = {
  pending: { label: 'Pending', bg: '#FFF1D6', text: '#B26400' },
  accepted: { label: 'Accepted', bg: '#EAFBF2', text: '#1E7A3A' },
  rejected: { label: 'Rejected', bg: '#FBDCDC', text: '#B91C1C' },
  queued: { label: 'Pending', bg: '#E3F2FF', text: '#0085F9' },
};

const SHIPMENT_BUCKET = 'shipment-media';
// Return photos are saved on the phone once they've been fetched, so the picture shows even
// if the link has expired or the phone is offline later.
const PHOTO_DIR = `${FileSystem.cacheDirectory}return-photos/`;
const cachedPhotoFile = (storagePath) => `${PHOTO_DIR}${String(storagePath).replace(/[^a-zA-Z0-9.-]/g, '_')}`;

// A failed fetch keeps the previous snapshot instead of blanking the screen.
const loadReturnRequestsData = async (previous) => {
  const agent = await authService.getCurrentUser();
  const prev = previous?.agentId === agent?.id ? previous : null;
  const result = await reportService.getMyReturnRequests(agent?.id, 50);
  return {
    agentId: agent?.id,
    requests: result.success ? result.data : prev?.requests ?? [],
  };
};

export default function ReturnStocksSR() {
  const navigation = useNavigation();
  const route = useRoute();
  const { data: snapshot, isLoading, refreshControl } = useCachedFocusLoader('sales-rep-return-requests', loadReturnRequestsData);
  // Requests sent while offline show first, as pending, until they sync.
  const { pending: queuedReturns } = useOutbox('discrepancy_resolution', snapshot?.agentId ?? null);
  const queuedRequests = queuedReturns.map((entry) => ({
    resolutionRequestId: `queued-${entry.id}`,
    productCode: entry.display?.productCode || 'Return request',
    productName: entry.display?.productName || '',
    createdAt: new Date(entry.createdAt).toISOString(),
    status: 'queued',
    isQueued: true,
  }));
  const requests = [...queuedRequests, ...(snapshot?.requests ?? [])];
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  // idle: no photo on this return, loading, ready, or error (couldn't be fetched / shown).
  const [photoState, setPhotoState] = useState('idle');
  const [photoNote, setPhotoNote] = useState('');


  // Tapped from a notification: open that return's details (same as tapping its card).
  const focusId = route.params?.focusId || null;
  const openedFocusIdRef = useRef(null);
  useEffect(() => {
    if (!focusId || isLoading || openedFocusIdRef.current === focusId) return;
    const match = requests.find((r) => r.resolutionRequestId === focusId);
    if (match) {
      openedFocusIdRef.current = focusId;
      handleOpenRequest(match);
    }
  }, [focusId, isLoading, requests]);

  const handleOpenRequest = async (request) => {
    setSelectedRequest(request);
    setPhotoUrl(null);
    setPhotoNote('');
    const storagePath = request.media?.storagePath;
    if (!storagePath) {
      setPhotoState('idle');
      return;
    }
    setPhotoState('loading');
    const cachedFile = cachedPhotoFile(storagePath);
    try {
      // Already fetched before: show the saved copy straight away.
      const info = await FileSystem.getInfoAsync(cachedFile);
      if (info.exists && info.size > 0) {
        setPhotoUrl(cachedFile);
        return;
      }
      const { data } = await supabase.storage
        .from(SHIPMENT_BUCKET)
        .createSignedUrl(storagePath, 60 * 10);
      if (!data?.signedUrl) {
        setPhotoNote('No access link for this photo.');
        setPhotoState('error');
        return;
      }
      // Download it to the phone first: a bad answer from the server (not found, no access)
      // is caught here and named, instead of the picture just staying blank.
      try {
        await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true }).catch(() => {});
        const result = await FileSystem.downloadAsync(data.signedUrl, cachedFile);
        if (result.status === 200) {
          setPhotoUrl(result.uri);
        } else {
          await FileSystem.deleteAsync(cachedFile, { idempotent: true }).catch(() => {});
          setPhotoNote(result.status === 400 || result.status === 404 ? 'The photo file was not found.' : `The server answered ${result.status}.`);
          setPhotoState('error');
        }
      } catch (downloadError) {
        // Couldn't save it: still try the live link directly.
        setPhotoUrl(data.signedUrl);
      }
    } catch (error) {
      setPhotoNote('Check your connection.');
      setPhotoState('error');
    }
  };

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <Header
          showBackButton
          title="Return Stocks"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          showDocumentIcon
          onDocumentPress={() => navigation.navigate('SalesRepLogs')}
        />

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : requests.length === 0 ? (
          <View style={styles.loadingWrap}>
            <Icon name="returns" size={32} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No return requests yet.</Text>
            <Text style={styles.emptySubtext}>
              Requests you send from a discrepancy alert will show up here.
            </Text>
          </View>
        ) : (
          <ScrollView
          refreshControl={refreshControl} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {requests.map((request) => {
              const meta = STATUS_META[request.status] || STATUS_META.pending;

              return (
                <Pressable
                  key={request.resolutionRequestId}
                  style={styles.requestCard}
                  onPress={() => !request.isQueued && handleOpenRequest(request)}
                >
                  <View style={styles.requestTopRow}>
                    <View style={styles.thumbnail}>
                      {PRODUCT_CATALOG.find((p) => p.code === request.productCode)?.image ? (
                        <Image
                          source={PRODUCT_CATALOG.find((p) => p.code === request.productCode).image}
                          style={styles.thumbnailImage}
                        />
                      ) : (
                        <Icon name="package" size={24} color="#94a3b8" />
                      )}
                    </View>

                    <View style={styles.requestDetails}>
                      <Text style={styles.requestCode} numberOfLines={1}>{request.productCode}</Text>
                      {!!request.productName && request.productName !== request.productCode && (
                        <Text style={styles.requestName} numberOfLines={1}>{request.productName}</Text>
                      )}
                      <Text style={styles.requestMeta}>
                        {request.discrepancy ? `${Math.abs(request.discrepancy)} units · ` : ''}Sent {formatRelativeTime(request.createdAt)}
                      </Text>
                    </View>

                    <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: meta.text }]}>{meta.label}</Text>
                    </View>
                    {!request.isQueued && <Icon name="arrowRight" size={14} color="#94a3b8" />}
                  </View>

                  {request.isQueued && (
                    <Text style={styles.queuedNote}>Waiting for connection — sends automatically once you're online.</Text>
                  )}

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

      <CustomModal visible={!!selectedRequest} onClose={() => setSelectedRequest(null)} height="auto" maxHeight={680}>
        {selectedRequest && (() => {
          const meta = STATUS_META[selectedRequest.status] || STATUS_META.pending;
          const image = PRODUCT_CATALOG.find((p) => p.code === selectedRequest.productCode)?.image;
          return (
            <>
              <View style={styles.sheetHandle} />
              <ScrollView showsVerticalScrollIndicator={false} style={styles.sheetScroll}>
                <View style={styles.sheetHeader}>
                  <View style={styles.sheetThumb}>
                    {image ? (
                      <Image source={image} style={styles.sheetThumbImage} resizeMode="contain" />
                    ) : (
                      <Icon name="package" size={26} color="#94a3b8" />
                    )}
                  </View>
                  <View style={styles.sheetHeaderText}>
                    <Text style={styles.modalTitle}>{selectedRequest.productCode}</Text>
                    {!!selectedRequest.productName && selectedRequest.productName !== selectedRequest.productCode && (
                      <Text style={styles.modalSubtitle}>{selectedRequest.productName}</Text>
                    )}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: meta.text }]}>{meta.label}</Text>
                  </View>
                </View>

                <View style={styles.unitsBox}>
                  <Text style={styles.unitsLabel}>Units in this return</Text>
                  <Text style={styles.unitsValue}>{Math.abs(selectedRequest.discrepancy)}</Text>
                </View>

                {selectedRequest.status === 'rejected' && selectedRequest.rejectReason && (
                  <View style={styles.rejectNote}>
                    <Icon name="warningTriangle" size={16} color="#B91C1C" />
                    <Text style={styles.rejectNoteText}>{selectedRequest.rejectReason}</Text>
                  </View>
                )}

                {photoState !== 'idle' && (
                  <>
                    <Text style={styles.sheetLabel}>RETURN PHOTO</Text>
                    {photoState === 'error' ? (
                      <Pressable
                        style={styles.photoBox}
                        onPress={() => handleOpenRequest(selectedRequest)}
                        accessibilityRole="button"
                        accessibilityLabel="Retry loading the photo"
                      >
                        <Icon name="camera" size={26} color="#94a3b8" />
                        <Text style={styles.photoErrorTitle}>Photo couldn't load</Text>
                        <Text style={styles.photoErrorHint}>{photoNote ? `${photoNote} Tap to try again.` : 'Tap to try again.'}</Text>
                      </Pressable>
                    ) : (
                      <View style={styles.photoBox}>
                        {photoUrl && (
                          <Image
                            source={{ uri: photoUrl }}
                            style={styles.modalPhoto}
                            resizeMode="cover"
                            onLoad={() => setPhotoState('ready')}
                            onError={() => setPhotoState('error')}
                          />
                        )}
                        {photoState === 'loading' && <ActivityIndicator style={styles.photoSpinner} color={COLORS.primary} />}
                      </View>
                    )}
                  </>
                )}

                <Text style={styles.sheetLabel}>DETAILS</Text>
                <View style={styles.detailsCard}>
                  <View style={styles.detailRow}>
                    <Icon name="clock" size={16} color={COLORS.textSecondary} />
                    <Text style={styles.detailLabel}>Sent</Text>
                    <Text style={styles.detailValue}>{formatRelativeTime(selectedRequest.createdAt)}</Text>
                  </View>
                  {!!selectedRequest.gps && (
                    <View style={styles.detailRow}>
                      <Icon name="location" size={16} color={COLORS.error} />
                      <Text style={styles.detailLabel}>Location</Text>
                      <Text style={styles.detailValue}>
                        {Number(selectedRequest.gps.latitude).toFixed(4)}, {Number(selectedRequest.gps.longitude).toFixed(4)}
                      </Text>
                    </View>
                  )}
                </View>
              </ScrollView>

              <Button
                title="Close"
                variant="outline"
                onPress={() => setSelectedRequest(null)}
                hasShadow={false}
                height={48}
                fontSize={16}
                borderRadius={24}
                width="100%"
                style={styles.closeButton}
              />
            </>
          );
        })()}
      </CustomModal>
    </>
  );
}

const styles = StyleSheet.create({
  sheetHandle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#DADDE3', marginTop: -8, marginBottom: 14 },
  sheetScroll: { flexShrink: 1 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetThumb: { width: 56, height: 56, borderRadius: 12, borderWidth: 1, borderColor: '#E5E5E5', alignItems: 'center', justifyContent: 'center', padding: 4 },
  sheetThumbImage: { width: '100%', height: '100%' },
  sheetHeaderText: { flex: 1 },
  unitsBox: { marginTop: 14, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: '#F5F6F9' },
  unitsLabel: { fontSize: 12, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.regular },
  unitsValue: { marginTop: 2, fontSize: 20, color: '#272632', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  rejectNote: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 10, backgroundColor: '#FDECEC' },
  rejectNoteText: { flex: 1, fontSize: 14, color: '#B91C1C', fontFamily: TYPOGRAPHY.fontFamily.medium },
  sheetLabel: { marginTop: 18, marginBottom: 8, fontSize: 12, letterSpacing: 0.8, color: '#6B7280', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  detailsCard: { borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  detailLabel: { fontSize: 14, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.regular },
  detailValue: { flex: 1, textAlign: 'right', fontSize: 14, color: '#272632', fontFamily: TYPOGRAPHY.fontFamily.semibold, fontWeight: '600' },
  closeButton: { marginTop: 14 },
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
  thumbnailImage: {
    width: '70%',
    height: '70%',
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
    fontSize: 12,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 4,
  },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginRight: 6 },
  photoBox: { height: 190, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F1F3F6', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 16 },
  photoSpinner: { position: 'absolute' },
  photoErrorTitle: { fontSize: 14, color: '#272632', fontFamily: TYPOGRAPHY.fontFamily.semibold, fontWeight: '600' },
  photoErrorHint: { fontSize: 12, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.regular, textAlign: 'center' },
  statusBadgeText: { fontSize: 11, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  rejectReasonText: {
    marginTop: 8,
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: '#B91C1C',
  },
  queuedNote: {
    marginTop: 8,
    fontSize: 12,
    color: '#0085F9',
    fontFamily: TYPOGRAPHY.fontFamily.medium,
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
  modalPhoto: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
