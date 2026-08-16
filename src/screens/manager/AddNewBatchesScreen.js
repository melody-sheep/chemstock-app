// src/screens/manager/AddNewBatchesScreen.js
import React, { useState } from 'react';
import { View, Text, Image, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SubScreenSecondaryHeader from '../../components/common/SubScreenSecondaryHeader';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import CameraCaptureModal from '../../components/common/CameraCaptureModal';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const PLACEHOLDER_IMAGE = require('../../../assets/image/empty_box1.png');

export default function AddNewBatchesScreen() {
  const navigation = useNavigation();
  const [searchText, setSearchText] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [items, setItems] = useState([]);
  const [photoUri, setPhotoUri] = useState(null);
  const [isCameraVisible, setIsCameraVisible] = useState(false);

  const handleDocumentPress = () => {
    Alert.alert('Ledger', 'The stock ledger is coming soon.');
  };

  const selectedCodes = items.map((item) => item.code);
  const availableProducts = PRODUCT_CATALOG.filter((p) => !selectedCodes.includes(p.code));
  const query = searchText.trim().toLowerCase();
  const suggestions = query
    ? availableProducts.filter((p) => p.name.toLowerCase().includes(query) || p.code.toLowerCase().includes(query))
    : (showSuggestions ? availableProducts : []);

  const handleSelectProduct = (product) => {
    setItems((prev) => [...prev, { ...product, registeredQty: 1, mfgDate: '', expDate: '' }]);
    setSearchText('');
    setShowSuggestions(false);
  };

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

  const totalUnits = items.reduce((sum, item) => sum + item.registeredQty, 0);

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
          <Input
            icon="search"
            placeholder="Search product name or code"
            value={searchText}
            onChangeText={setSearchText}
            rightIcon={<Icon name="caretDown" size={18} color={COLORS.primary} weight="bold" />}
            onRightIconPress={() => setShowSuggestions((v) => !v)}
          />

          {suggestions.length > 0 && (
            <View style={styles.suggestionsBox}>
              {suggestions.map((product) => (
                <TouchableOpacity
                  key={product.code}
                  style={styles.suggestionRow}
                  onPress={() => handleSelectProduct(product)}
                  activeOpacity={0.7}
                >
                  <Image source={product.image || PLACEHOLDER_IMAGE} style={styles.suggestionThumb} resizeMode="cover" />
                  <Text style={styles.suggestionText}>{product.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.sectionTitle}>Selected Products</Text>
          {items.length === 0 ? (
            <Text style={styles.mutedText}>No products selected yet.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {items.map((item) => (
                <View key={item.code} style={styles.chip}>
                  <TouchableOpacity
                    style={styles.chipRemove}
                    onPress={() => handleRemoveProduct(item.code)}
                    accessibilityLabel={`Remove ${item.name}`}
                    accessibilityRole="button"
                  >
                    <Icon name="xCircle" size={18} color={COLORS.error} weight="fill" />
                  </TouchableOpacity>
                  <Image source={item.image || PLACEHOLDER_IMAGE} style={styles.chipThumb} resizeMode="cover" />
                  <Text style={styles.chipName} numberOfLines={1}>{item.name}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={styles.queueHeaderRow}>
            <Text style={styles.sectionTitle}>Items To Be Registered</Text>
            {items.length > 0 && <View style={styles.statusDot} />}
          </View>

          {items.length === 0 ? (
            <View style={styles.emptyItemsBox}>
              <Text style={styles.emptyItemsText}>Search and select products above to add them here</Text>
            </View>
          ) : (
            <View style={styles.itemsCard}>
              <View style={styles.itemsCardHeader}>
                <Text style={styles.itemsCardHeaderText}>List of Items</Text>
              </View>
              {items.map((item) => (
                <View key={item.code} style={styles.itemRow}>
                  <Image source={item.image || PLACEHOLDER_IMAGE} style={styles.itemThumb} resizeMode="cover" />
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <View style={styles.stepperInline}>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => handleAdjustQty(item.code, -1)}
                        accessibilityLabel={`Decrease ${item.name} quantity`}
                      >
                        <Icon name="minus" size={14} color={COLORS.primary} />
                      </TouchableOpacity>
                      <Text style={styles.stepperValue}>{item.registeredQty}</Text>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => handleAdjustQty(item.code, 1)}
                        accessibilityLabel={`Increase ${item.name} quantity`}
                      >
                        <Icon name="plus" size={14} color={COLORS.primary} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.itemDatesRow}>
                      <View style={styles.dateField}>
                        <Text style={styles.dateFieldLabel}>Mfg:</Text>
                        <TextInput
                          style={styles.dateFieldInput}
                          placeholder="MM/DD/YYYY"
                          placeholderTextColor="#B0B0B0"
                          value={item.mfgDate}
                          onChangeText={(text) => handleDateChange(item.code, 'mfgDate', text)}
                        />
                      </View>
                      <View style={styles.dateField}>
                        <Text style={[styles.dateFieldLabel, styles.dateFieldLabelExp]}>Exp:</Text>
                        <TextInput
                          style={styles.dateFieldInput}
                          placeholder="MM/DD/YYYY"
                          placeholderTextColor="#B0B0B0"
                          value={item.expDate}
                          onChangeText={(text) => handleDateChange(item.code, 'expDate', text)}
                        />
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

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
                <Icon name="camera" size={22} color={COLORS.primary} />
              </View>
              <Text style={styles.photoText}>
                Take Photo of Waybill/Invoice <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
            </TouchableOpacity>
          )}

          <Text style={styles.summaryText}>
            📦 {items.length} item{items.length === 1 ? '' : 's'}, {totalUnits} units
          </Text>

          <Button title="Save to Preview" onPress={handleSaveToPreview} />
        </ScrollView>

        <CameraCaptureModal
          visible={isCameraVisible}
          onClose={() => setIsCameraVisible(false)}
          onCapture={handlePhotoCaptured}
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
  mutedText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  chipsRow: {
    gap: SPACING.sm,
    paddingRight: SPACING.sm,
  },
  chip: {
    width: 90,
    alignItems: 'center',
  },
  chipRemove: {
    position: 'absolute',
    top: -6,
    right: 4,
    zIndex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
  },
  chipThumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  chipName: {
    marginTop: 4,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: '#272632',
    textAlign: 'center',
  },
  queueHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },
  emptyItemsBox: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderStyle: 'dashed',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    backgroundColor: '#FFFFFF',
  },
  emptyItemsText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: '#757575',
    textAlign: 'center',
  },
  itemsCard: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  itemsCardHeader: {
    backgroundColor: '#272632',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  itemsCardHeaderText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: '#FFFFFF',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  itemThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  stepperInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: 4,
  },
  stepperBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  stepperValue: {
    minWidth: 22,
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: '#272632',
  },
  itemDatesRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    paddingHorizontal: SPACING.xs,
  },
  dateFieldLabel: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
    marginRight: 4,
  },
  dateFieldLabelExp: {
    color: COLORS.error,
  },
  dateFieldInput: {
    flex: 1,
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: '#272632',
    paddingVertical: 6,
  },
  photoRow: {
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
  photoPreviewThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  photoPreviewInfo: {
    flex: 1,
  },
  photoRetakeText: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
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
});
