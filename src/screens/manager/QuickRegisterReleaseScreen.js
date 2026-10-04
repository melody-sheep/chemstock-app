// src/screens/manager/QuickRegisterReleaseScreen.js
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import Icon from '../../components/common/Icon';
import Stepper from '../../components/common/Stepper';
import Button from '../../components/common/Button';
import BottomActionBar, { useBottomActionBarHeight } from '../../components/common/BottomActionBar';
import ProductPickerList from '../../components/common/ProductPickerList';
import CameraCaptureModal from '../../components/common/CameraCaptureModal';
import ShipmentProofRow from '../../components/common/ShipmentProofRow';
import { COLORS } from '../../constants/colors';
import { logEvent } from '../../utils/logger';
import {
  getItemsMissingDates,
  getItemsWithDateOrderError,
  listItemNames,
} from '../../utils/batchItemValidation';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const STEP_LABELS = ['Who receives the stock?', 'How many items?', 'Final Proof'];

// First reason the release can't proceed yet, or null when it can.
function getBlockingReason(items, photoUri) {
  if (items.length === 0) return 'Add at least one product to continue.';
  const missingDates = getItemsMissingDates(items);
  if (missingDates.length > 0) return `Set MFG and EXP dates for ${listItemNames(missingDates)}.`;
  const dateOrderErrors = getItemsWithDateOrderError(items);
  if (dateOrderErrors.length > 0) return `EXP must be after MFG for ${listItemNames(dateOrderErrors)}.`;
  if (!photoUri) return 'Take the waybill/invoice photo to continue.';
  return null;
}

export default function QuickRegisterReleaseScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { recipient, targetRecipient, branchId, movementType } = route.params;
  const bottomActionBarHeight = useBottomActionBarHeight();

  const [items, setItems] = useState([]);
  const [photoUri, setPhotoUri] = useState(null);
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [isViewingPhoto, setIsViewingPhoto] = useState(false);

  const handleOpenCamera = () => {
    setIsViewingPhoto(false);
    setIsCameraVisible(true);
  };

  const handleViewPhoto = () => {
    setIsViewingPhoto(true);
    setIsCameraVisible(true);
  };

  const handleCloseCamera = () => {
    setIsCameraVisible(false);
    setIsViewingPhoto(false);
  };

  useFocusEffect(
    useCallback(() => {
      const picked = route.params?.pickedProducts;
      if (picked?.length) {
        setItems((prev) => {
          const existingCodes = new Set(prev.map((item) => item.code));
          const added = picked
            .filter((product) => !existingCodes.has(product.code))
            .map((product) => ({ ...product, registeredQty: 1, mfgDate: '', expDate: '' }));
          logEvent('QuickRegisterRelease', 'productsAdded', { codes: added.map((p) => p.code) });
          return [...prev, ...added];
        });
        navigation.setParams({ pickedProducts: undefined });
      }
    }, [route.params?.pickedProducts, navigation])
  );

  const totalUnits = items.reduce((sum, item) => sum + item.registeredQty, 0);

  const blockingReason = getBlockingReason(items, photoUri);

  const handleNext = () => {
    if (blockingReason) {
      logEvent('QuickRegisterRelease', 'nextBlocked', { reason: blockingReason });
      Alert.alert('Almost There', blockingReason);
      return;
    }
    const params = {
      recipient,
      targetRecipient,
      branchId,
      movementType,
      mode: 'quickRegister',
      registerItems: items,
      registerPhotoUri: photoUri,
    };
    navigation.navigate(movementType === 'collector' ? 'ReleaseStockDelivery' : 'ReleaseStockConfirm', params);
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

        <SecondaryHeader height={56}>
          <View style={styles.titleRow}>
            <Text style={styles.urgentPageTitle}>Urgent Release!</Text>
            <View style={styles.onlinePill}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Online</Text>
            </View>
          </View>
        </SecondaryHeader>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: bottomActionBarHeight + SPACING.md + (blockingReason ? SPACING.xl : 0) },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Stepper currentStep={2} labels={STEP_LABELS} />

          <ProductPickerList
            items={items}
            onItemsChange={setItems}
            onOpenPicker={() => navigation.navigate('ProductSelect', { alreadyAddedCodes: items.map((item) => item.code) })}
            queueTitle="Batches to Add"
            queueCardHeader="Session Queue"
          />

          <Text style={styles.sectionTitle}>Shipment Proof (Handover)</Text>
          <ShipmentProofRow
            photoUri={photoUri}
            onOpenCamera={handleOpenCamera}
            onViewPhoto={photoUri ? handleViewPhoto : undefined}
          />

          <View style={styles.summaryRow}>
            <Icon name="package" size={16} color={COLORS.textSecondary} />
            <Text style={styles.summaryText}>
              {items.length} item{items.length === 1 ? '' : 's'}, {totalUnits} units
            </Text>
          </View>

        </ScrollView>

        <BottomActionBar>
          {blockingReason && <Text style={styles.blockingHint}>{blockingReason}</Text>}
          <Button
            title="Next"
            icon="arrowRight"
            iconPosition="right"
            onPress={handleNext}
            disabled={blockingReason !== null}
            variant="black"
          />
        </BottomActionBar>

        <CameraCaptureModal
          visible={isCameraVisible}
          onClose={handleCloseCamera}
          onCapture={setPhotoUri}
          initialUri={isViewingPhoto ? photoUri : null}
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
    color: COLORS.textPrimary,
  },
  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' },
  onlineText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.success,
  },
  content: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, gap: SPACING.md, paddingBottom: 48 },
  blockingHint: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  summaryText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textPrimary,
  },
});
