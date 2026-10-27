// src/screens/manager/QuickRegisterReleaseScreen.js
import React, { useCallback, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Alert from '../../utils/appAlert';
import { StatusBar } from 'expo-status-bar';
import { BlurTargetView } from 'expo-blur';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import LiveStatusPill from '../../components/common/LiveStatusPill';
import SectionHeader from '../../components/common/SectionHeader';
import UserAvatar from '../../components/common/UserAvatar';
import Icon from '../../components/common/Icon';
import Stepper from '../../components/common/Stepper';
import Button from '../../components/common/Button';
import BottomActionBar, { useBottomActionBarHeight } from '../../components/common/BottomActionBar';
import ProductPickerList from '../../components/common/ProductPickerList';
import CameraCaptureModal from '../../components/common/CameraCaptureModal';
import { getInitials } from '../../utils/initials';
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
const ROLE_LABEL = { collector: 'Collector', sales_rep: 'Sales Rep' };

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
  const blurTarget = useRef(null);
  const scrollRef = useRef(null);

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

        <SecondaryHeader height={76}>
          <View style={styles.titleRow}>
            <View style={styles.titleTextCol}>
              <Text style={styles.urgentPageTitle} numberOfLines={1}>Register New Items</Text>
              <Text style={styles.pageSubtitle}>Add items that are not in the system yet</Text>
            </View>
            <LiveStatusPill pillStyle={styles.onlinePill} dotStyle={styles.onlineDot} textStyle={styles.onlineText} />
          </View>
        </SecondaryHeader>

        <BlurTargetView ref={blurTarget} style={styles.contentTarget}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: bottomActionBarHeight + SPACING.md + SPACING.xl },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Stepper currentStep={2} labels={STEP_LABELS} />

          {/* Who this release is for (chosen on the first screen). */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryPerson}>
              <UserAvatar
                photoUrl={recipient.profilePhotoUrl}
                fallbackText={getInitials(recipient.fullName)}
                size={36}
                backgroundColor={COLORS.primaryLight}
                fallbackTextColor={COLORS.primary}
              />
              <View style={styles.summaryTextCol}>
                <Text style={styles.summaryCaption}>{targetRecipient ? (ROLE_LABEL[recipient.role] || 'Recipient') : 'Releasing to'}</Text>
                <Text style={styles.summaryName} numberOfLines={1}>{recipient.fullName}</Text>
              </View>
            </View>
            {targetRecipient && (
              <>
                <Icon name="arrowRight" size={16} color={COLORS.textSecondary} />
                <View style={styles.summaryPerson}>
                  <UserAvatar
                    photoUrl={targetRecipient.profilePhotoUrl}
                    fallbackText={getInitials(targetRecipient.fullName)}
                    size={36}
                    backgroundColor={COLORS.primaryLight}
                    fallbackTextColor={COLORS.primary}
                  />
                  <View style={styles.summaryTextCol}>
                    <Text style={styles.summaryCaption}>Deliver to</Text>
                    <Text style={styles.summaryName} numberOfLines={1}>{targetRecipient.fullName}</Text>
                  </View>
                </View>
              </>
            )}
          </View>

          <ProductPickerList
            scrollRef={scrollRef}
            items={items}
            onItemsChange={setItems}
            onOpenPicker={() => navigation.navigate('ProductSelect', { alreadyAddedCodes: items.map((item) => item.code) })}
            queueTitle="Items to Register"
            queueCardHeader="List of Items"
            labelHeader
            emptyText="Pick a product above to add it here."
          />

          <SectionHeader icon="camera" size="md" label="Waybill / invoice photo" style={styles.labelSpaced} />
          <ShipmentProofRow
            photoUri={photoUri}
            onOpenCamera={handleOpenCamera}
            onViewPhoto={photoUri ? handleViewPhoto : undefined}
          />

        </ScrollView>
        </BlurTargetView>

        <BottomActionBar variant="glass" blurTarget={blurTarget}>
          <Text style={styles.blockingHint}>
            {blockingReason || `${items.length} item${items.length === 1 ? '' : 's'} · ${totalUnits} unit${totalUnits === 1 ? '' : 's'} ready`}
          </Text>
          <Button
            title="Next"
            icon="arrowRight"
            iconPosition="right"
            onPress={handleNext}
            disabled={blockingReason !== null}
            variant="black"
            height={48}
            fontSize={16}
            borderRadius={24}
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
  contentTarget: { flex: 1 },
  content: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, gap: SPACING.md, paddingBottom: 48 },
  labelSpaced: { marginTop: SPACING.md, marginBottom: 0 },
  titleTextCol: { flexShrink: 1, flex: 1 },
  pageSubtitle: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
  },
  summaryPerson: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  summaryTextCol: { flex: 1 },
  summaryCaption: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  summaryName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
  },
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
    alignSelf: 'center',
    gap: 8,
    paddingHorizontal: SPACING.md,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EEF0FF',
  },
  summaryText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textPrimary,
  },
});
