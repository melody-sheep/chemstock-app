// src/screens/salesrep/ReturnStocksSR.js
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import Icon from '../../components/common/Icon';
import { TYPOGRAPHY } from '../../styles/typography';

const INITIAL_ITEMS = [
  {
    id: 'A',
    code: 'Product A Code Name',
    fullName: 'Product  A Full Product Name',
    dateGiven: 'mm - dd - yyyy',
    inCustody: 20,
    qty: 1,
    condition: 'salable',
  },
  {
    id: 'B',
    code: 'Product B Code Name',
    fullName: 'Product  B Full Product Name',
    dateGiven: 'mm - dd - yyyy',
    inCustody: 15,
    qty: 2,
    condition: 'salable',
  },
  {
    id: 'C',
    code: 'Product C Code Name',
    fullName: 'Product  C Full Product Name',
    dateGiven: 'mm - dd - yyyy',
    inCustody: 15,
    qty: 1,
    condition: 'damaged',
  },
];

export default function ReturnStocksSR() {
  const navigation = useNavigation();
  const [items, setItems] = useState(INITIAL_ITEMS);
  const [photoTaken, setPhotoTaken] = useState(false);

  const handleBack = () => navigation.goBack();

  const adjustQty = (id, delta) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, qty: Math.max(0, Math.min(item.inCustody, item.qty + delta)) }
          : item
      )
    );
  };

  const setCondition = (id, condition) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, condition } : item)));
  };

  const handleTakePhoto = () => {
    setPhotoTaken(true);
    Alert.alert('Photo Proof', 'This will open the camera to capture proof of the return batch.');
  };

  const handleSubmit = () => {
    if (!photoTaken) {
      Alert.alert('Photo Required', 'Please take a photo proof before submitting the return.');
      return;
    }
    Alert.alert('Return Submitted', 'A return manifest QR code has been generated and sent to the branch manager.');
  };

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable onPress={handleBack} style={styles.iconButton}>
            <Icon name="arrowLeft" size={20} color="#FFFFFF" />
          </Pressable>

          <Text style={styles.topBarTitle}>Return Stocks</Text>

          <View style={styles.iconButton}>
            <Icon name="document" size={20} color="#FFFFFF" />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.sectionHeaderPanel}>
            <Text style={styles.sectionLabel}>Active Return Batch</Text>
            <View style={styles.infoColumn}>
              <View style={styles.infoRowRounded}>
                <Text style={styles.infoLabel}>Batch ID</Text>
                <Text style={styles.infoValue}>RTN-2026-0522-IPN</Text>
              </View>
              <View style={styles.infoRowRounded}>
                <Text style={styles.infoLabel}>Target Branch</Text>
                <Text style={styles.infoValue}>Regency II, Iponan, CDO</Text>
              </View>
            </View>
          </View>

          <View style={styles.itemsList}>
            {items.map((item) => (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemTopRow}>
                  <View style={styles.thumbnail}>
                    <Icon name="package" size={26} color="#94a3b8" />
                  </View>

                  <View style={styles.itemDetails}>
                    <Text style={styles.itemCode} numberOfLines={1}>{item.code}</Text>
                    <Text style={styles.itemFullName} numberOfLines={1}>{item.fullName}</Text>
                    <Text style={styles.itemMeta}>Date given: {item.dateGiven}</Text>
                    <Text style={styles.itemMeta}>In Custody: {item.inCustody}</Text>
                  </View>
                </View>

                <View style={styles.controlRow}>
                  <View style={styles.counterGroup}>
                    <Pressable style={styles.counterButton} onPress={() => adjustQty(item.id, -1)}>
                      <Icon name="minus" size={14} color="#03045E" />
                    </Pressable>
                    <Text style={styles.counterValue}>{item.qty}</Text>
                    <Pressable style={styles.counterButton} onPress={() => adjustQty(item.id, 1)}>
                      <Icon name="plus" size={14} color="#03045E" />
                    </Pressable>
                  </View>

                  <View style={styles.conditionGroup}>
                    <Text style={styles.conditionLabel}>Condition:</Text>
                    <Pressable
                      style={[styles.conditionPill, item.condition === 'salable' && styles.conditionPillSalableActive]}
                      onPress={() => setCondition(item.id, 'salable')}
                    >
                      <Text style={[styles.conditionPillText, item.condition === 'salable' && styles.conditionPillTextSalableActive]}>
                        Salable
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.conditionPill, item.condition === 'damaged' && styles.conditionPillDamagedActive]}
                      onPress={() => setCondition(item.id, 'damaged')}
                    >
                      <Text style={[styles.conditionPillText, item.condition === 'damaged' && styles.conditionPillTextDamagedActive]}>
                        Damaged
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>

          <Pressable style={styles.photoCard} onPress={handleTakePhoto}>
            <Text style={styles.listTitle}>Photo Proof</Text>
            <View style={styles.photoPlaceholder}>
              <Icon name="camera" size={36} color="#03045E" />
              <Text style={styles.photoText}>
                {photoTaken ? 'Photo captured' : 'Tap to capture proof of return'}
              </Text>
            </View>
          </Pressable>

          <View style={styles.locationCard}>
            <View style={styles.locationRow}>
              <View style={styles.locationLeft}>
                <Icon name="location" size={18} color="#F04D59" />
                <Text style={styles.detailLabel}>GPS</Text>
              </View>
              <Text style={styles.detailValue}>14.5995°N, 120.9842°E</Text>
            </View>
            <View style={styles.locationRow}>
              <View style={styles.locationLeft}>
                <Icon name="package" size={18} color="#03045E" />
                <Text style={styles.detailLabel}>Branch</Text>
              </View>
              <Text style={styles.detailValue}>Regency II, Iponan</Text>
            </View>
            <View style={[styles.locationRow, styles.lastLocationRow]}>
              <View style={styles.locationLeft}>
                <Icon name="clock" size={18} color="#00B4D8" />
                <Text style={styles.detailLabel}>Time</Text>
              </View>
              <Text style={styles.detailValue}>May 20, 2024 | 02:30 PM</Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={styles.primaryButton} onPress={handleSubmit}>
            <Text style={styles.primaryButtonText}>Generate QR and Submit Return</Text>
          </Pressable>
        </View>
      </View>
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
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  sectionHeaderPanel: {
    backgroundColor: '#F7FEFF',
    borderWidth: 0.5,
    borderColor: '#4CF294',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 18,
  },
  sectionLabel: {
    fontSize: 18,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  infoColumn: {
    marginTop: 10,
    gap: 8,
  },
  infoRowRounded: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#EDEFF3',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  infoValue: {
    fontSize: 13,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  itemsList: {
    gap: 16,
    marginBottom: 18,
  },
  itemCard: {
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 14,
    padding: 12,
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
  itemMeta: {
    fontSize: 11,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 4,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    flexWrap: 'wrap',
    gap: 10,
  },
  counterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DBE4EE',
    borderRadius: 10,
    overflow: 'hidden',
  },
  counterButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F3F6',
  },
  counterValue: {
    minWidth: 32,
    textAlign: 'center',
    fontSize: 13,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  conditionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  conditionLabel: {
    fontSize: 11,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginRight: 2,
  },
  conditionPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DBE4EE',
    backgroundColor: '#FFFFFF',
  },
  conditionPillSalableActive: {
    backgroundColor: '#EAFBF2',
    borderColor: '#22C55E',
  },
  conditionPillDamagedActive: {
    backgroundColor: '#FBDCDC',
    borderColor: '#EF4444',
  },
  conditionPillText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    color: '#555353',
  },
  conditionPillTextSalableActive: {
    color: '#1E7A3A',
  },
  conditionPillTextDamagedActive: {
    color: '#B91C1C',
  },
  photoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAEFF5',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 18,
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
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoText: {
    marginTop: 8,
    color: '#555353',
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  locationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAEFF5',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  locationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  lastLocationRow: {
    borderBottomWidth: 0,
  },
  locationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    color: '#555353',
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  detailValue: {
    color: '#272632',
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
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
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
});
