// src/screens/salesrep/SubmitReportSR.js
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Pressable, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import Alert from '../../utils/appAlert';
import { StatusBar } from 'expo-status-bar';
import { BlurTargetView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import Header from '../../components/common/Header';
import SubScreenSecondaryHeader from '../../components/common/SubScreenSecondaryHeader';
import Icon from '../../components/common/Icon';
import OutboxFailedNotice from '../../components/common/OutboxFailedNotice';
import Button from '../../components/common/Button';
import BottomActionBar, { useBottomActionBarHeight } from '../../components/common/BottomActionBar';
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
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import { getQuickPosition } from '../../utils/quickLocation';
import { getQueuedReceipts } from '../../utils/queuedReceipts';
import friendlyError from '../../utils/friendlyError';
import KeyboardAwareScrollView from '../../components/common/KeyboardAwareScrollView';
import { getDeviceOs } from '../../utils/deviceInfo';

function isNearExpiry(expDate) {
  if (!expDate) return false;
  const days = (new Date(expDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return days <= NEAR_EXPIRY_DAYS;
}

// discrepancy = (sold + return) - inCustody. A negative value is the
// unreported balance that stays in the backpack and carries forward.
function computeDiscrepancy(sold, ret, inCustody) {
  return (Number(sold) || 0) + (Number(ret) || 0) - inCustody;
}

// A failed fetch keeps the previous snapshot instead of blanking the screen —
// same pattern Dashboard/Stock/Backpack already use. Without this, opening
// Submit Report offline (even for the first time this session) showed "No
// in-custody stock to report today" instead of what was actually on hand.
export const loadReportStatusData = async (previous) => {
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

/**
 * Sold / Returned box. Android's own centring (textAlign: 'center') moves the
 * cursor between the middle and the right edge whenever the box is emptied,
 * so the box centres a small input that grows with the digits instead: the
 * cursor always sits right after the number. Tapping anywhere on the box
 * focuses it. Autofill is off — Android offered saved phone numbers here.
 */
function FigureInput({ value, onChangeText, onFocus, onBlur, focused, editable }) {
  const inputRef = useRef(null);
  return (
    <Pressable
      style={[styles.figureInput, focused && styles.figureInputFocused]}
      onPress={() => inputRef.current?.focus()}
      disabled={!editable}
    >
      <TextInput
        ref={inputRef}
        style={styles.figureInputText}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        keyboardType="number-pad"
        placeholder={focused ? '' : '0'}
        placeholderTextColor="#B5C0CC"
        autoComplete="off"
        importantForAutofill="no"
        autoCorrect={false}
        contextMenuHidden
        selectTextOnFocus
        maxLength={5}
        editable={editable}
      />
    </Pressable>
  );
}

// Reports are one per day, and the day changes at midnight in the Philippines (UTC+8).
const msUntilNextReportDay = () => {
  const DAY = 24 * 60 * 60 * 1000;
  return DAY - ((Date.now() + 8 * 60 * 60 * 1000) % DAY);
};
const formatWait = (ms) => {
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
};

export default function SubmitReportSR() {
  const navigation = useNavigation();
  const blurTarget = useRef(null);
  const bottomActionBarHeight = useBottomActionBarHeight();
  const { data: snapshot, isLoading, refreshControl } = useCachedFocusLoader('sales-rep-submit-report', loadReportStatusData);
  const agent = snapshot?.agent ?? null;
  const reportDate = snapshot?.reportDate ?? null;
  const [msToNextReport, setMsToNextReport] = useState(msUntilNextReportDay());
  useEffect(() => {
    const timer = setInterval(() => setMsToNextReport(msUntilNextReportDay()), 30000);
    return () => clearInterval(timer);
  }, []);
  const alreadySubmitted = snapshot?.alreadySubmitted ?? false;
  const branchName = snapshot?.branchName ?? null;
  const items = snapshot?.items ?? [];

  const [figures, setFigures] = useState({}); // { [productCode]: { sold, returns } }
  // Which figure box has the keyboard, as "CODE:field". Display only: the "0"
  // hint is hidden while a box is focused, otherwise Android parks the cursor
  // at the far edge of an empty, centred box instead of in the middle.
  const [focusedField, setFocusedField] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoUri, setPhotoUri] = useState(null);
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [isViewingPhoto, setIsViewingPhoto] = useState(false);
  const { pending: pendingReports, pendingCount, failed: failedItems, retryNow, discard } = useOutbox('daily_report', agent?.id ?? null);
  // A report saved offline counts as today's report too: without this the form
  // came back right after saving, and a second report for the same day would
  // be rejected by the server (one report per agent per day).
  const hasQueuedReport = pendingReports.some((entry) => entry.payload?.agentId === agent?.id);
  // Stock received but not synced yet isn't the agent's on the server, so it
  // isn't in today's figures. The report is still allowed (a late Collector
  // must not get the Sales Rep's day auto-filed as missing); that stock goes
  // into the next report once it syncs. Decision: Alther, Oct 18.
  const { pending: allPendingEntries } = useOutbox();
  const queuedReceiptCount = getQueuedReceipts(allPendingEntries, agent?.id).length;
  const isReportLocked = alreadySubmitted || hasQueuedReport;

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
      Alert.alert('Nothing to Report', 'You have no stock with you to report today.');
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
          // Location is optional on a daily report. An unbounded GPS wait made
          // an offline submit take 15–20 s; this gives up after 4 s.
          const position = await getQuickPosition({ timeoutMs: 4000 });
          if (position) coords = position;
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
        deviceOs: getDeviceOs() || null,
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
          Alert.alert('Submit Failed', friendlyError(result.message) || 'Could not submit your daily report.');
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
            { text: 'Later', onPress: () => navigation.goBack(), style: 'cancel', accent: '#D92D3A' },
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
      Alert.alert('Submit Failed', friendlyError(error.message) || 'Could not upload your handover photo.');
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
          showDocumentIcon
          onDocumentPress={() => navigation.navigate('SalesRepLogs')}
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
            <BlurTargetView ref={blurTarget} style={styles.contentTarget}>
            <KeyboardAwareScrollView
          refreshControl={refreshControl} contentContainerStyle={[styles.content, !isReportLocked && items.length > 0 && { paddingBottom: bottomActionBarHeight + SPACING.lg }]} showsVerticalScrollIndicator={false}>
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
                      Pending — {pendingCount} waiting to send
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

              <OutboxFailedNotice failed={failedItems} agentId={agent?.id} onRetry={retryNow} onDiscard={discard} />

              {queuedReceiptCount > 0 && !alreadySubmitted && (
                <View style={styles.pendingBanner}>
                  <View style={styles.pendingIconCircle}>
                    <Icon name="clock" size={14} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pendingBannerTitle}>
                      {queuedReceiptCount === 1 ? '1 receipt' : `${queuedReceiptCount} receipts`} waiting to send
                    </Text>
                    <Text style={styles.pendingBannerText}>
                      It isn't in today's figures. You can still file today's report — that stock will be in your next report once it syncs.
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
                    <View style={styles.countdownPill}>
                      <Icon name="clock" size={14} color="#1E7A3A" />
                      <Text style={styles.countdownText}>Next report opens in {formatWait(msToNextReport)}, at midnight</Text>
                    </View>
                    <Pressable
                      onPress={() => navigation.navigate('SalesRepReports', { openToday: true })}
                      style={styles.viewReportButton}
                      accessibilityRole="button"
                    >
                      <Text style={styles.viewReportText}>View submitted report</Text>
                      <Icon name="arrowRight" size={14} color="#1E7A3A" />
                    </Pressable>
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
                  <Text style={styles.statLabel}>Returned</Text>
                </View>
              </View>

              {items.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Icon name="checkCircle" size={32} color={COLORS.textSecondary} />
                  <Text style={styles.emptyText}>
                    {queuedReceiptCount > 0
                      ? 'Nothing to report yet — the stock you received has not been sent yet. It will be in your next report.'
                      : 'No stock with you to report today.'}
                  </Text>
                </View>
              ) : (
                <View style={styles.itemsList}>
                  <View style={styles.hintStrip}>
                    <Icon name="question" size={16} color="#0085F9" weight="fill" />
                    <Text style={styles.figuresHint}>
                      <Text style={styles.hintStrong}>Sold</Text> = units sold since your last submitted report. Include missed-day sales here; the total is recorded on this report's date.{' '}
                      <Text style={styles.hintStrong}>Returned</Text> = unsold stock you hand back to the branch today.
                      {' '}Any remaining balance stays in your backpack for the next report.
                    </Text>
                  </View>
                  {items.map((item) => {
                    const f = figures[item.productCode] || { sold: '', returns: '' };
                    const discrepancy = computeDiscrepancy(f.sold, f.returns, item.inCustodyQuantity);
                    const nearExpiry = (item.batches || []).some((b) => isNearExpiry(b.expDate));

                    return (
                      <View key={item.productCode} style={styles.itemCard}>
                        <View style={styles.itemTopRow}>
                          <View style={styles.thumbnailWrap}>
                            <View style={styles.thumbnail}>
                              {PRODUCT_CATALOG.find((p) => p.code === item.productCode)?.image ? (
                                <Image
                                  source={PRODUCT_CATALOG.find((p) => p.code === item.productCode).image}
                                  style={styles.thumbnailImage}
                                  resizeMode="contain"
                                />
                              ) : (
                                <Icon name="package" size={26} color="#94a3b8" />
                              )}
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
                              <View style={[styles.discBadge, discrepancy === 0 ? styles.discBadgeSuccess : styles.discBadgeCarryForward]}>
                                <Icon
                                  name={discrepancy === 0 ? 'checkCircle' : 'warningTriangle'}
                                  size={10}
                                  color={discrepancy === 0 ? '#1E7A3A' : '#B26400'}
                                />
                                <Text style={[styles.discBadgeText, discrepancy === 0 ? styles.discBadgeTextSuccess : styles.discBadgeTextCarryForward]}>
                                  {discrepancy === 0 ? 'Balanced' : `${Math.abs(discrepancy)} Unreported`}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.itemFullName} numberOfLines={1}>{item.productName}</Text>
                            {discrepancy < 0 && (
                              <Text style={styles.carryForwardExplanation}>
                                Remains in your inventory for the next report.
                              </Text>
                            )}
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
                            <FigureInput
                              value={f.sold}
                              onChangeText={(v) => updateFigure(item.productCode, 'sold', v)}
                              onFocus={() => {
                                setFocusedField(`${item.productCode}:sold`);
                                clearFigureOnFocus(item.productCode, 'sold');
                              }}
                              onBlur={() =>
                                setFocusedField((current) => (current === `${item.productCode}:sold` ? null : current))
                              }
                              focused={focusedField === `${item.productCode}:sold`}
                              editable={!isReportLocked && !isSubmitting}
                            />
                          </View>
                          <View style={styles.figureColumn}>
                            <View style={styles.figureLabelRow}>
                              <Icon name="returns" size={11} color="#272632" />
                              <Text style={styles.figureLabel}>Returned to branch</Text>
                            </View>
                            <FigureInput
                              value={f.returns}
                              onChangeText={(v) => updateFigure(item.productCode, 'returns', v)}
                              onFocus={() => {
                                setFocusedField(`${item.productCode}:returns`);
                                clearFigureOnFocus(item.productCode, 'returns');
                              }}
                              onBlur={() =>
                                setFocusedField((current) => (current === `${item.productCode}:returns` ? null : current))
                              }
                              focused={focusedField === `${item.productCode}:returns`}
                              editable={!isReportLocked && !isSubmitting}
                            />
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {!isReportLocked && items.length > 0 && (
                <View style={styles.photoSection}>
                  <View style={styles.photoTitleRow}>
                    <Text style={styles.listTitle}>Handover Photo</Text>
                    {!photoUri && (
                      <View style={styles.requiredPill}>
                        <Text style={styles.requiredPillText}>Required</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.photoSectionHint}>
                    A photo of your remaining stock on hand, taken when you file this report.
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
                        <View style={styles.cameraCircle}>
                          <Icon name="camera" size={26} color="#03045E" />
                        </View>
                        <Text style={styles.photoText}>Tap to capture proof</Text>
                      </View>
                    )}
                  </Pressable>
                </View>
              )}
            </KeyboardAwareScrollView>
            </BlurTargetView>

            {!isReportLocked && items.length > 0 && (
              <BottomActionBar variant="glass" blurTarget={blurTarget}>
                {!photoUri && !isSubmitting && <Text style={styles.barHint}>Take the handover photo to continue.</Text>}
                <Button
                  title="Finalize & Submit Daily Report"
                  variant="black"
                  onPress={handleFinalize}
                  loading={isSubmitting}
                  disabled={isSubmitting || !photoUri}
                  height={48}
                  fontSize={16}
                  borderRadius={24}
                />
              </BottomActionBar>
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
  contentTarget: { flex: 1 },
  hintStrip: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 10, backgroundColor: '#EAF4FF' },
  hintStrong: { fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', color: '#272632' },
  photoTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  requiredPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, backgroundColor: '#FDECEC' },
  requiredPillText: { fontSize: 12, color: '#B91C1C', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  cameraCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#E6E8F5', alignItems: 'center', justifyContent: 'center' },
  barHint: { marginBottom: 8, fontSize: 12, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.regular },
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
  countdownPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 8, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.7)' },
  countdownText: { fontSize: 12, color: '#1E7A3A', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  submittedBannerTitle: {
    fontSize: 13,
    color: '#1D6A3A',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  submittedBannerText: {
    fontSize: 12,
    color: '#1D6A3A',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  viewReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFE8CC',
  },
  viewReportText: {
    fontSize: 12,
    color: '#1E7A3A',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  photoSection: {
    marginTop: 4,
  },
  figuresHint: {
    flex: 1,
    fontSize: 12,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  photoSectionHint: {
    fontSize: 12,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginBottom: 8,
  },
  listTitle: {
    color: '#272632',
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  photoPlaceholder: {
    borderWidth: 1.5,
    borderColor: '#D7E3F1',
    borderStyle: 'dashed',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    height: 130,
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
    fontSize: 12,
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
    fontSize: 12,
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
    fontSize: 12,
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
    fontSize: 12,
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
    width: 64,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#F1F3F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailImage: {
    width: '85%',
    height: '85%',
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
    fontSize: 11,
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
  discBadgeCarryForward: {
    backgroundColor: '#FFF1D6',
  },
  discBadgeText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  discBadgeTextSuccess: {
    color: '#1E7A3A',
  },
  discBadgeTextCarryForward: {
    color: '#8A5A00',
  },
  carryForwardExplanation: {
    marginTop: 3,
    fontSize: 11,
    color: '#8A5A00',
    fontFamily: TYPOGRAPHY.fontFamily.medium,
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
    fontSize: 12,
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
    fontSize: 12,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  figureInput: {
    borderWidth: 1,
    borderColor: '#DBE4EE',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  figureInputFocused: {
    borderColor: '#03045E',
  },
  // Sized to its digits (never stretched), so Android never re-centres it.
  figureInputText: {
    minWidth: 2,
    height: 44,
    paddingVertical: 0,
    paddingHorizontal: 0,
    includeFontPadding: false,
    textAlign: 'left',
    textAlignVertical: 'center',
    fontSize: 14,
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
