// src/screens/manager/ReceiveStockPreviewScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import Header from '../../components/common/Header';
import SubScreenSecondaryHeader from '../../components/common/SubScreenSecondaryHeader';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import SaveableQRCode from '../../components/common/SaveableQRCode';
import authService from '../../services/authService';
import inventoryService from '../../services/inventoryService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

export default function ReceiveStockPreviewScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { items, photoUri } = route.params;

  const [manager, setManager] = useState(null);
  const [isLoadingManager, setIsLoadingManager] = useState(true);
  const [coords, setCoords] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [capturedAt] = useState(() => new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [qrCode, setQrCode] = useState(null);

  useEffect(() => {
    authService
      .getCurrentUser()
      .then(setManager)
      .catch((error) => {
        console.error('❌ [ReceiveStockPreview] Failed to load manager:', error);
        setManager(null);
      })
      .finally(() => setIsLoadingManager(false));

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
        console.error('❌ [ReceiveStockPreview] Location error:', error);
        setLocationError('Unable to determine location');
      }
    })();
  }, []);

  const totalUnits = items.reduce((sum, item) => sum + item.registeredQty, 0);
  const deviceLabel = [Device.modelName, Device.osName, Device.osVersion].filter(Boolean).join(' - ');

  const branchStatusText = isLoadingManager
    ? 'Loading branch…'
    : manager?.branchName || 'No branch assigned to your account';

  const handleReceiveAndGenerate = async () => {
    if (!manager) return;
    setIsSubmitting(true);

    try {
      const branchId = manager.branchIds?.[0];
      if (!branchId) {
        throw new Error('No branch is assigned to your account.');
      }

      const storagePath = await inventoryService.uploadShipmentPhoto(photoUri, manager.id);

      const result = await inventoryService.receiveStockBatch({
        branchId,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        deviceModel: Device.modelName,
        deviceOs: `${Device.osName || ''} ${Device.osVersion || ''}`.trim(),
        storagePath,
        items,
      });

      if (!result.success) {
        throw new Error(result.message);
      }

      setQrCode(result.data.qrCode);
    } catch (error) {
      Alert.alert('Failed to Register Stock', error.message || 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDone = () => {
    navigation.navigate('ManagerDashboard');
  };

  if (qrCode) {
    return (
      <>
        <StatusBar style="light" />
        <View style={styles.container}>
          <Header
            title="Batch Registered"
            height={56}
            backgroundColor="#03045E"
            textColor="#FFFFFF"
            paddingHorizontal={SPACING.md}
          />
          <View style={styles.qrScreen}>
            <Icon name="checkCircle" size={40} color={COLORS.success} weight="fill" />
            <Text style={styles.qrTitle}>Stock Registered Successfully</Text>
            <Text style={styles.qrSubtitle}>
              {items.length} item{items.length === 1 ? '' : 's'}, {totalUnits} units
            </Text>
            <SaveableQRCode value={qrCode} size={200} style={styles.qrCard} />
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
        <Header
          showBackButton={true}
          backButtonText="Add New Batches"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
        />

        <SubScreenSecondaryHeader title="Preview & Confirm" />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Items ({items.length})</Text>
          <View style={styles.itemsCard}>
            {items.map((item) => (
              <View key={item.code} style={styles.itemRow}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>
                  Qty: {item.registeredQty}
                  {item.mfgDate ? `   Mfg: ${item.mfgDate}` : ''}
                  {item.expDate ? `   Exp: ${item.expDate}` : ''}
                </Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Shipment Proof</Text>
          <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />

          <Text style={styles.sectionTitle}>Transaction Details</Text>
          <View style={styles.metaCard}>
            <View style={styles.metaRow}>
              <Icon name="location" size={16} color={COLORS.error} />
              <Text style={styles.metaText}>
                {coords
                  ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`
                  : locationError || 'Locating…'}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Icon name="building" size={16} color={COLORS.primary} />
              <Text style={styles.metaText}>{branchStatusText}</Text>
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
            title={isSubmitting ? 'Registering…' : 'Receive and Generate QR'}
            variant="black"
            onPress={handleReceiveAndGenerate}
            loading={isSubmitting}
            disabled={isSubmitting || !manager}
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
  itemsCard: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  itemRow: {
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  itemName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  itemMeta: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  photoPreview: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  metaCard: {
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
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: '#272632',
  },
  qrScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: SPACING.sm,
  },
  qrTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
    textAlign: 'center',
  },
  qrSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  qrCard: {
    marginBottom: SPACING.xl,
  },
  doneButton: {
    width: '100%',
  },
});
