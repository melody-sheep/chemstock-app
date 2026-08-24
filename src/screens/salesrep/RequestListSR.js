// src/screens/salesrep/RequestListSR.js
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import Header from '../../components/common/Header';
import SubScreenSecondaryHeader from '../../components/common/SubScreenSecondaryHeader';
import Icon from '../../components/common/Icon';
import Button from '../../components/common/Button';
import authService from '../../services/authService';
import requestService from '../../services/requestService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

export default function RequestListSR() {
  const navigation = useNavigation();
  const route = useRoute();

  const [items, setItems] = useState(route.params?.items || []);
  const [agent, setAgent] = useState(null);
  const [coords, setCoords] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [capturedAt] = useState(() => new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  useEffect(() => {
    authService.getCurrentUser().then(setAgent);

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('Location permission denied');
          return;
        }
        const position = await Location.getCurrentPositionAsync({});
        setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      } catch (error) {
        console.error('❌ [RequestListSR] Location error:', error);
        setLocationError('Unable to determine location');
      }
    })();
  }, []);

  const deviceLabel = [Device.modelName, Device.osName, Device.osVersion].filter(Boolean).join(' - ');

  const handleAdjustQty = (productCode, delta) => {
    setItems((prev) =>
      prev
        .map((item) => (item.productCode === productCode ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemove = (productCode) => {
    setItems((prev) => prev.filter((item) => item.productCode !== productCode));
  };

  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);

  const handleSend = async () => {
    if (!agent || items.length === 0 || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const result = await requestService.submitStockRequest({
        agentId: agent.id,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        deviceModel: Device.modelName,
        deviceOs: `${Device.osName || ''} ${Device.osVersion || ''}`.trim(),
        items,
      });

      if (!result.success) {
        throw new Error(result.message);
      }

      setIsSent(true);
    } catch (error) {
      Alert.alert('Failed to Send Request', error.message || 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDone = () => navigation.navigate('SalesRepDashboard');

  if (isSent) {
    return (
      <>
        <StatusBar style="light" />
        <View style={styles.container}>
          <Header title="Request Sent" height={56} backgroundColor="#03045E" textColor="#FFFFFF" paddingHorizontal={SPACING.md} />
          <View style={styles.successWrap}>
            <Icon name="checkCircle" size={48} color={COLORS.success} weight="fill" />
            <Text style={styles.successTitle}>Request Sent Successfully</Text>
            <Text style={styles.successSubtitle}>
              {items.length} item{items.length === 1 ? '' : 's'}, {totalUnits} units sent to your branch manager
            </Text>
            <Button title="Done" variant="black" onPress={handleDone} style={styles.doneButton} />
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header showBackButton backButtonText="Request Stock" height={56} backgroundColor="#03045E" textColor="#FFFFFF" paddingHorizontal={SPACING.md} />
        <SubScreenSecondaryHeader title="Request List" />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Requested Items</Text>

          {items.length === 0 ? (
            <View style={styles.emptyBox}>
              <Icon name="boxPackage" size={28} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>No items in your request.</Text>
            </View>
          ) : (
            <View style={styles.itemsCard}>
              {items.map((item, index) => (
                <View key={item.productCode} style={[styles.itemRow, index === 0 && styles.itemRowFirst]}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.productName}</Text>
                    <Text style={styles.itemMeta}>Code: {item.productCode}</Text>
                  </View>
                  <View style={styles.stepperInline}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => handleAdjustQty(item.productCode, -1)}
                      accessibilityLabel={`Decrease ${item.productName} quantity`}
                    >
                      <Icon name="minus" size={14} color={COLORS.primary} />
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => handleAdjustQty(item.productCode, 1)}
                      accessibilityLabel={`Increase ${item.productName} quantity`}
                    >
                      <Icon name="plus" size={14} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity onPress={() => handleRemove(item.productCode)} style={styles.removeBtn}>
                    <Icon name="trash" size={16} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {items.length > 0 && (
            <Text style={styles.summaryText}>
              📦 {items.length} item{items.length === 1 ? '' : 's'}, {totalUnits} units to request
            </Text>
          )}

          <Text style={styles.sectionTitle}>Request Details</Text>
          <View style={styles.metaCard}>
            <View style={styles.metaRow}>
              <Icon name="location" size={16} color={COLORS.error} />
              <Text style={styles.metaText}>
                {coords ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` : locationError || 'Locating…'}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Icon name="building" size={16} color={COLORS.primary} />
              <Text style={styles.metaText}>{agent?.branchName || 'Loading branch…'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Icon name="package" size={16} color={COLORS.textSecondary} />
              <Text style={styles.metaText}>{deviceLabel || 'Unknown device'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Icon name="calendar" size={16} color={COLORS.textSecondary} />
              <Text style={styles.metaText}>{capturedAt.toLocaleString()}</Text>
            </View>
          </View>

          <Button
            title={isSubmitting ? 'Sending…' : 'Send Request'}
            variant="black"
            onPress={handleSend}
            loading={isSubmitting}
            disabled={isSubmitting || !agent || items.length === 0}
            style={styles.sendButton}
          />
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 48, gap: SPACING.md },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  emptyBox: {
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  itemsCard: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  itemRowFirst: { borderTopWidth: 0 },
  itemInfo: { flex: 1 },
  itemName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  itemMeta: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  stepperInline: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  stepperBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  stepperValue: {
    minWidth: 26,
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: '#272632',
  },
  removeBtn: { padding: 4 },
  summaryText: {
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: '#272632',
  },
  metaCard: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  metaText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: '#272632',
  },
  sendButton: { marginTop: SPACING.sm },
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: SPACING.sm,
  },
  successTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  doneButton: { width: '100%' },
});
