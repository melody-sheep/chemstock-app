// src/screens/salesrep/ReceiveStockSR.js
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import Icon from '../../components/common/Icon';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const scannedItems = [
  { id: 'PE-2041', name: 'Paracetamol 500mg', qty: '20 boxes', status: 'Verified' },
  { id: 'AM-1098', name: 'Amoxicillin 250mg', qty: '12 boxes', status: 'Pending' },
  { id: 'OR-7882', name: 'Oral Rehydration Pack', qty: '8 sachets', status: 'Verified' },
];

export default function ReceiveStockSR() {
  const navigation = useNavigation();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleBack = () => navigation.goBack();

  const handleScanQR = () => {
    Alert.alert('Scan QR', 'This will activate the device QR scanner for the shipment.');
  };

  const handleCapturePhoto = () => {
    Alert.alert('Photo Proof', 'This will open the camera for a mandatory transfer photo.');
  };

  const handleConfirm = () => {
    setShowConfirmDialog(true);
  };

  const handleDialogConfirm = () => {
    setShowConfirmDialog(false);
    Alert.alert('Receipt Confirmed', 'The shipment has been recorded and synced for verification.');
  };

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Icon name="arrowLeft" size={20} color="#FFFFFF" />
          </Pressable>

          <Text style={styles.topBarTitle}>Receive Stock</Text>

          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Online</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.sectionHeaderPanel}>
            <View style={styles.labelRow}>
              <Text style={styles.sectionLabel}>Shipment Overview</Text>
            </View>

            <View style={styles.infoColumn}>
              <View style={styles.infoRowRounded}>
                <Text style={styles.infoLabel}>Batch ID</Text>
                <Text style={styles.infoValue}>SR-2309</Text>
              </View>
              <View style={styles.infoRowRounded}>
                <Text style={styles.infoLabel}>From</Text>
                <Text style={styles.infoValue}>Branch Danao</Text>
              </View>
              <View style={styles.infoRowRounded}>
                <Text style={styles.infoLabel}>ETA</Text>
                <Text style={styles.infoValue}>08:45 AM</Text>
              </View>
            </View>
          </View>

          <Pressable style={styles.scanButton} onPress={handleScanQR}>
            <View style={styles.scanIconWrap}>
              <Icon name="qrCode" size={26} color="#03045E" />
            </View>
            <View style={styles.scanTextWrap}>
              <Text style={styles.scanTitle}>Scan Shipment QR</Text>
              <Text style={styles.scanSubtitle}>Use the device scanner to validate the assigned stock batch.</Text>
            </View>
            <Icon name="arrowRight" size={18} color="#555353" />
          </Pressable>

          <View style={styles.titleRow}>
            <Text style={styles.listTitle}>Current Scanned Items</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{scannedItems.length}</Text>
            </View>
          </View>

          <View style={styles.listCard}>
            {scannedItems.map((item, index) => (
              <View
                key={item.id}
                style={[styles.listItemRow, index === scannedItems.length - 1 && styles.lastListItem]}
              >
                <View style={styles.itemLeft}>
                  <View style={styles.itemIconWrap}>
                    <Icon name="package" size={18} color="#03045E" />
                  </View>
                  <View>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemMeta}>{item.qty}</Text>
                  </View>
                </View>

                <View style={[styles.stateCapsule, item.status === 'Verified' ? styles.verified : styles.pending]}>
                  <Text style={[styles.stateText, item.status === 'Verified' ? styles.verifiedText : styles.pendingText]}>{item.status}</Text>
                </View>
              </View>
            ))}
          </View>

          <Pressable style={styles.photoCard} onPress={handleCapturePhoto}>
            <View style={styles.photoHeaderRow}>
              <Text style={styles.listTitle}>Photo Proof</Text>
              <View style={styles.requiredPill}>
                <Text style={styles.requiredText}>Required</Text>
              </View>
            </View>

            <View style={styles.photoPlaceholder}>
              <Icon name="camera" size={36} color="#03045E" />
              <Text style={styles.photoText}>Tap to capture proof of transfer</Text>
            </View>
          </Pressable>

          <View style={styles.locationCard}>
            <View style={styles.locationRow}>
              <View style={styles.locationLeft}>
                <Icon name="location" size={18} color="#F04D59" />
                <Text style={styles.detailLabel}>GPS Check</Text>
              </View>
              <Text style={styles.detailValue}>14.3456° N, 121.0123° E</Text>
            </View>

            <View style={styles.locationRow}>
              <View style={styles.locationLeft}>
                <Icon name="clock" size={18} color="#00B4D8" />
                <Text style={styles.detailLabel}>Time</Text>
              </View>
              <Text style={styles.detailValue}>08:41:12 AM</Text>
            </View>
          </View>

          <Pressable style={styles.primaryButton} onPress={handleConfirm}>
            <Text style={styles.primaryButtonText}>Confirm & Register Receipt</Text>
          </Pressable>
        </ScrollView>

        <ConfirmationDialog
          visible={showConfirmDialog}
          onCancel={() => setShowConfirmDialog(false)}
          onConfirm={handleDialogConfirm}
          icon="lock"
          title="Notice"
          description="You’re about to finalize this shipment receipt and save the delivery proof."
          confirmLabel="Confirm Receipt"
        />
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
    height: 42,
    backgroundColor: '#03045E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    borderBottomWidth: 2,
    borderBottomColor: '#03045E',
  },
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingTop: 8,
    paddingBottom: 32,
  },
  sectionHeaderPanel: {
    backgroundColor: '#F7FEFF',
    borderWidth: 0.5,
    borderColor: '#4CF294',
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 0,
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  scanButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DBE4EE',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 18,
  },
  scanIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EDEBFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  scanTextWrap: {
    flex: 1,
  },
  scanTitle: {
    fontSize: 16,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    marginBottom: 2,
  },
  scanSubtitle: {
    fontSize: 11,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  listTitle: {
    color: '#272632',
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  badge: {
    minWidth: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: '#03045E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 18,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  lastListItem: {
    borderBottomWidth: 0,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  itemName: {
    color: '#272632',
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  itemMeta: {
    color: '#555353',
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  stateCapsule: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  verified: {
    backgroundColor: '#EAFBF2',
  },
  pending: {
    backgroundColor: '#FFF5E7',
  },
  stateText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  verifiedText: {
    color: '#1E7A3A',
  },
  pendingText: {
    color: '#B26400',
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
  photoHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  requiredPill: {
    backgroundColor: '#FFF1F2',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  requiredText: {
    color: '#BE123C',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
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
    marginBottom: 18,
  },
  locationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
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
  primaryButton: {
    backgroundColor: '#03045E',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
});
