// src/screens/manager/ReceiveStockScreen.js
import React, { useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SubScreenSecondaryHeader from '../../components/common/SubScreenSecondaryHeader';
import Button from '../../components/common/Button';
import BottomActionBar, { useBottomActionBarHeight } from '../../components/common/BottomActionBar';
import Icon from '../../components/common/Icon';
import LogListItem from '../../components/common/LogListItem';
import QRScannerModal from '../../components/common/QRScannerModal';
import deliveryService from '../../services/deliveryService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import friendlyError from '../../utils/friendlyError';

export default function ReceiveStockScreen() {
  const navigation = useNavigation();
  // Collector returns confirmed by a scan on this screen, newest first. A
  // return is credited to branch stock the moment it is scanned, so this list
  // is a record of what was scanned, not a queue waiting to be registered.
  // New factory stock is registered through "Generate New Batch" instead.
  const [scannedReturns, setScannedReturns] = useState([]);
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const bottomActionBarHeight = useBottomActionBarHeight();

  const handleDocumentPress = () => {
    navigation.navigate('StockLogs');
  };

  const handleScanQR = () => {
    setIsScannerVisible(true);
  };

  // Today the only thing a scan here resolves to is a Collector's "Return
  // to Manager" QR (see 2026-10-13b_collector_return_to_manager.sql) —
  // confirming it credits the returned items back to branch stock. A QR
  // from any other flow (a factory batch, a delivery handoff) isn't
  // recognized here and just shows a clear message instead of erroring.
  const handleScanned = async (qrCode) => {
    setIsScannerVisible(false);
    const result = await deliveryService.confirmCollectorReturn(qrCode);

    if (!result.success) {
      // A return QR scanned a second time is recognized, just already used —
      // "QR Not Recognized" over that message read as a contradiction.
      const message = friendlyError(result.message) || 'This QR code is not a pending collector return.';
      const title = /already received/i.test(message) ? 'Already Received' : 'QR Not Recognized';
      Alert.alert(title, message);
      return;
    }

    const itemSummary = (result.data?.items || [])
      .map((item) => `${item.productName} x${item.quantity}`)
      .join(', ') || 'Items';
    setScannedReturns((previous) => [
      { key: `${qrCode}-${Date.now()}`, text: `Returned by Collector: ${itemSummary}` },
      ...previous,
    ]);
    Alert.alert('Return Confirmed', `${itemSummary} credited back to branch inventory.`);
  };

  const handleGenerateBatch = () => {
    navigation.navigate('AddNewBatches');
  };

  const hasScannedReturns = scannedReturns.length > 0;

  // Nothing on this screen is ever left waiting to be registered: a scanned
  // return is already in stock, and a new batch is registered from its own
  // preview screen. So this button only points the manager the right way.
  const handleConfirmRegister = () => {
    if (hasScannedReturns) {
      Alert.alert(
        'Nothing Left to Register',
        'The returns you scanned are already back in branch stock. To register a new shipment, tap Generate New Batch.'
      );
      return;
    }
    Alert.alert('No Items Yet', 'Scan a QR code or generate a new batch before registering.');
  };

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton={true}
          backButtonText="Manager Dashboard"
          showDocumentIcon={true}
          onDocumentPress={handleDocumentPress}
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
        />

        <SubScreenSecondaryHeader title="Receive Factory Stock" />

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomActionBarHeight + SPACING.md }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shipment Identification</Text>

            <TouchableOpacity style={styles.qrScanBox} onPress={handleScanQR} activeOpacity={0.7}>
              <Icon name="qrCodeDetailed" size={56} color={COLORS.textPrimary} />
              <Text style={styles.qrScanTitle}>Scan QR Code</Text>
              <Text style={styles.qrScanSubtext}>(For products that already have QR code)</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>No QR on Product?</Text>

            <Button
              title="Generate New Batch"
              icon="plus"
              iconWeight="bold"
              onPress={handleGenerateBatch}
              style={styles.orangeButton}
            />
          </View>

          <View style={styles.section}>
            <View style={styles.queueHeaderRow}>
              <Text style={styles.sectionTitle}>Scanned or Queued Items</Text>
              <Icon name="warningTriangle" size={16} color={COLORS.accentGold} />
            </View>

            {hasScannedReturns ? (
              <View style={styles.queueList}>
                {scannedReturns.map((item) => (
                  <LogListItem key={item.key} icon="trayDown" iconColor={COLORS.primary} text={item.text} />
                ))}
              </View>
            ) : (
              <View style={styles.emptyQueue}>
                <Text style={styles.emptyQueueText}>Scanned Items Displays Here!</Text>
                <Image
                  source={require('../../../assets/manager_assets/scanned_qr_man.png')}
                  style={styles.emptyQueueImage}
                  resizeMode="contain"
                />
              </View>
            )}
          </View>

        </ScrollView>

        <BottomActionBar>
          <Button
            title="Confirm & Register New Batch"
            variant="black"
            onPress={handleConfirmRegister}
          />
        </BottomActionBar>

        <QRScannerModal
          visible={isScannerVisible}
          onClose={() => setIsScannerVisible(false)}
          onScanned={handleScanned}
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
    paddingBottom: 40,
  },
  // Groups of closely-related controls sit close together (small gap);
  // the space BETWEEN groups is bigger, so sections read as distinct
  // instead of one long undifferentiated scroll of controls.
  section: {
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  qrScanBox: {
    minHeight: 180,
    borderWidth: 1.5,
    borderColor: '#757575',
    borderStyle: 'dotted',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    backgroundColor: '#FFFFFF',
  },
  qrScanTitle: {
    marginTop: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
  },
  qrScanSubtext: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    fontStyle: 'italic',
    color: COLORS.textSecondary,
  },
  orangeButton: {
    backgroundColor: COLORS.accentOrange,
  },
  queueHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  queueList: {
    gap: SPACING.sm,
  },
  emptyQueue: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingLeft: SPACING.md,
    paddingRight: SPACING.xs,
    backgroundColor: '#FFFFFF',
  },
  emptyQueueImage: {
    width: 112,
    height: 112,
  },
  emptyQueueText: {
    maxWidth: '55%',
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
    textAlign: 'left',
  },
});
