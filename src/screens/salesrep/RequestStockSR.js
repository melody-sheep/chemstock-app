// src/screens/salesrep/RequestStockSR.js
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from '../../components/common/Icon';
import Input from '../../components/common/Input';
import CustomModal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import authService from '../../services/authService';
import inventoryService from '../../services/inventoryService';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../styles/typography';
import { STOCK_HEALTHY_THRESHOLD } from '../../constants/inventory';
import { PRODUCT_CATALOG } from '../../constants/productCatalog';

export default function RequestStockSR() {
  const navigation = useNavigation();
  const [searchText, setSearchText] = useState('');
  const [agent, setAgent] = useState(null);
  const [stock, setStock] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [activeProduct, setActiveProduct] = useState(null);
  const [modalQty, setModalQty] = useState(1);

  const loadStock = useCallback(async () => {
    setIsLoading(true);
    const currentAgent = await authService.getCurrentUser();
    setAgent(currentAgent);
    const result = await inventoryService.getSrInventory(currentAgent?.id);
    setStock(result.success ? result.data : []);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStock();
    }, [loadStock])
  );

  const handleBack = () => navigation.goBack();

  // Every catalog product gets bucketed by this rep's current sr_inventory
  // level (0 if they've never had it) — same "catalog minus what's on hand"
  // pattern ManagerStockScreen already uses for branch_inventory, just with
  // 3 buckets since "0 units" is a meaningful, requestable state here too.
  const qtyByCode = stock.reduce((map, row) => {
    map[row.product_code] = (map[row.product_code] || 0) + row.quantity;
    return map;
  }, {});

  const query = searchText.trim().toLowerCase();
  const visibleCatalog = PRODUCT_CATALOG.filter((product) => {
    if (!query) return true;
    return product.name.toLowerCase().includes(query) || product.code.toLowerCase().includes(query);
  });

  const healthy = visibleCatalog.filter((p) => (qtyByCode[p.code] || 0) >= STOCK_HEALTHY_THRESHOLD);
  const lowStock = visibleCatalog.filter((p) => {
    const qty = qtyByCode[p.code] || 0;
    return qty > 0 && qty < STOCK_HEALTHY_THRESHOLD;
  });
  const outOfStock = visibleCatalog.filter((p) => !(qtyByCode[p.code] > 0));

  const cartCount = cart.length;

  const openRequestModal = (product) => {
    const existing = cart.find((line) => line.productCode === product.code);
    setModalQty(existing?.quantity || 1);
    setActiveProduct(product);
  };

  const closeRequestModal = () => {
    setActiveProduct(null);
    setModalQty(1);
  };

  const handleSaveRequest = () => {
    if (!activeProduct || modalQty <= 0) return;
    setCart((prev) => {
      const withoutExisting = prev.filter((line) => line.productCode !== activeProduct.code);
      return [...withoutExisting, { productCode: activeProduct.code, productName: activeProduct.name, quantity: modalQty }];
    });
    closeRequestModal();
  };

  const handleViewRequestList = () => {
    if (cartCount === 0) return;
    navigation.navigate('RequestListSR', { items: cart });
  };

  const renderProductCard = (product) => {
    const qty = qtyByCode[product.code] || 0;
    const inCart = cart.find((line) => line.productCode === product.code);
    return (
      <TouchableOpacity
        key={product.code}
        style={[styles.productCard, inCart && styles.productCardInCart]}
        onPress={() => openRequestModal(product)}
        activeOpacity={0.7}
      >
        <View style={styles.thumbnailWrap}>
          <View style={styles.thumbnail}>
            <Icon name="package" size={22} color="#94a3b8" />
          </View>
          <View style={[styles.qtyBadge, qty === 0 && styles.qtyBadgeEmpty]}>
            <Text style={styles.qtyBadgeText}>{qty} pcs</Text>
          </View>
        </View>

        <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
        <Text style={styles.productMeta} numberOfLines={1}>Code: {product.code}</Text>

        {inCart ? (
          <View style={styles.inCartTag}>
            <Icon name="checkCircle" size={9} color={COLORS.primary} weight="fill" />
            <Text style={styles.inCartText}>Requesting {inCart.quantity}</Text>
          </View>
        ) : qty === 0 ? (
          <View style={styles.outOfStockTag}>
            <Icon name="xCircle" size={9} color="#B91C1C" />
            <Text style={styles.outOfStockText}>Out of Stock</Text>
          </View>
        ) : (
          <View style={styles.salableTag}>
            <View style={styles.salableDot} />
            <Text style={styles.salableText}>Tap to Request</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

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
            <Icon name="document" size={20} color="#FFFFFF" />
          </View>
        </View>

        <View style={styles.bannerBar}>
          <View>
            <Text style={styles.bannerTitle}>Request Stock</Text>
            <Text style={styles.bannerSubtitle}>Personal Inventory</Text>
          </View>
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Online</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.searchRow}>
            <View style={styles.searchInputWrap}>
              <Input icon="search" placeholder="Search products" value={searchText} onChangeText={setSearchText} />
            </View>
            <View style={styles.filterButtonWrap}>
              <Icon name="filter" size={20} color={COLORS.primary} />
            </View>
          </View>

          {isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : (
            <>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>In-Stocks (Healthy Levels)</Text>
                <View style={[styles.statusDotSmall, { backgroundColor: '#22C55E' }]} />
              </View>
              <View style={styles.cardGrid}>
                {healthy.length === 0 ? (
                  <Text style={styles.emptyStateText}>None right now.</Text>
                ) : (
                  healthy.map(renderProductCard)
                )}
              </View>

              <View style={[styles.sectionHeaderRow, styles.sectionSpacing]}>
                <Text style={styles.sectionTitle}>Almost Out of Stock (Resupply Soon)</Text>
                <View style={[styles.statusDotSmall, { backgroundColor: '#FF7800' }]} />
              </View>
              <View style={styles.cardGrid}>
                {lowStock.length === 0 ? (
                  <Text style={styles.emptyStateText}>None right now.</Text>
                ) : (
                  lowStock.map(renderProductCard)
                )}
              </View>

              <View style={[styles.sectionHeaderRow, styles.sectionSpacing]}>
                <Text style={styles.sectionTitle}>Out of Stock (Empty Shelves)</Text>
                <View style={[styles.statusDotSmall, { backgroundColor: '#EF4444' }]} />
              </View>
              <View style={styles.cardGrid}>
                {outOfStock.length === 0 ? (
                  <Text style={styles.emptyStateText}>None right now.</Text>
                ) : (
                  outOfStock.map(renderProductCard)
                )}
              </View>
            </>
          )}

          <View style={{ height: cartCount > 0 ? 48 : 24 }} />
        </ScrollView>

        {cartCount > 0 && (
          <Pressable style={styles.reviewBar} onPress={handleViewRequestList}>
            <Text style={styles.reviewBarText}>({cartCount}) View Request List</Text>
          </Pressable>
        )}
      </View>

      <CustomModal visible={!!activeProduct} onClose={closeRequestModal} height={340}>
        {activeProduct && (
          <View>
            <Text style={styles.modalTitle}>{activeProduct.name}</Text>
            <Text style={styles.modalSubtitle}>Code: {activeProduct.code}</Text>
            <Text style={styles.modalCurrentQty}>
              Currently on hand: {qtyByCode[activeProduct.code] || 0} pcs
            </Text>

            <Text style={styles.modalLabel}>Input Quantity:</Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => setModalQty((q) => Math.max(1, q - 1))}
                accessibilityLabel="Decrease quantity"
              >
                <Icon name="minus" size={16} color={COLORS.primary} />
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{modalQty}</Text>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => setModalQty((q) => q + 1)}
                accessibilityLabel="Increase quantity"
              >
                <Icon name="plus" size={16} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtonRow}>
              <Button title="Cancel" variant="outline" onPress={closeRequestModal} style={styles.modalButton} />
              <Button title="Save" variant="black" onPress={handleSaveRequest} style={styles.modalButton} />
            </View>
          </View>
        )}
      </CustomModal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  topBar: {
    height: 56,
    backgroundColor: '#03045E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  iconButton: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  topBarTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  bannerBar: {
    backgroundColor: '#EAFBF8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#D3F5EE',
  },
  bannerTitle: { color: '#272632', fontSize: 19, fontWeight: '700', fontFamily: TYPOGRAPHY.fontFamily.bold },
  bannerSubtitle: { color: '#555353', fontSize: 12, fontFamily: TYPOGRAPHY.fontFamily.regular, marginTop: 2 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#B7FFD6',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#00FF6E',
  },
  statusDot: { width: 7, height: 7, borderRadius: 999, backgroundColor: '#00FF6E', marginRight: 5 },
  statusText: { color: '#1D6A3A', fontSize: 10, fontWeight: '600', fontFamily: TYPOGRAPHY.fontFamily.bold },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 96 },
  loadingWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32, gap: 8 },
  emptyStateText: { fontSize: 12, color: '#555353', fontFamily: TYPOGRAPHY.fontFamily.regular },
  searchRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16 },
  searchInputWrap: { flex: 1 },
  filterButtonWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#757575',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7FEFF',
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionSpacing: { marginTop: 20 },
  sectionTitle: { fontSize: 15, color: '#272632', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  statusDotSmall: { width: 8, height: 8, borderRadius: 4 },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  productCard: {
    width: '47%',
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 14,
    padding: 10,
  },
  productCardInCart: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '08',
  },
  thumbnailWrap: { position: 'relative', marginBottom: 8 },
  thumbnail: {
    width: '100%',
    height: 72,
    borderRadius: 10,
    backgroundColor: '#F1F3F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#03045E',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  qtyBadgeEmpty: { backgroundColor: '#B91C1C' },
  qtyBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700', fontFamily: TYPOGRAPHY.fontFamily.bold },
  productName: { fontSize: 13, color: '#272632', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  productMeta: { fontSize: 10, color: '#555353', fontFamily: TYPOGRAPHY.fontFamily.regular, marginTop: 2 },
  inCartTag: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary + '15',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 4,
  },
  inCartText: { fontSize: 8, color: COLORS.primary, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  outOfStockTag: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FBDCDC',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 3,
  },
  outOfStockText: { fontSize: 8, color: '#B91C1C', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  salableTag: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EAFBF2',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 4,
  },
  salableDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
  salableText: { fontSize: 8, color: '#1E7A3A', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  reviewBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 48,
    backgroundColor: '#03045E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewBarText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', fontFamily: TYPOGRAPHY.fontFamily.bold },
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  modalSubtitle: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  modalCurrentQty: {
    marginTop: 8,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: '#272632',
  },
  modalLabel: {
    marginTop: 20,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    color: '#272632',
  },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 10 },
  stepperBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  stepperValue: {
    minWidth: 48,
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  modalButtonRow: { flexDirection: 'row', gap: 12, marginTop: 28 },
  modalButton: { flex: 1 },
});
