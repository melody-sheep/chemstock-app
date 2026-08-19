// src/screens/salesrep/RequestStockSR.js
import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import Svg, { Circle, Path } from 'react-native-svg';
import Icon from '../../components/common/Icon';
import { TYPOGRAPHY } from '../../styles/typography';

const SearchIcon = ({ size = 16, color = '#555353' }) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <Circle cx="6.85" cy="6.85" r="5.85" stroke={color} strokeWidth="1" />
    <Path d="M10.69 10.69L14 14" stroke={color} strokeWidth="1" strokeLinecap="round" />
  </Svg>
);

const CATEGORIES = [
  {
    key: 'painFever',
    title: 'Pain & Fever Relief',
    products: [
      { id: 'PE-2041', name: 'Paracetamol 500mg', unit: 'Box of 20 tablets', status: 'low', qty: '6' },
      { id: 'IB-1102', name: 'Ibuprofen 200mg', unit: 'Box of 20 tablets', status: 'available', qty: '24' },
      { id: 'MA-3390', name: 'Mefenamic Acid 500mg', unit: 'Box of 10 tablets', status: 'available', qty: '18' },
    ],
  },
  {
    key: 'antibiotics',
    title: 'Antibiotics',
    products: [
      { id: 'AM-1098', name: 'Amoxicillin 250mg', unit: 'Box of 20 capsules', status: 'low', qty: '4' },
      { id: 'CF-2217', name: 'Cefalexin 500mg', unit: 'Box of 10 capsules', status: 'available', qty: '15' },
      { id: 'AZ-4456', name: 'Azithromycin 500mg', unit: 'Box of 6 tablets', status: 'available', qty: '12' },
    ],
  },
  {
    key: 'outOfStock',
    title: 'Out of Stock Items',
    products: [
      { id: 'OR-7882', name: 'Oral Rehydration Salts', unit: 'Pack of 10 sachets', status: 'out', qty: '0' },
      { id: 'LP-5521', name: 'Loperamide 2mg', unit: 'Box of 10 tablets', status: 'out', qty: '0' },
      { id: 'VC-6634', name: 'Vitamin C 500mg', unit: 'Bottle of 60 tablets', status: 'out', qty: '0' },
    ],
  },
];

const STATUS_META = {
  available: { label: 'Available', bg: '#F0FFF7', border: '#00FF6E', text: '#1D6A3A', dot: true },
  low: { label: 'Low Stock', bg: '#FFF6EE', border: '#FF7800', text: '#B26400', dot: false },
  out: { label: 'Out of Stock', bg: '#FFF3F3', border: '#FF0000', text: '#C81E1E', dot: false },
};

function ProductCard({ product }) {
  const status = STATUS_META[product.status];
  return (
    <View style={styles.card}>
      <Text style={styles.cardName} numberOfLines={2}>{product.name}</Text>
      <Text style={styles.cardUnit} numberOfLines={1}>{product.unit}</Text>

      <View style={styles.cardBottom}>
        <View style={[styles.statusPill, { backgroundColor: status.bg, borderColor: status.border }]}>
          {status.dot && <View style={[styles.statusDot, { backgroundColor: status.border }]} />}
          <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
        </View>

        <View style={styles.qtyRow}>
          <View style={[styles.qtyPill, { backgroundColor: status.bg, borderColor: status.border }]}>
            <Text style={[styles.qtyText, { color: status.text }]}>{product.qty}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function RequestStockSR() {
  const navigation = useNavigation();

  const handleBack = () => navigation.goBack();

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable onPress={handleBack} style={styles.iconButton}>
            <Icon name="arrowLeft" size={20} color="#FFFFFF" />
          </Pressable>

          <Text style={styles.topBarTitle}>Sales Rep Dashboard</Text>

          <View style={styles.iconButton}>
            <Icon name="document" size={20} color="#FFFFFF" weight="fill" />
          </View>
        </View>

        <View style={styles.summaryBar}>
          <View>
            <Text style={styles.summaryTitle}>Request Stock</Text>
            <Text style={styles.summarySubtitle}>Stock Availability</Text>
          </View>

          <View style={styles.statusPillHeader}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Online</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.searchRow}>
            <View style={styles.searchBar}>
              <SearchIcon size={16} color="#555353" />
              <Text style={styles.searchPlaceholder}>Search products</Text>
            </View>

            <Pressable style={styles.filterButton}>
              <Icon name="filter" size={18} color="#555353" />
            </Pressable>
          </View>

          {CATEGORIES.map((category) => (
            <View key={category.key} style={styles.categorySection}>
              <Text style={styles.categoryTitle}>{category.title}</Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cardRow}
              >
                {category.products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </ScrollView>
            </View>
          ))}
        </ScrollView>

        <Pressable style={styles.footerBar}>
          <Text style={styles.footerText}>Review Request</Text>
        </Pressable>
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
    paddingHorizontal: 18,
  },
  iconButton: {
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  summaryBar: {
    backgroundColor: '#F7FEFF',
    borderBottomWidth: 1,
    borderBottomColor: '#4CF294',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  summaryTitle: {
    fontSize: 20,
    color: '#03045E',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  summarySubtitle: {
    fontSize: 13,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  statusPillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#B7FFD6',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#00FF6E',
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#00FF6E',
    marginRight: 5,
  },
  onlineText: {
    color: '#1D6A3A',
    fontSize: 10,
    fontWeight: '600',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  content: {
    paddingTop: 20,
    paddingBottom: 110,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  searchBar: {
    flex: 1,
    height: 39,
    borderRadius: 9.5,
    borderWidth: 1,
    borderColor: '#555353',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginRight: 11,
  },
  searchPlaceholder: {
    marginLeft: 8,
    fontSize: 13,
    color: '#94A3B8',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  filterButton: {
    width: 39,
    height: 39,
    borderRadius: 9.5,
    borderWidth: 1,
    borderColor: '#555353',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categorySection: {
    marginBottom: 26,
  },
  categoryTitle: {
    fontSize: 16,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    marginBottom: 12,
    marginHorizontal: 16,
  },
  cardRow: {
    paddingLeft: 16,
    paddingRight: 2,
  },
  card: {
    width: 150,
    height: 180,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: '#555353',
    backgroundColor: '#FFFFFF',
    padding: 14,
    marginRight: 14,
  },
  cardName: {
    fontSize: 14,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    lineHeight: 18,
  },
  cardUnit: {
    fontSize: 11,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 4,
  },
  cardBottom: {
    marginTop: 'auto',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 18,
    borderRadius: 9.25,
    borderWidth: 0.5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  qtyRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  qtyPill: {
    minWidth: 43,
    height: 18,
    borderRadius: 5.5,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  qtyText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  footerBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#555353',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
});
