// src/screens/manager/ReceiveStockScreen.js
import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, StyleSheet } from 'react-native';
import Alert from '../../utils/appAlert';
import { StatusBar } from 'expo-status-bar';
import { BlurTargetView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import LiveStatusPill from '../../components/common/LiveStatusPill';
import SectionHeader from '../../components/common/SectionHeader';
import Button from '../../components/common/Button';
import BottomActionBar, { useBottomActionBarHeight } from '../../components/common/BottomActionBar';
import Icon from '../../components/common/Icon';
import LogCard from '../../components/common/LogCard';
import QRScannerModal from '../../components/common/QRScannerModal';
import deliveryService from '../../services/deliveryService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import friendlyError from '../../utils/friendlyError';

// Blue frame so the scan box reads as something you can tap.
const SCAN_BLUE = '#0085F9';
const SCAN_BLUE_TINT = '#EAF4FF';
const HEADER_HEIGHT = 76;

export default function ReceiveStockScreen() {
  const navigation = useNavigation();
  // Collector returns confirmed by a scan on this screen, newest first. A
  // return is credited to branch stock the moment it is scanned, so this list
  // is a record of what was scanned, not a queue waiting to be registered.
  // New factory stock is registered through "Generate New Batch" instead.
  const [scannedReturns, setScannedReturns] = useState([]);
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const bottomActionBarHeight = useBottomActionBarHeight();
  const blurTarget = useRef(null);

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
        'The returns you scanned are already back in branch stock. To register a new shipment, tap Add New Batch.'
      );
      return;
    }
    Alert.alert('No Items Yet', 'Scan a Collector return or add a new batch before registering.');
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

        <SecondaryHeader height={HEADER_HEIGHT}>
          <View style={styles.titleRow}>
            <View style={styles.titleTextCol}>
              <Text style={styles.pageTitle} numberOfLines={1}>Receive Factory Stock</Text>
              <Text style={styles.pageSubtitle}>Register new shipments and collector returns</Text>
            </View>
            <LiveStatusPill pillStyle={styles.onlinePill} dotStyle={styles.onlineDot} textStyle={styles.onlineText} />
          </View>
        </SecondaryHeader>

        <BlurTargetView ref={blurTarget} style={styles.contentTarget}>
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: bottomActionBarHeight + SPACING.md }]}
            showsVerticalScrollIndicator={false}
          >
            <SectionHeader icon="qrCode" size="md" label="Scan a Collector Return" style={styles.sectionHeaderFirst} />
            <TouchableOpacity style={styles.qrScanBox} onPress={handleScanQR} activeOpacity={0.7}>
              <Icon name="qrCode" size={56} color={SCAN_BLUE} />
              <Text style={styles.qrScanTitle}>Scan QR Code</Text>
              <Text style={styles.qrScanSubtext}>(For stock a Collector brings back)</Text>
            </TouchableOpacity>

            <SectionHeader icon="package" size="md" label="New Factory Shipment" style={styles.sectionHeaderSpaced} />
            <Button
              title="Add New Batch"
              icon="plus"
              iconWeight="bold"
              onPress={handleGenerateBatch}
              height={44}
              fontSize={14}
              borderRadius={22}
              style={styles.orangeButton}
            />

            <SectionHeader
              icon="trayDown"
              size="md"
              style={styles.sectionHeaderSpaced}
              label={hasScannedReturns ? `Scanned Returns (${scannedReturns.length})` : 'Scanned Returns'}
            />
            {hasScannedReturns ? (
              <View style={styles.queueList}>
                {scannedReturns.map((item) => {
                  // "Returned by Collector: Product x2, ..." -> title + details
                  const [cardTitle, ...rest] = item.text.split(': ');
                  return <LogCard key={item.key} type="receive" title={cardTitle} meta={rest.join(': ')} time="Just now" />;
                })}
              </View>
            ) : (
              <View style={styles.emptyQueue}>
                <Text style={styles.emptyQueueText}>Returns you scan will show here.</Text>
                <Image
                  source={require('../../../assets/manager_assets/scanned_qr_man.png')}
                  style={styles.emptyQueueImage}
                  resizeMode="contain"
                />
              </View>
            )}
          </ScrollView>
        </BlurTargetView>

        <BottomActionBar variant="glass" blurTarget={blurTarget}>
          <Button
            title="Confirm & Register New Batch"
            variant="black"
            onPress={handleConfirmRegister}
            height={48}
            fontSize={16}
            borderRadius={24}
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
  contentTarget: { flex: 1 },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  sectionHeaderFirst: { marginTop: SPACING.sm, marginBottom: SPACING.md },
  // Groups sit well apart; a label sits a little way above what it names.
  sectionHeaderSpaced: { marginTop: SPACING.xl, marginBottom: SPACING.md },
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
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  onlineText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.success,
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
    minHeight: 168,
    borderWidth: 1.5,
    borderColor: SCAN_BLUE,
    borderStyle: 'dotted',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    backgroundColor: SCAN_BLUE_TINT,
  },
  qrScanTitle: {
    marginTop: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.primary,
  },
  qrScanSubtext: {
    marginTop: SPACING.xs,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
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
    gap: SPACING.md,
  },
  emptyQueue: {
    minHeight: 124,
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
