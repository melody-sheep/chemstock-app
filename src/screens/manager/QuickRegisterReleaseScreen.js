// src/screens/manager/QuickRegisterReleaseScreen.js
import React, { useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import Icon from '../../components/common/Icon';
import Stepper from '../../components/common/Stepper';
import Button from '../../components/common/Button';
import ProductPickerList from '../../components/common/ProductPickerList';
import CameraCaptureModal from '../../components/common/CameraCaptureModal';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const STEP_LABELS = ['Who receives the stock?', 'How many items?', 'Final Proof'];

export default function QuickRegisterReleaseScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { recipient, branchId } = route.params;

  const [items, setItems] = useState([]);
  const [photoUri, setPhotoUri] = useState(null);
  const [isCameraVisible, setIsCameraVisible] = useState(false);

  const totalUnits = items.reduce((sum, item) => sum + item.registeredQty, 0);

  const handleNext = () => {
    if (items.length === 0) {
      Alert.alert('No Products Selected', 'Search and add at least one product before continuing.');
      return;
    }
    if (!photoUri) {
      Alert.alert('Photo Required', 'Take a photo of the waybill/invoice before continuing.');
      return;
    }
    navigation.navigate('ReleaseStockConfirm', {
      recipient,
      branchId,
      movementType: 'direct',
      mode: 'quickRegister',
      registerItems: items,
      registerPhotoUri: photoUri,
    });
  };

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton
          backButtonText="Give Out Stock"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
        />

        <SecondaryHeader height={56} backgroundColor={COLORS.error + '10'} borderColor={COLORS.error}>
          <View style={styles.titleRow}>
            <Text style={styles.urgentPageTitle}>Urgent Release!</Text>
            <View style={styles.onlinePill}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Online</Text>
            </View>
          </View>
        </SecondaryHeader>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Stepper currentStep={2} labels={STEP_LABELS} />

          <ProductPickerList
            items={items}
            onItemsChange={setItems}
            queueTitle="Batches to Add"
            queueCardHeader="Session Queue"
          />

          <Text style={styles.sectionTitle}>Shipment Proof (Handover)</Text>
          {photoUri ? (
            <TouchableOpacity style={styles.photoPreviewRow} onPress={() => setIsCameraVisible(true)} activeOpacity={0.7}>
              <Image source={{ uri: photoUri }} style={styles.photoPreviewThumb} resizeMode="cover" />
              <View style={styles.photoPreviewInfo}>
                <Text style={styles.photoText}>Photo captured</Text>
                <Text style={styles.photoRetakeText}>Tap to retake</Text>
              </View>
              <Icon name="checkCircle" size={20} color={COLORS.success} weight="fill" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.photoRow} onPress={() => setIsCameraVisible(true)} activeOpacity={0.7}>
              <View style={styles.photoIconBox}>
                <Icon name="camera" size={22} color={COLORS.error} />
              </View>
              <Text style={styles.photoText}>
                Take Photo of Waybill/Invoice <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
            </TouchableOpacity>
          )}

          <Text style={styles.summaryText}>
            📦 {items.length} item{items.length === 1 ? '' : 's'}, {totalUnits} units
          </Text>

          <Button title="Next" icon="arrowRight" iconPosition="right" onPress={handleNext} variant="black" />
        </ScrollView>

        <CameraCaptureModal
          visible={isCameraVisible}
          onClose={() => setIsCameraVisible(false)}
          onCapture={setPhotoUri}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
  },
  urgentPageTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.error,
  },
  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' },
  onlineText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.success,
  },
  content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 48 },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.error + '40',
    borderRadius: 12,
    padding: SPACING.sm,
    backgroundColor: '#FFFFFF',
  },
  photoIconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.error + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: '#272632',
  },
  photoPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.success,
    borderRadius: 12,
    padding: SPACING.sm,
    backgroundColor: COLORS.success + '10',
  },
  photoPreviewThumb: { width: 44, height: 44, borderRadius: 8 },
  photoPreviewInfo: { flex: 1 },
  photoRetakeText: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  requiredAsterisk: { color: COLORS.error },
  summaryText: {
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: '#272632',
  },
});
