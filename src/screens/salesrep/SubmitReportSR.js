// src/screens/salesrep/SubmitReportSR.js
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, ScrollView, Pressable, TextInput, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import Header from '../../components/common/Header';
import SubScreenSecondaryHeader from '../../components/common/SubScreenSecondaryHeader';
import Icon from '../../components/common/Icon';
import CameraCaptureModal from '../../components/common/CameraCaptureModal';
import useCachedFocusLoader from '../../hooks/useCachedFocusLoader';
import { TYPOGRAPHY } from '../../styles/typography';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import authService from '../../services/authService';
import reportService from '../../services/reportService';
import outboxService from '../../services/outboxService';
import { getConnectionStatus } from '../../services/connectionStatus';
import useOutbox from '../../hooks/useOutbox';
import { NEAR_EXPIRY_DAYS } from '../../constants/inventory';

function isNearExpiry(expDate) {
  if (!expDate) return false;
  const days = (new Date(expDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return days <= NEAR_EXPIRY_DAYS;
}

// discrepancy = (sold + return) - inCustody. 0 = none, negative = loss/missing,
// positive = over. Mirrors the server-side generated column exactly, for
// instant client-side feedback ahead of the authoritative submit.
function computeDiscrepancy(sold, ret, inCustody) {
  return (Number(sold) || 0) + (Number(ret) || 0) - inCustody;
}

// A failed fetch keeps the previous snapshot instead of blanking the screen —
// same pattern Dashboard/Stock/Backpack already use. Without this, opening
// Submit Report offline (even for the first time this session) showed "No
// in-custody stock to report today" instead of what was actually on hand.
const loadReportStatusData = async (previous) => {
  const currentAgent = await authService.getCurrentUser();
  const prev = previous?.agent?.id === currentAgent?.id ? previous : null;

  const result = await reportService.getMySrReportStatus(currentAgent?.id);

  return {
    agent: currentAgent,
    reportDate: result.success ? result.data.reportDate : prev?.reportDate ?? null,
    alreadySubmitted: result.success ? result.data.alreadySubmitted : prev?.alreadySubmitted ?? false,
    // The server derives this from where the agent's current stock actually
    // came from — nothing for the agent to pick. Shown as a read-only label
    // purely so a multi-branch agent knows which branch today's report is for.
    branchId: result.success ? result.data.branchId || null : prev?.branchId ?? null,
    branchName: result.success ? result.data.branchName || null : prev?.branchName ?? null,
    items: result.success ? result.data.items || [] : prev?.items ?? [],
  };
};

export default function SubmitReportSR() {
  const navigation = useNavigation();
  const { data: snapshot, isLoading } = useCachedFocusLoader('sales-rep-submit-report', loadReportStatusData);
  const agent = snapshot?.agent ?? null;
  const reportDate = snapshot?.reportDate ?? null;
  const alreadySubmitted = snapshot?.alreadySubmitted ?? false;
  const branchName = snapshot?.branchName ?? null;
  const items = snapshot?.items ?? [];

  const [figures, setFigures] = useState({}); // { [productCode]: { sold, returns } }
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoUri, setPhotoUri] = useState(null);
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [isViewingPhoto, setIsViewingPhoto] = useState(false);
  const { pendingCount, retryNow } = useOutbox('daily_report');

  // Figures are local, in-progress UI state, not part of the cached snapshot
  // — so this only resets them when the actual set of products changes (a
  // fresh day, or the first load), never on a same-items background refresh
  // that would otherwise silently wipe out whatever the SR is mid-typing.
  const itemsSignatureRef = useRef(null);
  useEffect(() => {
    const signature = items.map((item) => item.productCode).sort().join(',');
    if (signature === itemsSignatureRef.current) return;
    itemsSignatureRef.current = signature;
    const initialFigures = {};
    items.forEach((item) => {
      initialFigures[item.productCode] = { sold: '', returns: '' };
    });
    setFigures(initialFigures);
  }, [items]);

  const handleBack = () => navigation.goBack();

  const handleOpenCamera = () => {
    setIsViewingPhoto(false);
    setIsCameraVisible(true);
  };

  const handleViewPhoto = () => {
    setIsViewingPhoto(true);
    setIsCameraVisible(true);
  };

  const handleCloseCamera = () => setIsCameraVisible(false);

  const handleCaptured = (uri) => {
    setPhotoUri(uri);
    setIsCameraVisible(false);
  };

  // Clamped so sold+returns can never exceed what's actually in custody —
  // previously unbounded, so e.g. 40 sold + 20 return against 30 in custody
  // was accepted client-side and only ever caught (confusingly, as an
  // "Over" discrepancy) after the fact. The server now also rejects this
  // independently (defense in depth), but this stops it from being typeable
  // at all.
  const updateFigure = (productCode, field, value) => {
    const digitsOnly = value.replace(/[^0-9]/g, '');
    const inCustody = items.find((i) => i.productCode === productCode)?.inCustodyQuantity ?? 0;

    setFigures((prev) => {
      const current = prev[productCode] || { sold: '', returns: '' };
      const otherField = field === 'sold' ? 'returns' : 'sold';
      const otherValue = Number(current[otherField]) || 0;
      const maxForField = Math.max(inCustody - otherValue, 0);
      const clamped = digitsOnly === '' ? '' : String(Math.min(Number(digitsOnly), maxForField));

      return {
        ...prev,
        [productCode]: { ...current, [field]: clamped },
      };
    });
  };

  // selectTextOnFocus is unreliable on some Android/Gboard combos — tapping
  // into a field already at "0" doesn't always select it, so typing just
  // appends instead of replacing. Clearing explicitly on focus guarantees a
  // blank field (placeholder "0" showing) the moment you tap in, every time.
  const clearFigureOnFocus = (productCode, field) => {
    setFigures((prev) => {
      const current = prev[productCode] || { sold: '', returns: '' };
      if (current[field] !== '0') return prev;
      return { ...prev, [productCode]: { ...current, [field]: '' } };
    });
  };

  const totals = items.reduce(
    (acc, item) => {
      const f = figures[item.productCode] || {};
      acc.given += item.inCustodyQuantity;
      acc.sold += Number(f.sold) || 0;
      acc.returns += Number(f.returns) || 0;
      return acc;
    },
    { given: 0, sold: 0, returns: 0 }
  );

  const handleFinalize = async () => {
    if (items.length === 0) {
      Alert.alert('Nothing to Report', 'You have no in-custody stock to report today.');
      return;
    }
    if (!photoUri) {
      Alert.alert('Photo Required', 'Take a handover photo before submitting your daily report.');
      return;
    }

    setIsSubmitting(true);
    try {
      let coords = { latitude: null, longitude: null };
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const position = await Location.getCurrentPositionAsync({});
          coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        }
      } catch (locationError) {
        console.error('[ERROR] [SubmitReportSR] Location error:', locationError);
      }

      const reportItems = items.map((item) => {
        const f = figures[item.productCode] || {};
        return {
          productCode: item.productCode,
          soldQuantity: Number(f.sold) || 0,
          returnQuantity: Number(f.returns) || 0,
        };
      });

      const reportPayload = {
        agentId: agent?.id,
        latitude: coords.latitude,
        longitude: coords.longitude,
        deviceModel: Device.modelName || null,
        deviceOs: Device.osName || null,
        items: reportItems,
      };

      const discrepantCount = items.reduce((count, item) => {
        const f = figures[item.productCode] || {};
        const discrepancy = computeDiscrepancy(f.sold, f.returns, item.inCustodyQuantity);
        return discrepancy !== 0 ? count + 1 : count;
      }, 0);

      // Already known offline — don't even attempt the live call.
      if (!getConnectionStatus().online) {
        await outboxService.enqueue('daily_report', reportPayload, photoUri);
        Alert.alert(
          'Saved — Will Send Later',
          "You're offline. Your daily report and handover photo are saved on this device and will upload automatically once you're back online.",
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }

      try {
        const storagePath = await reportService.uploadDailyReportPhoto(photoUri, agent?.id);
        const result = await reportService.submitDailyReport({ ...reportPayload, storagePath });

        if (!result.success) {
          Alert.alert('Submit Failed', result.message || 'Could not submit your daily report.');
          return;
        }
      } catch (liveError) {
        // A failure that leaves us offline is a network problem, not a real
        // rejection — queue it instead of showing an error. Anything else
        // (still online) is a genuine failure, handled below as before.
        if (!getConnectionStatus().online) {
          await outboxService.enqueue('daily_report', reportPayload, photoUri);
          Alert.alert(
            'Saved — Will Send Later',
            "Connection dropped mid-submit. Your daily report and handover photo are saved on this device and will upload automatically once you're back online.",
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
          return;
        }
        throw liveError;
      }

      if (discrepantCount > 0) {
        Alert.alert(
          'Report Submitted — Discrepancy Found',
          `Your daily report has been sent to your manager for review. ${discrepantCount} item${discrepantCount === 1 ? '' : 's'} had a discrepancy — resolve it under Alerts/Discrepancies.`,
          [
            { text: 'Later', onPress: () => navigation.goBack(), style: 'cancel' },
            {
              text: 'Resolve Now',
              onPress: () => navigation.replace('AlertsDiscrepanciesSR'),
            },
          ]
        );
        return;
      }

      Alert.alert('Report Submitted', 'Your daily report has been sent to your manager for review.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Submit Failed', error.message || 'Could not upload your handover photo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <Header
          showBackButton
          title="Submit Report"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
          onBackPress={handleBack}
        />

        <SubScreenSecondaryHeader
          title={alreadySubmitted ? "Today's Report (Submitted)" : "Today's Report Summary"}
        />

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              {/* Only an SR assigned to more than one branch ever sees this —
                  informational only, derived automatically from which branch
                  their current stock came from, never something to pick. */}
              {branchName && agent?.branchIds?.length > 1 && (
                <View style={styles.branchRow}>
                  <Icon name="building" size={11} color="#555353" />
                  <Text style={styles.branchText}>Filing for {branchName}</Text>
                </View>
              )}

              {pendingCount > 0 && (
                <View style={styles.pendingBanner}>
                  <View style={styles.pendingIconCircle}>
                    <Icon name="clock" size={14} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pendingBannerTitle}>
                      Pending — {pendingCount} waiting to sync
                    </Text>
                    <Text style={styles.pendingBannerText}>
                      Saved on this device. Sends automatically once you're back online.
                    </Text>
                  </View>
                  <Pressable onPress={retryNow} style={styles.pendingRetryButton}>
                    <Text style={styles.pendingRetryText}>Retry</Text>
                  </Pressable>
                </View>
              )}

              {alreadySubmitted && (
                <View style={styles.submittedBanner}>
                  <View style={styles.submittedCheckCircle}>
                    <Icon name="check" size={15} color="#FFFFFF" weight="bold" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.submittedBannerTitle}>Report already submitted</Text>
                    <Text style={styles.submittedBannerText}>
                      You've already filed today's daily report. Come back tomorrow to submit the next one.
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <View style={styles.statTopRow}>
                    <View style={[styles.statIconWrap, { backgroundColor: '#EDEBFF' }]}>
                      <Icon name="package" size={16} color="#03045E" />
                    </View>
                    <Text style={styles.statValue}>{totals.given}</Text>
                  </View>
                  <Text style={styles.statLabel}>Given Stock</Text>
                </View>
                <View style={styles.statCard}>
                  <View style={styles.statTopRow}>
                    <View style={[styles.statIconWrap, { backgroundColor: '#EAFBF2' }]}>
                      <Icon name="checkCircle" size={16} color="#1E7A3A" />
                    </View>
                    <Text style={styles.statValue}>{totals.sold}</Text>
                  </View>
                  <Text style={styles.statLabel}>Sold Stocks</Text>
                </View>
                <View style={styles.statCard}>
                  <View style={styles.statTopRow}>
                    <View style={[styles.statIconWrap, { backgroundColor: '#E3F2FF' }]}>
                      <Icon name="returns" size={16} color="#0085F9" />
                    </View>
                    <Text style={styles.statValue}>{totals.returns}</Text>
                  </View>
                  <Text style={styles.statLabel}>Return</Text>
                </View>
              </View>

              {items.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Icon name="checkCircle" size={32} color={COLORS.textSecondary} />
                  <Text style={styles.emptyText}>No in-custody stock to report today.</Text>
                </View>
              ) : (
                <View style={styles.itemsList}>
                  {items.map((item) => {
                    const f = figures[item.productCode] || { sold: '', returns: '' };
                    const discrepancy = computeDiscrepancy(f.sold, f.returns, item.inCustodyQuantity);
                    const nearExpiry = (item.batches || []).some((b) => isNearExpiry(b.expDate));

                    return (
                      <View key={item.productCode} style={styles.itemCard}>
                        <View style={styles.itemTopRow}>
                          <View style={styles.thumbnailWrap}>
                            <View style={styles.thumbnail}>
                              <Icon name="package" size={26} color="#94a3b8" />
                            </View>
                            {nearExpiry && (
                              <View style={styles.nearExpiryTag}>
                                <Icon name="warningTriangle" size={9} color="#B26400" />
                                <Text style={styles.nearExpiryText}>Near Expiry Batch</Text>
                              </View>
                            )}
                          </View>

                          <View style={styles.itemDetails}>
                            <View style={styles.itemNameRow}>
                              <Text style={styles.itemCode} numberOfLines={1}>{item.productCode}</Text>
                              <View style={[styles.discBadge, discrepancy === 0 ? styles.discBadgeSuccess : styles.discBadgeError]}>
                                <Icon
                                  name={discrepancy === 0 ? 'checkCircle' : 'warningTriangle'}
                                  size={10}
                                  color={discrepancy === 0 ? '#1E7A3A' : '#B91C1C'}
                                />
                                <Text style={[styles.discBadgeText, discrepancy === 0 ? styles.discBadgeTextSuccess : styles.discBadgeTextError]}>
                                  {discrepancy === 0 ? 'Balanced' : `${Math.abs(discrepancy)} Missing`}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.itemFullName} numberOfLines={1}>{item.productName}</Text>
                            <View style={styles.itemMetaRow}>
                              <Icon name="trayDown" size={11} color="#555353" />
                              <Text style={styles.itemMeta}>In Custody: {item.inCustodyQuantity}</Text>
                            </View>
                          </View>
                        </View>

                        <View style={styles.figuresRow}>
                          <View style={styles.figureColumn}>
                            <View style={styles.figureLabelRow}>
                              <Icon name="checkCircle" size={11} color="#272632" />
                              <Text style={styles.figureLabel}>Sold</Text>
                            </View>
                            <TextInput
                              style={styles.figureInput}
                              value={f.sold}
                              onChangeText={(v) => updateFigure(item.productCode, 'sold', v)}
                              onFocus={() => clearFigureOnFocus(item.productCode, 'sold')}
                              keyboardType="number-pad"
                              placeholder="0"
                              placeholderTextColor="#B5C0CC"
                              textAlignVertical="center"
                              selectTextOnFocus
                              editable={!alreadySubmitted && !isSubmitting}
                            />
                          </View>
                          <View style={styles.figureColumn}>
                            <View style={styles.figureLabelRow}>
                              <Icon name="returns" size={11} color="#272632" />
                              <Text style={styles.figureLabel}>Returns</Text>
                            </View>
                            <TextInput
                              style={styles.figureInput}
                              value={f.returns}
                              onChangeText={(v) => updateFigure(item.productCode, 'returns', v)}
                              onFocus={() => clearFigureOnFocus(item.productCode, 'returns')}
                              keyboardType="number-pad"
                              placeholder="0"
                              placeholderTextColor="#B5C0CC"
                              textAlignVertical="center"
                              selectTextOnFocus
                              editable={!alreadySubmitted && !isSubmitting}
                            />
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {!alreadySubmitted && items.length > 0 && (
                <View style={styles.photoSection}>
                  <Text style={styles.listTitle}>Handover Photo</Text>
                  <Text style={styles.photoSectionHint}>
                    Required — a photo of your remaining stock on hand, taken at the time you file this report.
                  </Text>
                  <Pressable onPress={photoUri ? handleViewPhoto : handleOpenCamera}>
                    {photoUri ? (
                      <View style={styles.photoPreviewWrap}>
                        <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
                        <View style={styles.expandBadge}>
                          <Icon name="expand" size={14} color="#FFFFFF" />
                        </View>
                      </View>
                    ) : (
                      <View style={styles.photoPlaceholder}>
                        <Icon name="camera" size={36} color="#03045E" />
                        <Text style={styles.photoText}>Tap to capture proof</Text>
                      </View>
                    )}
                  </Pressable>
                </View>
              )}
            </ScrollView>

            {!alreadySubmitted && items.length > 0 && (
              <View style={styles.footer}>
                <Pressable
                  style={[styles.primaryButton, (isSubmitting || !photoUri) && styles.primaryButtonDisabled]}
                  onPress={handleFinalize}
                  disabled={isSubmitting || !photoUri}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      {photoUri ? 'Finalize & Submit Daily Report' : 'Take a Handover Photo First'}
                    </Text>
                  )}
                </Pressable>
              </View>
            )}
          </>
        )}

        <CameraCaptureModal
          visible={isCameraVisible}
          onClose={handleCloseCamera}
          onCapture={handleCaptured}
          initialUri={isViewingPhoto ? photoUri : null}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  submittedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#DFFBE9',
    borderWidth: 1,
    borderColor: '#B7FFD6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  submittedCheckCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submittedBannerTitle: {
    fontSize: 13,
    color: '#1D6A3A',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  submittedBannerText: {
    fontSize: 11,
    color: '#1D6A3A',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  photoSection: {
    marginTop: 4,
  },
  photoSectionHint: {
    fontSize: 11,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginBottom: 10,
  },
  listTitle: {
    color: '#272632',
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    marginBottom: 10,
  },
  photoPlaceholder: {
    borderWidth: 1.5,
    borderColor: '#D7E3F1',
    borderStyle: 'dashed',
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoText: {
    marginTop: 8,
    color: '#555353',
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  photoPreviewWrap: {
    position: 'relative',
    width: '100%',
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  expandBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(3,4,94,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  branchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 14,
  },
  branchText: {
    fontSize: 11,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF1D6',
    borderWidth: 1,
    borderColor: '#F2C94C',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  pendingIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#B26400',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingBannerTitle: {
    fontSize: 13,
    color: '#7A4A00',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  pendingBannerText: {
    fontSize: 11,
    color: '#7A4A00',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  pendingRetryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#B26400',
  },
  pendingRetryText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  statTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 18,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 6,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  itemsList: {
    gap: 16,
  },
  itemCard: {
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 8,
    padding: 12,
  },
  itemTopRow: {
    flexDirection: 'row',
  },
  thumbnailWrap: {
    marginRight: 12,
  },
  thumbnail: {
    width: 80,
    height: 90,
    borderRadius: 8,
    backgroundColor: '#F1F3F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearExpiryTag: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1D6',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 3,
    gap: 3,
  },
  nearExpiryText: {
    fontSize: 8,
    color: '#B26400',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  itemDetails: {
    flex: 1,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemCode: {
    flex: 1,
    fontSize: 15,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    marginRight: 8,
  },
  discBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  discBadgeSuccess: {
    backgroundColor: '#EAFBF2',
  },
  discBadgeError: {
    backgroundColor: '#FBDCDC',
  },
  discBadgeText: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  discBadgeTextSuccess: {
    color: '#1E7A3A',
  },
  discBadgeTextError: {
    color: '#B91C1C',
  },
  itemFullName: {
    fontSize: 12,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  itemMeta: {
    fontSize: 11,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  figuresRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  figureColumn: {
    flex: 1,
  },
  figureLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  figureLabel: {
    fontSize: 11,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  figureInput: {
    borderWidth: 1,
    borderColor: '#DBE4EE',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    height: 40,
    paddingVertical: 0,
    paddingHorizontal: 4,
    includeFontPadding: false,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 14,
    lineHeight: 18,
    color: '#03045E',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
  },
  primaryButton: {
    backgroundColor: '#03045E',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: '#B5BEC9',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
});
