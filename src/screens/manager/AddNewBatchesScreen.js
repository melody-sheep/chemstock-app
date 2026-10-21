// src/screens/manager/AddNewBatchesScreen.js
import React, { useCallback, useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import Alert from '../../utils/appAlert';
import { StatusBar } from 'expo-status-bar';
import { BlurTargetView } from 'expo-blur';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import LiveStatusPill from '../../components/common/LiveStatusPill';
import SectionHeader from '../../components/common/SectionHeader';
import Icon from '../../components/common/Icon';
import Button from '../../components/common/Button';
import BottomActionBar, { useBottomActionBarHeight } from '../../components/common/BottomActionBar';
import CameraCaptureModal from '../../components/common/CameraCaptureModal';
import SearchDropdownField from '../../components/common/SearchDropdownField';
import SelectedProductsRow from '../../components/common/SelectedProductsRow';
import RegisteredItemsList from '../../components/common/RegisteredItemsList';
import ShipmentProofRow from '../../components/common/ShipmentProofRow';
import HintChip from '../../components/common/HintChip';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { recordProductUsage } from '../../utils/productUsage';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import { getItemsMissingDates } from '../../utils/batchItemValidation';
import KeyboardAwareScrollView from '../../components/common/KeyboardAwareScrollView';

const PLACEHOLDER_IMAGE = require('../../../assets/image/empty_box1.png');
const HEADER_HEIGHT = 76;

export default function AddNewBatchesScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const [items, setItems] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [photoUri, setPhotoUri] = useState(null);
  // GPS fix taken when the photo was captured, handed to the preview screen.
  const [photoCoords, setPhotoCoords] = useState(null);
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [isViewingPhoto, setIsViewingPhoto] = useState(false);
  const bottomActionBarHeight = useBottomActionBarHeight();
  const blurTarget = useRef(null);

  const handleDocumentPress = () => {
    navigation.navigate('StockLogs');
  };

  const selectedCodes = items.map((item) => item.code);

  const handleSelectProduct = (product) => {
    setItems((prev) => [...prev, { ...product, registeredQty: 1, mfgDate: '', expDate: '' }]);
    recordProductUsage(product.code);
  };

  const handleOpenProductBrowser = () => {
    navigation.navigate('ProductBrowser', { selectedCodes });
  };

  // Inline quick-pick suggestions as the manager types — a fast path for
  // when they already know the product name/code, alongside the dropdown
  // button which still opens the full ProductBrowser (stock levels,
  // frequently-added, sorting) for browsing instead of typing.
  const searchQuery = searchText.trim().toLowerCase();
  const suggestions = searchQuery
    ? PRODUCT_CATALOG.filter(
        (p) =>
          !selectedCodes.includes(p.code) &&
          (p.name.toLowerCase().includes(searchQuery) || p.code.toLowerCase().includes(searchQuery))
      )
    : [];

  const handleSelectSuggestion = (product) => {
    handleSelectProduct(product);
    setSearchText('');
  };

  // Picking up a product chosen on ProductBrowserScreen — it navigates back
  // here with `selectedProduct` in the route params rather than an inline
  // dropdown, so this screen never has to render the full catalog itself.
  useFocusEffect(
    useCallback(() => {
      if (route.params?.selectedProduct) {
        handleSelectProduct(route.params.selectedProduct);
        navigation.setParams({ selectedProduct: undefined });
      }
    }, [route.params?.selectedProduct])
  );

  const handleRemoveProduct = (code) => {
    setItems((prev) => prev.filter((item) => item.code !== code));
  };

  const handleSetQty = (code, qty) => {
    setItems((prev) =>
      prev.map((item) => (item.code === code ? { ...item, registeredQty: Math.max(1, qty) } : item))
    );
  };

  const handleDateChange = (code, field, value) => {
    setItems((prev) =>
      prev.map((item) => (item.code === code ? { ...item, [field]: value } : item))
    );
  };

  const handlePhotoCaptured = (uri, coords) => {
    setPhotoUri(uri);
    // Keep the previous fix if this shot didn't get one (still locating).
    if (coords) setPhotoCoords(coords);
  };

  const handleOpenCamera = () => {
    setIsViewingPhoto(false);
    setIsCameraVisible(true);
  };

  const handleViewPhoto = () => {
    setIsViewingPhoto(true);
    setIsCameraVisible(true);
  };

  const totalUnits = items.reduce((sum, item) => sum + item.registeredQty, 0);
  const hasIncompleteDates = getItemsMissingDates(items).length > 0;
  const isFormComplete = items.length > 0 && !!photoUri && !hasIncompleteDates;

  const handleSaveToPreview = () => {
    if (items.length === 0) {
      Alert.alert('No Products Selected', 'Search and add at least one product before saving.');
      return;
    }
    if (hasIncompleteDates) {
      Alert.alert('Set Item Dates', 'Every item needs both a Mfg and Exp date before saving.');
      return;
    }
    if (!photoUri) {
      Alert.alert('Photo Required', 'Take a photo of the waybill/invoice before saving.');
      return;
    }
    navigation.navigate('ReceiveStockPreview', { items, photoUri, coords: photoCoords });
  };

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton={true}
          backButtonText="Receive Factory Stock"
          showDocumentIcon={true}
          onDocumentPress={handleDocumentPress}
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
        />

        <SecondaryHeader height={HEADER_HEIGHT}>
          <View style={styles.titleRow}>
            <View style={styles.titleTextCol}>
              <Text style={styles.pageTitle} numberOfLines={1}>Add New Batches</Text>
              <Text style={styles.pageSubtitle}>Pick products, set dates, photo the waybill</Text>
            </View>
            <LiveStatusPill pillStyle={styles.onlinePill} dotStyle={styles.onlineDot} textStyle={styles.onlineText} />
          </View>
        </SecondaryHeader>

        <BlurTargetView ref={blurTarget} style={styles.contentTarget}>
        <KeyboardAwareScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomActionBarHeight + SPACING.md }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <HintChip id="receive-dates" text={"Pick the products, then tap the MFG and EXP chips on each item to set its dates. A waybill photo is required."} style={{ marginBottom: SPACING.md }} />
          <SectionHeader icon="package" size="md" label="Search product" style={styles.sectionHeaderFirst} />
          <SearchDropdownField
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search products"
            onButtonPress={handleOpenProductBrowser}
            buttonIcon="caretDown"
          />

          {suggestions.length > 0 && (
            <View style={styles.suggestionsBox}>
              {suggestions.map((product) => (
                <TouchableOpacity
                  key={product.code}
                  style={styles.suggestionRow}
                  onPress={() => handleSelectSuggestion(product)}
                  activeOpacity={0.7}
                >
                  <Image source={product.image || PLACEHOLDER_IMAGE} style={styles.suggestionThumb} resizeMode="cover" />
                  <Text style={styles.suggestionText}>{product.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Nothing to show until a product is picked (the list below already says so). */}
          {items.length > 0 && <SelectedProductsRow items={items} onRemove={handleRemoveProduct} labelHeader />}

          <RegisteredItemsList
            items={items}
            onSetQty={handleSetQty}
            onDateChange={handleDateChange}
            onRemove={handleRemoveProduct}
            labelHeader
            emptyText="Pick a product above to add it here."
          />

          <SectionHeader icon="camera" size="md" label="Waybill / invoice photo" style={styles.sectionHeaderSpaced} />
          <ShipmentProofRow
            photoUri={photoUri}
            onOpenCamera={handleOpenCamera}
            onViewPhoto={photoUri ? handleViewPhoto : undefined}
          />

          <View style={styles.summaryChip}>
            <Icon name="package" size={16} color={COLORS.primary} />
            <Text style={styles.summaryText}>
              {items.length} item{items.length === 1 ? '' : 's'} · {totalUnits} unit{totalUnits === 1 ? '' : 's'}
            </Text>
          </View>

        </KeyboardAwareScrollView>
        </BlurTargetView>

        <BottomActionBar variant="glass" blurTarget={blurTarget}>
          <Button
            title="Save & Review"
            onPress={handleSaveToPreview}
            height={48}
            fontSize={16}
            borderRadius={24}
            style={!isFormComplete ? styles.saveButtonDisabled : undefined}
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
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentTarget: { flex: 1 },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: 48,
    gap: SPACING.md,
  },
  // Each label sits well below the group before it and close above what it names.
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
  suggestionsBox: {
    marginTop: -SPACING.sm,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  suggestionThumb: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  suggestionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: '#272632',
  },
  summaryText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: '#272632',
  },
  saveButtonDisabled: {
    backgroundColor: '#555353',
  },
});
