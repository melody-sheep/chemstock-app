// src/screens/manager/AddNewBatchesScreen.js
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Header from '../../components/common/Header';
import SubScreenSecondaryHeader from '../../components/common/SubScreenSecondaryHeader';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

// Placeholder catalog — there's no products table yet, so this stands in
// for what would eventually be a Supabase-backed product search.
const MOCK_PRODUCTS = [
  { id: 'linx', name: 'Liniment X', batchNumber: 'BTNR-LINX-001', qty: 50, mfgDate: '05/20/2026', expDate: '05/20/2030', color: COLORS.accentOrange },
  { id: 'liny', name: 'Liniment Y', batchNumber: 'BTNR-LINY-001', qty: 60, mfgDate: '05/20/2026', expDate: '05/20/2030', color: COLORS.success },
  { id: 'bcrz', name: 'Beauty Cream Z', batchNumber: 'BTNR-BCRZ-001', qty: 40, mfgDate: '06/02/2026', expDate: '06/02/2029', color: COLORS.accentPink },
];

export default function AddNewBatchesScreen() {
  const [searchText, setSearchText] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [items, setItems] = useState([]);

  const handleDocumentPress = () => {
    Alert.alert('Ledger', 'The stock ledger is coming soon.');
  };

  const selectedIds = items.map((item) => item.id);
  const availableProducts = MOCK_PRODUCTS.filter((p) => !selectedIds.includes(p.id));
  const query = searchText.trim().toLowerCase();
  const suggestions = query
    ? availableProducts.filter((p) => p.name.toLowerCase().includes(query))
    : (showSuggestions ? availableProducts : []);

  const handleSelectProduct = (product) => {
    setItems((prev) => [...prev, { ...product, registeredQty: product.qty }]);
    setSearchText('');
    setShowSuggestions(false);
  };

  const handleRemoveProduct = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAdjustQty = (id, delta) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, registeredQty: Math.max(1, item.registeredQty + delta) } : item
      )
    );
  };

  const handleTakePhoto = () => {
    Alert.alert('Shipment Proof', 'Camera capture is coming soon (expo-camera, Sprint 2).');
  };

  const totalUnits = items.reduce((sum, item) => sum + item.registeredQty, 0);

  const handleSaveToPreview = () => {
    if (items.length === 0) {
      Alert.alert('No Products Selected', 'Search and add at least one product before saving.');
      return;
    }
    Alert.alert(
      'Save to Preview',
      `${items.length} item(s), ${totalUnits} units. Preview & backend save are coming soon.`
    );
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
            placeholder="Search product name"
            value={searchText}
            onChangeText={setSearchText}
            rightIcon={<Icon name="caretDown" size={18} color={COLORS.primary} weight="bold" />}
            onRightIconPress={() => setShowSuggestions((v) => !v)}
          />

          {suggestions.length > 0 && (
            <View style={styles.suggestionsBox}>
              {suggestions.map((product) => (
                <TouchableOpacity
                  key={product.id}
                  style={styles.suggestionRow}
                  onPress={() => handleSelectProduct(product)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.suggestionSwatch, { backgroundColor: product.color }]} />
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
              {items.map((item, index) => (
                <View key={item.id} style={styles.chip}>
                  <TouchableOpacity
                    style={styles.chipRemove}
                    onPress={() => handleRemoveProduct(item.id)}
                    accessibilityLabel={`Remove ${item.name}`}
                    accessibilityRole="button"
                  >
                    <Icon name="xCircle" size={18} color={COLORS.error} weight="fill" />
                  </TouchableOpacity>
                  <View style={[styles.chipThumb, { backgroundColor: item.color }]}>
                    <Text style={styles.chipNumber}>{index + 1}</Text>
                  </View>
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
                <View key={item.id} style={styles.itemRow}>
                  <View style={[styles.itemThumb, { backgroundColor: item.color }]} />
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemMeta}>Qty: {item.registeredQty}   BN: {item.batchNumber}</Text>
                    <View style={styles.itemDatesRow}>
                      <Icon name="calendar" size={12} color={COLORS.textSecondary} />
                      <Text style={styles.itemDateText}>Mfg: {item.mfgDate}</Text>
                      <Icon name="calendar" size={12} color={COLORS.error} />
                      <Text style={[styles.itemDateText, styles.itemDateTextExp]}>Exp: {item.expDate}</Text>
                    </View>
                  </View>
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => handleAdjustQty(item.id, -1)}
                      accessibilityLabel={`Decrease ${item.name} quantity`}
                    >
                      <Icon name="minus" size={14} color={COLORS.primary} />
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>{item.registeredQty}</Text>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => handleAdjustQty(item.id, 1)}
                      accessibilityLabel={`Increase ${item.name} quantity`}
                    >
                      <Icon name="plus" size={14} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.sectionTitle}>Shipment Proof (Handover)</Text>
          <TouchableOpacity style={styles.photoRow} onPress={handleTakePhoto} activeOpacity={0.7}>
            <View style={styles.photoIconBox}>
              <Icon name="camera" size={22} color={COLORS.primary} />
            </View>
            <Icon name="xCircle" size={16} color={COLORS.error} weight="fill" />
            <Text style={styles.photoText}>
              Take Photo of Waybill/Invoice <Text style={styles.requiredAsterisk}>*</Text>
            </Text>
          </TouchableOpacity>

          <Text style={styles.summaryText}>
            📦 {items.length} item{items.length === 1 ? '' : 's'}, {totalUnits} units
          </Text>

          <Button title="Save to Preview" onPress={handleSaveToPreview} />
        </ScrollView>
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
  suggestionSwatch: {
    width: 24,
    height: 24,
    borderRadius: 6,
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
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    padding: 4,
  },
  chipNumber: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    textAlign: 'center',
    lineHeight: 18,
    overflow: 'hidden',
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
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  itemThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
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
  itemMeta: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  itemDatesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  itemDateText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    marginRight: SPACING.xs,
  },
  itemDateTextExp: {
    color: COLORS.error,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 20,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 4,
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
