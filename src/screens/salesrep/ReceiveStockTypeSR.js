// src/screens/salesrep/ReceiveStockTypeSR.js
import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import Icon from '../../components/common/Icon';
import { TYPOGRAPHY } from '../../styles/typography';

export default function ReceiveStockTypeSR() {
  const navigation = useNavigation();

  const handleBack = () => navigation.goBack();

  const handleSelectType = (handoffType) => {
    navigation.navigate('ReceiveStockSR', { handoffType });
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
            <Icon name="document" size={20} color="#FFFFFF" weight="fill" />
          </View>
        </View>

        <View style={styles.summaryBar}>
          <View>
            <Text style={styles.summaryTitle}>Receive Stock</Text>
            <Text style={styles.summarySubtitle}>Handoff Verification</Text>
          </View>

          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Online</Text>
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.sectionHeading}>Select Handover Type:</Text>

          <View style={styles.card}>
            <View style={styles.cardTextBlock}>
              <View style={styles.bulletRow}>
                <View style={styles.bullet} />
                <Text style={styles.cardText}>Pick up directly from the main branch.</Text>
              </View>
            </View>

            <Image
              source={require('../../../assets/sales_rep_assets/receive_stock_manager_illustration.png')}
              style={styles.managerIllustration}
              resizeMode="stretch"
            />

            <Pressable
              style={[styles.optionButton, styles.managerButton]}
              onPress={() => handleSelectType('manager')}
            >
              <Text style={styles.optionButtonText}>Direct From Manager</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <View style={styles.cardTextBlock}>
              <View style={styles.bulletRow}>
                <View style={styles.bullet} />
                <Text style={styles.cardText}>A rider brought the batch to your zone.</Text>
              </View>
            </View>

            <Image
              source={require('../../../assets/sales_rep_assets/receive_stock_rider_illustration.png')}
              style={styles.riderIllustration}
              resizeMode="stretch"
            />

            <Pressable
              style={[styles.optionButton, styles.riderButton]}
              onPress={() => handleSelectType('rider')}
            >
              <Text style={styles.optionButtonText}>Via Collector Delivery</Text>
            </Pressable>
          </View>
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
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#00FF6E',
    marginRight: 5,
  },
  statusText: {
    color: '#1D6A3A',
    fontSize: 10,
    fontWeight: '600',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  sectionHeading: {
    fontSize: 18,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    marginBottom: 16,
  },
  card: {
    height: 150,
    borderRadius: 15,
    borderWidth: 0.5,
    borderColor: '#272632',
    backgroundColor: '#FFFFFF',
    marginBottom: 13,
    overflow: 'hidden',
    position: 'relative',
  },
  cardTextBlock: {
    position: 'absolute',
    left: 15,
    top: 14,
    width: 170,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bullet: {
    width: 8,
    height: 8,
    backgroundColor: '#272632',
    marginTop: 4,
    marginRight: 8,
  },
  cardText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  managerIllustration: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 183,
    height: 104,
  },
  riderIllustration: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 125,
    height: 125,
  },
  optionButton: {
    position: 'absolute',
    left: 15,
    bottom: 15,
    height: 47,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  managerButton: {
    backgroundColor: '#03045E',
    width: 164,
  },
  riderButton: {
    backgroundColor: '#FF005E',
    width: 166,
  },
  optionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
});
