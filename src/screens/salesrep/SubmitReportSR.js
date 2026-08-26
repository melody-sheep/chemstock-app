// src/screens/salesrep/SubmitReportSR.js
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import Icon from '../../components/common/Icon';
import { TYPOGRAPHY } from '../../styles/typography';
import { COLORS } from '../../constants/colors';
import authService from '../../services/authService';
import reportService from '../../services/reportService';
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

export default function SubmitReportSR() {
  const navigation = useNavigation();
  const [agent, setAgent] = useState(null);
  const [reportDate, setReportDate] = useState(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [items, setItems] = useState([]);
  const [figures, setFigures] = useState({}); // { [productCode]: { sold, returns } }
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadStatus = useCallback(async () => {
    setIsLoading(true);
    const currentAgent = await authService.getCurrentUser();
    setAgent(currentAgent);

    const result = await reportService.getMySrReportStatus(currentAgent?.id);
    if (result.success) {
      setReportDate(result.data.reportDate);
      setAlreadySubmitted(result.data.alreadySubmitted);
      setItems(result.data.items || []);
      const initialFigures = {};
      (result.data.items || []).forEach((item) => {
        initialFigures[item.productCode] = { sold: '', returns: '' };
      });
      setFigures(initialFigures);
    }
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStatus();
    }, [loadStatus])
  );

  const handleBack = () => navigation.goBack();

  const updateFigure = (productCode, field, value) => {
    const digitsOnly = value.replace(/[^0-9]/g, '');
    setFigures((prev) => ({
      ...prev,
      [productCode]: { ...prev[productCode], [field]: digitsOnly },
    }));
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

      const result = await reportService.submitDailyReport({
        agentId: agent?.id,
        latitude: coords.latitude,
        longitude: coords.longitude,
        deviceModel: Device.modelName || null,
        deviceOs: Device.osName || null,
        items: reportItems,
      });

      if (!result.success) {
        Alert.alert('Submit Failed', result.message || 'Could not submit your daily report.');
        return;
      }

      Alert.alert('Report Submitted', 'Your daily report has been sent to your manager for review.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable onPress={handleBack} style={styles.iconButton}>
            <Icon name="arrowLeft" size={20} color="#FFFFFF" />
          </Pressable>

          <Text style={styles.topBarTitle}>Submit Report</Text>

          <View style={styles.iconButton}>
            <Icon name="document" size={20} color="#FFFFFF" />
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              <View style={styles.summaryHeaderRow}>
                <Text style={styles.summaryTitle}>
                  {alreadySubmitted ? "Today's Report (Submitted)" : "Today's Report Summary (Daily)"}
                </Text>
                <View style={styles.statusPill}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Online</Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <View style={[styles.statIconWrap, { backgroundColor: '#EDEBFF' }]}>
                    <Icon name="boxPackage" size={18} color="#03045E" />
                  </View>
                  <Text style={styles.statValue}>{totals.given}</Text>
                  <Text style={styles.statLabel}>Given Stock</Text>
                </View>
                <View style={styles.statCard}>
                  <View style={[styles.statIconWrap, { backgroundColor: '#3B2FC9' }]}>
                    <Icon name="checkmarkCircle" size={18} color="#FFFFFF" weight="fill" />
                  </View>
                  <Text style={styles.statValue}>{totals.sold}</Text>
                  <Text style={styles.statLabel}>Sold Stocks</Text>
                </View>
                <View style={styles.statCard}>
                  <View style={[styles.statIconWrap, { backgroundColor: '#F72E75' }]}>
                    <Icon name="returns" size={18} color="#FFFFFF" weight="fill" />
                  </View>
                  <Text style={styles.statValue}>{totals.returns}</Text>
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
                            <Text style={styles.itemCode} numberOfLines={1}>{item.productCode}</Text>
                            <Text style={styles.itemFullName} numberOfLines={1}>{item.productName}</Text>
                            <Text style={styles.itemMeta}>In Custody: {item.inCustodyQuantity}</Text>
                          </View>
                        </View>

                        <View style={styles.figuresRow}>
                          <View style={styles.figureColumn}>
                            <Text style={styles.figureLabel}>Sold</Text>
                            <TextInput
                              style={styles.figureInput}
                              value={f.sold}
                              onChangeText={(v) => updateFigure(item.productCode, 'sold', v)}
                              keyboardType="number-pad"
                              placeholder="0"
                              editable={!alreadySubmitted && !isSubmitting}
                            />
                          </View>
                          <View style={styles.figureColumn}>
                            <Text style={styles.figureLabel}>Returns</Text>
                            <TextInput
                              style={styles.figureInput}
                              value={f.returns}
                              onChangeText={(v) => updateFigure(item.productCode, 'returns', v)}
                              keyboardType="number-pad"
                              placeholder="0"
                              editable={!alreadySubmitted && !isSubmitting}
                            />
                          </View>
                          <View style={styles.figureColumn}>
                            <Text style={styles.figureLabel}>Discrepancy</Text>
                            <View
                              style={[
                                styles.figureBox,
                                discrepancy === 0
                                  ? styles.figureBoxSuccess
                                  : discrepancy < 0
                                  ? styles.figureBoxError
                                  : styles.figureBoxOver,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.figureValue,
                                  discrepancy === 0
                                    ? styles.figureValueSuccess
                                    : discrepancy < 0
                                    ? styles.figureValueError
                                    : styles.figureValueOver,
                                ]}
                              >
                                {discrepancy}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            {!alreadySubmitted && items.length > 0 && (
              <View style={styles.footer}>
                <Pressable
                  style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}
                  onPress={handleFinalize}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Finalize & Submit Daily Report</Text>
                  )}
                </Pressable>
              </View>
            )}
          </>
        )}
      </View>
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
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  summaryTitle: {
    fontSize: 17,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#B7FFD6',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#00FF6E',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#00FF6E',
    marginRight: 5,
  },
  statusText: {
    color: '#1D6A3A',
    fontSize: 10,
    fontWeight: '600',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
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
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'flex-start',
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
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
    marginTop: 1,
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
    borderRadius: 14,
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
    borderRadius: 10,
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
  itemCode: {
    fontSize: 15,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  itemFullName: {
    fontSize: 12,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  itemMeta: {
    fontSize: 11,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 4,
  },
  figuresRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  figureColumn: {
    flex: 1,
  },
  figureLabel: {
    fontSize: 11,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    marginBottom: 4,
  },
  figureInput: {
    borderWidth: 1,
    borderColor: '#DBE4EE',
    borderRadius: 8,
    height: 34,
    textAlign: 'center',
    fontSize: 13,
    color: '#03045E',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  figureBox: {
    borderWidth: 1,
    borderColor: '#DBE4EE',
    borderRadius: 8,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  figureBoxSuccess: {
    backgroundColor: '#DFFBE9',
    borderColor: '#DFFBE9',
  },
  figureBoxError: {
    backgroundColor: '#FBDCDC',
    borderColor: '#FBDCDC',
  },
  figureBoxOver: {
    backgroundColor: '#FFF1D6',
    borderColor: '#FFF1D6',
  },
  figureValue: {
    fontSize: 13,
    color: '#03045E',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  figureValueSuccess: {
    color: '#1E7A3A',
  },
  figureValueError: {
    color: '#B91C1C',
  },
  figureValueOver: {
    color: '#B26400',
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
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
});
