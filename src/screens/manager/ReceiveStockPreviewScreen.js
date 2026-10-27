// src/screens/manager/ReceiveStockPreviewScreen.js
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, Dimensions } from 'react-native';
import Alert from '../../utils/appAlert';
import { StatusBar } from 'expo-status-bar';
import { BlurTargetView } from 'expo-blur';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import { getDeviceModel, getDeviceOs, getDeviceLabel } from '../../utils/deviceInfo';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import LiveStatusPill from '../../components/common/LiveStatusPill';
import SectionHeader from '../../components/common/SectionHeader';
import Button from '../../components/common/Button';
import BottomActionBar, { useBottomActionBarHeight } from '../../components/common/BottomActionBar';
import Icon from '../../components/common/Icon';
import SaveableQRCode from '../../components/common/SaveableQRCode';
import { getItemsMissingDates } from '../../utils/batchItemValidation';
import RegisteredItemsList from '../../components/common/RegisteredItemsList';
import CameraCaptureModal from '../../components/common/CameraCaptureModal';
import BranchSelector from '../../components/common/BranchSelector';
import SkeletonBlock from '../../components/ui/SkeletonBlock';
import authService from '../../services/authService';
import inventoryService from '../../services/inventoryService';
import requestService from '../../services/requestService';
import useScrolledToEnd from '../../hooks/useScrolledToEnd';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { formatCoordinates, formatDateTime } from '../../utils/formatters';
import friendlyError from '../../utils/friendlyError';
import KeyboardAwareScrollView from '../../components/common/KeyboardAwareScrollView';

const { width: screenWidth } = Dimensions.get('window');
const HALF_BUTTON_WIDTH = (screenWidth - SPACING.lg * 2 - SPACING.sm) / 2;

