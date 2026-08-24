// src/screens/manager/AddNewBatchesScreen.js
import React, { useCallback, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SubScreenSecondaryHeader from '../../components/common/SubScreenSecondaryHeader';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import CameraCaptureModal from '../../components/common/CameraCaptureModal';
import SearchDropdownField from '../../components/common/SearchDropdownField';
import SelectedProductsRow from '../../components/common/SelectedProductsRow';
import RegisteredItemsList from '../../components/common/RegisteredItemsList';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { recordProductUsage } from '../../utils/productUsage';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';

const PLACEHOLDER_IMAGE = require('../../../assets/image/empty_box1.png');

export default function AddNewBatchesScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const [items, setItems] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [photoUri, setPhotoUri] = useState(null);
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [isViewingPhoto, setIsViewingPhoto] = useState(false);

  const handleDocumentPress = () => {
    Alert.alert('Ledger', 'The stock ledger is coming soon.');
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

  const handleAdjustQty = (code, delta) => {
    setItems((prev) =>
      prev.map((item) =>
        item.code === code ? { ...item, registeredQty: Math.max(1, item.registeredQty + delta) } : item
      )
    );
  };

  const handleDateChange = (code, field, value) => {
    setItems((prev) =>
      prev.map((item) => (item.code === code ? { ...item, [field]: value } : item))
    );
  };

  const handlePhotoCaptured = (uri) => {
    setPhotoUri(uri);
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
  const isFormComplete = items.length > 0 && !!photoUri;

  const handleSaveToPreview = () => {
    if (items.length === 0) {
      Alert.alert('No Products Selected', 'Search and add at least one product before saving.');
      return;
    }
    if (!photoUri) {
      Alert.alert('Photo Required', 'Take a photo of the waybill/invoice before saving.');
      return;
    }
    navigation.navigate('ReceiveStockPreview', { items, photoUri });
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

        <SubScreenSecondaryHeader title="Add New Batches" />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionTitle}>Search Product:</Text>
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

          <SelectedProductsRow items={items} onRemove={handleRemoveProduct} />

          <RegisteredItemsList items={items} onAdjustQty={handleAdjustQty} onDateChange={handleDateChange} />

          <Text style={styles.sectionTitle}>Shipment Proof (Handover)</Text>
          <View style={styles.photoRow}>
            <TouchableOpacity
              style={styles.photoRowMain}
              onPress={handleOpenCamera}
              activeOpacity={0.7}
              accessibilityLabel={photoUri ? 'Retake waybill/invoice photo' : 'Take photo of waybill/invoice'}
              accessibilityRole="button"
            >
              <View style={styles.photoIconBox}>
                <Icon name="camera" size={22} color={COLORS.primary} />
              </View>
              <Icon
                name={photoUri ? 'checkCircle' : 'xCircle'}
                size={26}
                color={photoUri ? COLORS.success : COLORS.error}
                weight="fill"
              />
              <Text style={styles.photoText}>
                Take Photo of{'\n'}Waybill/Invoice <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
            </TouchableOpacity>

            {photoUri && (
              <TouchableOpacity
                style={styles.viewPhotoBox}
                onPress={handleViewPhoto}
                activeOpacity={0.7}
                accessibilityLabel="View captured photo"
                accessibilityRole="button"
              >
                <Icon name="document" size={20} color={COLORS.textSecondary} />
                <Text style={styles.viewPhotoText}>view</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.summaryText}>
            📦 {items.length} item{items.length === 1 ? '' : 's'}, {totalUnits} units
          </Text>

          <Button
            title="Save to Preview"
            onPress={handleSaveToPreview}
            style={!isFormComplete ? styles.saveButtonDisabled : undefined}
          />
        </ScrollView>

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
  content: {
    padding: SPACING.lg,
    paddingBottom: 48,
    gap: SPACING.md,
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
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  photoRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    padding: SPACING.sm,
    backgroundColor: '#FFFFFF',
  },
  photoIconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
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
  viewPhotoBox: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  viewPhotoText: {
    marginTop: 2,
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
  },
  requiredAsterisk: {
    color: COLORS.error,
  },
  summaryText: {
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: '#272632',
  },
  saveButtonDisabled: {
    backgroundColor: '#555353',
  },
});
