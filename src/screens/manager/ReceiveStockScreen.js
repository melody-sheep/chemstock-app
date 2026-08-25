// src/screens/manager/ReceiveStockScreen.js
import React, { useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SubScreenSecondaryHeader from '../../components/common/SubScreenSecondaryHeader';
import Button from '../../components/common/Button';
import Icon from '../../components/common/Icon';
import LogListItem from '../../components/common/LogListItem';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

export default function ReceiveStockScreen() {
  const navigation = useNavigation();
  // Populated once a batch is actually saved from "Add New Batches" — no
  // cross-screen bridge wired yet, so this stays empty for now (see summary).
  const [queuedItems] = useState([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleDocumentPress = () => {
    Alert.alert('Ledger', 'The stock ledger is coming soon.');
  };

  const handleScanQR = () => {
    Alert.alert(
      'Scan QR',
      "Camera-based QR scanning is coming soon. This will let you scan the factory's QR code directly."
    );
  };

  const handleGenerateBatch = () => {
    navigation.navigate('AddNewBatches');
  };

  const hasQueuedItems = queuedItems.length > 0;

  const handleConfirmRegister = () => {
    if (!hasQueuedItems) {
      Alert.alert('No Items Yet', 'Scan a QR code or generate a new batch before registering.');
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleDialogConfirm = () => {
    setShowConfirmDialog(false);
    Alert.alert(
      'Registered',
      `${queuedItems.length} item(s) will be registered to this branch's inventory. (Backend wiring coming soon.)`
    );
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

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
              height={52}
              style={styles.orangeButton}
            />
          </View>

          <View style={styles.section}>
            <View style={styles.queueHeaderRow}>
              <Text style={styles.sectionTitle}>Scanned or Queued Items</Text>
              <Icon name="warningTriangle" size={16} color={COLORS.accentGold} />
            </View>

            {hasQueuedItems ? (
              <View style={styles.queueList}>
                {queuedItems.map((item) => (
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

          <Button
            title="Confirm & Register New Batch"
            variant="black"
            onPress={handleConfirmRegister}
          />
        </ScrollView>

        <ConfirmationDialog
          visible={showConfirmDialog}
          onCancel={() => setShowConfirmDialog(false)}
          onConfirm={handleDialogConfirm}
          icon="lock"
          title="Notice"
          description="You're about to register new batch of items to your branch inventory."
          confirmLabel="Confirm & Register"
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