export default function ReceiveStockPreviewScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  // Editable, seeded from what AddNewBatchesScreen already collected — this
  // is still the pre-submit preview, so the manager can correct a mistake
  // (qty, dates, even retake the photo) without navigating all the way back.
  const [items, setItems] = useState(route.params.items);
  const [photoUri, setPhotoUri] = useState(route.params.photoUri);
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [isViewingPhoto, setIsViewingPhoto] = useState(false);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(null);

  const [manager, setManager] = useState(null);
  const [isLoadingManager, setIsLoadingManager] = useState(true);
  // Seeded with the fix taken on the camera screen, so this screen doesn't
  // locate the device again and make the manager wait.
  const [coords, setCoords] = useState(route.params.coords || null);
  const [locationError, setLocationError] = useState(null);
  const [capturedAt] = useState(() => new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [registeredAt, setRegisteredAt] = useState(null);
  const bottomActionBarHeight = useBottomActionBarHeight();
  const blurTarget = useRef(null);
  const scrollRef = useRef(null);
  const { hasReachedEnd, onScroll, onContentSizeChange, onLayout } = useScrolledToEnd();
  const qrRef = useRef(null);

  useEffect(() => {
    authService
      .getCurrentUser()
      .then(async (currentManager) => {
        setManager(currentManager);
        let managerBranches = await requestService.getAgentBranches(currentManager?.branchIds || []);
        // Older installs may have the manager profile cached but not the new
        // branch-record cache. A single assigned branch can still be safely
        // identified from the already-cached profile.
        if (
          managerBranches.length === 0 &&
          currentManager?.branchIds?.length === 1 &&
          currentManager.branchName
        ) {
          managerBranches = [{ id: currentManager.branchIds[0], name: currentManager.branchName }];
        }
        setBranches(managerBranches);
        // One branch is picked for the manager; several means they must choose.
        if (managerBranches.length === 1) setSelectedBranchId(managerBranches[0].id);
      })
      .catch((error) => {
        console.error('[ERROR] [ReceiveStockPreview] Failed to load manager:', error);
        setManager(null);
      })
      .finally(() => setIsLoadingManager(false));

    (async () => {
      // Already have a fix from the camera step — no need to locate again.
      if (route.params.coords) return;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('Location permission denied');
          return;
        }
        const position = await Location.getCurrentPositionAsync({});
        setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      } catch (error) {
        console.error('[ERROR] [ReceiveStockPreview] Location error:', error);
        setLocationError('Unable to determine location');
      }
    })();
  }, []);

  const totalUnits = items.reduce((sum, item) => sum + item.registeredQty, 0);
  const hasIncompleteDates = getItemsMissingDates(items).length > 0;
  const deviceLabel = getDeviceLabel(manager?.full_name || manager?.username);

  const selectedBranch = branches.find((b) => b.id === selectedBranchId);
  const assignedBranchCount = manager?.branchIds?.length || 0;
  const branchStatusText = isLoadingManager
    ? 'Loading branch…'
    : selectedBranch?.name ||
      (assignedBranchCount > 1 && branches.length === 0
        ? 'Branch names unavailable offline. Connect once to load them.'
        : branches.length > 1
          ? 'Choose a branch above'
          : assignedBranchCount === 0
            ? 'No branch assigned to your account'
            : 'Branch details unavailable');

  const handleSetQty = (code, qty) => {
    setItems((prev) =>
      prev.map((item) => (item.code === code ? { ...item, registeredQty: Math.max(1, qty) } : item))
    );
  };

  const handleDateChange = (code, field, value) => {
    setItems((prev) => prev.map((item) => (item.code === code ? { ...item, [field]: value } : item)));
  };

  const handleRemoveItem = (code) => {
    setItems((prev) => prev.filter((item) => item.code !== code));
  };

  const handlePhotoCaptured = (uri, newCoords) => {
    setPhotoUri(uri);
    if (newCoords) setCoords(newCoords);
  };

  const handleViewPhoto = () => {
    setIsViewingPhoto(true);
    setIsCameraVisible(true);
  };

  const handleReceiveAndGenerate = async () => {
    if (!manager) return;

    if (items.length === 0) {
      Alert.alert('No Products Left', 'You removed every item — add at least one before registering.');
      return;
    }
    if (hasIncompleteDates) {
      Alert.alert('Set Item Dates', 'Every item needs both a Mfg and Exp date before registering.');
      return;
    }
    if (!photoUri) {
      Alert.alert('Photo Required', 'Take a photo of the waybill/invoice before registering.');
      return;
    }
    if (!coords) {
      Alert.alert(
        locationError ? 'Location Unavailable' : 'Getting Your Location',
        locationError
          ? `${locationError}. Location is required to register a batch — check your device's location settings and try again.`
          : "Still locating your device — this only takes a moment. Try again in a second."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // The branch is chosen on this screen (or set automatically for one branch).
      const branchId = selectedBranchId;
      if (!branchId) {
        throw new Error('Choose which branch this batch is for.');
      }

      const storagePath = await inventoryService.uploadShipmentPhoto(photoUri, manager.id);

      const result = await inventoryService.receiveStockBatch({
        branchId,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        deviceModel: getDeviceModel(),
        deviceOs: getDeviceOs(),
        storagePath,
        items,
      });

      if (!result.success) {
        throw new Error(result.message);
      }

      setQrCode(result.data.qrCode);
      setRegisteredAt(new Date());
    } catch (error) {
      Alert.alert('Failed to Register Stock', friendlyError(error.message) || 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDone = () => {
    navigation.navigate('ManagerDashboard', undefined, { pop: true });
  };

  const handleShare = async () => {
    try {
      await qrRef.current?.shareAsImage();
    } catch (error) {
      console.error('[ERROR] [ReceiveStockPreview] Share failed:', error);
      Alert.alert('Share Failed', friendlyError(error.message) || 'Could not share the QR code.');
    }
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
          <BlurTargetView ref={blurTarget} style={styles.contentTarget}>
          <ScrollView
            contentContainerStyle={[styles.qrScreen, { paddingBottom: bottomActionBarHeight + SPACING.md }]}
            showsVerticalScrollIndicator={false}
          >
            <Icon
              name="successCircle"
              size={48}
              color={COLORS.success}
              duotoneColor={COLORS.success + '15'}
              weight="duotone"
            />
            <Text style={styles.qrTitle}>Stock Registered Successfully</Text>
            <Text style={styles.qrSubtitle}>Scan this code anytime to track the batch.</Text>

            <SaveableQRCode ref={qrRef} value={qrCode} size={156} compact style={styles.qrCard} />

            <SectionHeader icon="clipboardText" size="md" label="Batch Details" style={styles.detailsHeader} />

            <View style={styles.receiptCard}>
              <View style={styles.receiptRow}>
                <View style={styles.receiptLabelWrap}>
                  <Icon name="building" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.receiptLabel}>Branch</Text>
                </View>
                <Text style={styles.receiptValue} numberOfLines={1}>
                  {selectedBranch?.name || '—'}
                </Text>
              </View>
              <View style={styles.receiptDivider} />
              <View style={styles.receiptRow}>
                <View style={styles.receiptLabelWrap}>
                  <Icon name="package" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.receiptLabel}>Items</Text>
                </View>
                <Text style={styles.receiptValue}>
                  {items.length} item{items.length === 1 ? '' : 's'} · {totalUnits} unit{totalUnits === 1 ? '' : 's'}
                </Text>
              </View>
              <View style={styles.receiptDivider} />
              <View style={styles.receiptRow}>
                <View style={styles.receiptLabelWrap}>
                  <Icon name="calendar" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.receiptLabel}>Registered</Text>
                </View>
                <Text style={styles.receiptValue}>{formatDateTime(registeredAt)}</Text>
              </View>
            </View>

          </ScrollView>
          </BlurTargetView>

          <BottomActionBar variant="glass" blurTarget={blurTarget}>
            <View style={styles.actionsRow}>
              <Button
                title="Share"
                variant="outline"
                accentColor={COLORS.primary}
                icon="send"
                iconSize={16}
                onPress={handleShare}
                width={HALF_BUTTON_WIDTH}
                height={48}
                fontSize={15}
                borderRadius={24}
              />
              <Button
                title="Done"
                variant="black"
                icon="checkmark"
                iconSize={16}
                onPress={handleDone}
                width={HALF_BUTTON_WIDTH}
                height={48}
                fontSize={15}
                borderRadius={24}
              />
            </View>
          </BottomActionBar>
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

        <SecondaryHeader height={76}>
          <View style={styles.titleRow}>
            <View style={styles.titleTextCol}>
              <Text style={styles.pageTitle} numberOfLines={1}>Review & Generate QR</Text>
              <Text style={styles.pageSubtitle}>Check everything, then register the batch</Text>
            </View>
            <LiveStatusPill pillStyle={styles.onlinePill} dotStyle={styles.onlineDot} textStyle={styles.onlineText} />
          </View>
        </SecondaryHeader>

        <BlurTargetView ref={blurTarget} style={styles.contentTarget}>
        <KeyboardAwareScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.content, { paddingBottom: bottomActionBarHeight + SPACING.md }]}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          onContentSizeChange={onContentSizeChange}
          onLayout={onLayout}
          scrollEventThrottle={16}
        >
          {/* Heading shows straight away; chips appear once branches load. */}
          {(isLoadingManager || branches.length > 1 || assignedBranchCount > 1) && (
            <>
              <SectionHeader icon="building" size="md" label="Receive into which branch?" style={styles.sectionHeaderFirst} />
              {isLoadingManager ? (
                <View style={styles.branchSkeletonRow}>
                  <SkeletonBlock width={130} height={36} borderRadius={20} />
                  <SkeletonBlock width={150} height={36} borderRadius={20} />
                </View>
              ) : (
                branches.length > 0 ? (
                  <BranchSelector
                    branches={branches}
                    selectedId={selectedBranchId}
                    onSelect={setSelectedBranchId}
                    edgePadding={0}
                    scrollable
                    scrollBleed={SPACING.lg}
                  />
                ) : (
                  <Text style={styles.branchUnavailableText}>
                    Branch names aren&apos;t saved on this device yet. Connect to the internet once to load them.
                  </Text>
                )
              )}
            </>
          )}

          <RegisteredItemsList
            scrollRef={scrollRef}
            items={items}
            onSetQty={handleSetQty}
            onDateChange={handleDateChange}
            onRemove={handleRemoveItem}
            sectionTitle="Registered Items"
            labelHeader
            quantityLocked
            onEditQuantity={() => navigation.goBack()}
          />

          <SectionHeader icon="camera" size="md" label="Photo Proof" style={styles.sectionHeaderSpaced} />
          <View style={styles.photoProofCard}>
            <TouchableOpacity
              style={styles.photoProofImageWrap}
              onPress={handleViewPhoto}
              activeOpacity={0.85}
              accessibilityLabel="View full-size waybill/invoice photo"
              accessibilityRole="button"
            >
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photoProofImage} resizeMode="cover" />
              ) : (
                <View style={styles.photoProofEmpty}>
                  <Icon name="camera" size={28} color={COLORS.textSecondary} />
                </View>
              )}
              <View style={styles.expandBadge}>
                <Icon name="expand" size={14} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            <View style={styles.recipientRow}>
              <Text style={styles.recipientLabel}>From Factory to</Text>
              <Text style={styles.recipientName}>
                {manager?.full_name || manager?.username || 'You'}
              </Text>
            </View>

            <View style={styles.metaRow}>
              <Icon name="location" size={16} color={COLORS.error} />
              <Text style={styles.metaText}>
                {coords ? formatCoordinates(coords.latitude, coords.longitude) : locationError || 'Locating…'}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Icon name="home" size={20} color={COLORS.primary} />
              <Text style={styles.metaText}>{branchStatusText}</Text>
            </View>
            <View style={styles.metaRow}>
              <Icon name="package" size={16} color={COLORS.textSecondary} />
              <Text style={styles.metaText}>{deviceLabel}</Text>
            </View>
            <View style={styles.metaRow}>
              <Icon name="calendar" size={16} color={COLORS.textSecondary} />
              <Text style={styles.metaText}>{formatDateTime(capturedAt)}</Text>
            </View>

            <View style={styles.summaryChip}>
              <Icon name="package" size={16} color={COLORS.primary} />
              <Text style={styles.summaryText}>
                {items.length} item{items.length === 1 ? '' : 's'} · {totalUnits} unit{totalUnits === 1 ? '' : 's'}
              </Text>
            </View>
          </View>

        </KeyboardAwareScrollView>
        </BlurTargetView>

        <BottomActionBar variant="glass" blurTarget={blurTarget}>
          <Button
            title={
              isSubmitting
                ? 'Registering…'
                : !hasReachedEnd
                ? 'Scroll Down to Review'
                : !selectedBranchId
                ? 'Choose a Branch'
                : !coords
                ? locationError
                  ? 'Location Unavailable'
                  : 'Getting Your Location…'
                : 'Receive and Generate QR'
            }
            variant="black"
            onPress={handleReceiveAndGenerate}
            loading={isSubmitting}
            height={48}
            fontSize={16}
            borderRadius={24}
            disabled={
              isSubmitting ||
              !manager ||
              !selectedBranchId ||
              items.length === 0 ||
              hasIncompleteDates ||
              !hasReachedEnd ||
              !coords
            }
          />
        </BottomActionBar>

        <CameraCaptureModal
          visible={isCameraVisible}
          onClose={() => setIsCameraVisible(false)}
          onCapture={handlePhotoCaptured}
          initialUri={isViewingPhoto ? photoUri : null}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  contentTarget: { flex: 1 },
  content: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: 48, gap: SPACING.md },
  sectionHeaderFirst: { marginTop: SPACING.sm, marginBottom: 0 },
  sectionHeaderSpaced: { marginTop: SPACING.md, marginBottom: 0 },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
  },
  titleTextCol: { flexShrink: 1, flex: 1 },
  pageTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  pageSubtitle: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' },
  onlineText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.success,
  },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'center',
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EEF0FF',
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  photoProofCard: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  photoProofImageWrap: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
  },
  photoProofImage: {
    width: '100%',
    height: '100%',
  },
  photoProofEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandBadge: {
    position: 'absolute',
    bottom: SPACING.sm,
    right: SPACING.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: SPACING.xs,
  },
  recipientLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  recipientName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
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
  summaryText: {
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: '#272632',
  },
  qrScreen: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
    gap: SPACING.xs,
  },
  detailsHeader: { alignSelf: 'flex-start', marginTop: SPACING.xs, marginBottom: 0 },
  receiptLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qrTitle: {
    marginTop: SPACING.xs,
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
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  qrCard: {
    marginBottom: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  receiptCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  receiptDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  receiptLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  receiptValue: {
    flexShrink: 1,
    textAlign: 'right',
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: '#272632',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  branchSkeletonRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingTop: SPACING.sm,
  },
  branchUnavailableText: {
    paddingTop: SPACING.sm,
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
});
