// src/screens/salesrep/ResolveDiscrepancyScreen.js
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import Icon from '../../components/common/Icon';
import CameraCaptureModal from '../../components/common/CameraCaptureModal';
import { TYPOGRAPHY } from '../../styles/typography';
import { COLORS } from '../../constants/colors';
import authService from '../../services/authService';
import inventoryService from '../../services/inventoryService';
import reportService from '../../services/reportService';

/**
 * Reached only from AlertsDiscrepanciesSR — resolves ONE discrepant report
 * item. Per Jay's explicit instruction: no QR, photo proof only. The
 * quantity is fixed (the discrepancy amount itself), not user-adjustable.
 */
export default function ResolveDiscrepancyScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const reportItem = route.params?.reportItem;

  const [photoUri, setPhotoUri] = useState(null);
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleBack = () => navigation.goBack();

  const handleSubmit = async () => {
    if (!photoUri) {
      Alert.alert('Photo Required', 'Please attach a photo before requesting a return.');
      return;
    }

    setIsSubmitting(true);
    try {
      const agent = await authService.getCurrentUser();

      let coords = { latitude: null, longitude: null };
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const position = await Location.getCurrentPositionAsync({});
          coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        }
      } catch (locationError) {
        console.error('[ERROR] [ResolveDiscrepancyScreen] Location error:', locationError);
      }

      const storagePath = await inventoryService.uploadDiscrepancyPhoto(photoUri, agent?.id);

      const result = await reportService.requestDiscrepancyResolution({
        agentId: agent?.id,
        reportItemId: reportItem.reportItemId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        storagePath,
        deviceModel: Device.modelName || null,
        deviceOs: Device.osName || null,
      });

      if (!result.success) {
        Alert.alert('Request Failed', result.message || 'Could not submit your return request.');
        return;
      }

      Alert.alert('Request Sent', 'Your return request has been sent to your manager for review.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Request Failed', error.message || 'Could not submit your return request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!reportItem) {
    return (
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable onPress={handleBack} style={styles.iconButton}>
            <Icon name="arrowLeft" size={20} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.topBarTitle}>Resolve Discrepancy</Text>
          <View style={styles.iconButton} />
        </View>
        <View style={styles.loadingWrap}>
          <Text style={styles.emptyText}>This discrepancy could not be loaded.</Text>
        </View>
      </View>
    );
  }

  const isLoss = reportItem.discrepancyType === 'loss';

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable onPress={handleBack} style={styles.iconButton}>
            <Icon name="arrowLeft" size={20} color="#FFFFFF" />
          </Pressable>

          <Text style={styles.topBarTitle}>Resolve Discrepancy</Text>

          <View style={styles.iconButton} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.itemCard}>
            <View style={styles.itemTopRow}>
              <View style={styles.thumbnail}>
                <Icon name="package" size={26} color="#94a3b8" />
              </View>
              <View style={styles.itemDetails}>
                <Text style={styles.itemCode} numberOfLines={1}>{reportItem.productCode}</Text>
                <Text style={styles.itemFullName} numberOfLines={1}>{reportItem.productName}</Text>
              </View>
            </View>

            <View style={styles.figuresRow}>
              <View style={styles.figureColumn}>
                <Text style={styles.figureLabel}>In Custody</Text>
                <View style={styles.figureBox}>
                  <Text style={styles.figureValue}>{reportItem.inCustodyQuantity}</Text>
                </View>
              </View>
              <View style={styles.figureColumn}>
                <Text style={styles.figureLabel}>Sold</Text>
                <View style={styles.figureBox}>
                  <Text style={styles.figureValue}>{reportItem.soldQuantity}</Text>
                </View>
              </View>
              <View style={styles.figureColumn}>
                <Text style={styles.figureLabel}>Return</Text>
                <View style={styles.figureBox}>
                  <Text style={styles.figureValue}>{reportItem.returnQuantity}</Text>
                </View>
              </View>
              <View style={styles.figureColumn}>
                <Text style={[styles.figureLabel, styles.discrepancyLabel]}>
                  {isLoss ? 'Missing' : 'Over'}
                </Text>
                <View style={[styles.figureBox, styles.figureBoxError]}>
                  <Text style={[styles.figureValue, styles.figureValueError]}>
                    {Math.abs(reportItem.discrepancy)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <Text style={styles.helperText}>
            {isLoss
              ? `This will request the return of the ${Math.abs(reportItem.discrepancy)} missing unit(s) once your manager reviews the photo evidence below.`
              : `This will flag the ${Math.abs(reportItem.discrepancy)} extra unit(s) reported for manager review with the photo evidence below.`}
          </Text>

          <Pressable style={styles.photoCard} onPress={() => setIsCameraVisible(true)}>
            <Text style={styles.listTitle}>Photo Proof</Text>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Icon name="camera" size={36} color="#03045E" />
                <Text style={styles.photoText}>Tap to capture proof</Text>
              </View>
            )}
          </Pressable>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Request Return Stock</Text>
            )}
          </Pressable>
        </View>
      </View>

      <CameraCaptureModal
        visible={isCameraVisible}
        onClose={() => setIsCameraVisible(false)}
        onCapture={setPhotoUri}
        initialUri={photoUri}
      />
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
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  itemCard: {
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  itemTopRow: {
    flexDirection: 'row',
  },
  thumbnail: {
    width: 60,
    height: 68,
    borderRadius: 10,
    backgroundColor: '#F1F3F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
    justifyContent: 'center',
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
  figuresRow: {
    flexDirection: 'row',
    gap: 8,
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
  discrepancyLabel: {
    color: '#B91C1C',
  },
  figureBox: {
    borderWidth: 1,
    borderColor: '#DBE4EE',
    borderRadius: 8,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  figureBoxError: {
    borderColor: '#EF4444',
    backgroundColor: '#FFFFFF',
  },
  figureValue: {
    fontSize: 13,
    color: '#03045E',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  figureValueError: {
    color: '#EF4444',
  },
  helperText: {
    fontSize: 12,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    lineHeight: 18,
    marginBottom: 18,
  },
  photoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAEFF5',
    paddingHorizontal: 14,
    paddingVertical: 12,
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
    borderRadius: 14,
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
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 14,
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
