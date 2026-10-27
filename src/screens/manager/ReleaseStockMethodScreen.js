// src/screens/manager/ReleaseStockMethodScreen.js
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import Header from '../../components/common/Header';
import SecondaryHeader from '../../components/common/SecondaryHeader';
import LiveStatusPill from '../../components/common/LiveStatusPill';
import SectionHeader from '../../components/common/SectionHeader';
import UserAvatar from '../../components/common/UserAvatar';
import Icon from '../../components/common/Icon';
import Stepper from '../../components/common/Stepper';
import Button from '../../components/common/Button';
import QRScannerModal from '../../components/common/QRScannerModal';
import { getInitials } from '../../utils/initials';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const STEP_LABELS = ['Who receives the stock?', 'How many items?', 'Final Proof'];

// Blue frame so the scan box reads as something you can tap (as on Receive Stock).
const SCAN_BLUE = '#0085F9';
const SCAN_BLUE_TINT = '#EAF4FF';
const ROLE_LABEL = { collector: 'Collector', sales_rep: 'Sales Rep' };

export default function ReleaseStockMethodScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { recipient, targetRecipient, branchId, movementType } = route.params;
  const [isScannerVisible, setIsScannerVisible] = useState(false);

  const handleScanned = (qrCode) => {
    setIsScannerVisible(false);
    navigation.navigate('ReleaseStockScanReview', { recipient, targetRecipient, branchId, movementType, qrCode });
  };

  const handleQuickRegister = () => {
    navigation.navigate('QuickRegisterRelease', { recipient, targetRecipient, branchId, movementType });
  };

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton
          backButtonText="Give Out Stock"
          showDocumentIcon
          onDocumentPress={() => navigation.navigate('StockLogs')}
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
        />

        <SecondaryHeader height={76}>
          <View style={styles.titleRow}>
            <View style={styles.titleTextCol}>
              <Text style={styles.pageTitle} numberOfLines={1}>Choose a Batch</Text>
              <Text style={styles.pageSubtitle}>Scan its QR, or register new items</Text>
            </View>
            <LiveStatusPill pillStyle={styles.onlinePill} dotStyle={styles.onlineDot} textStyle={styles.onlineText} />
          </View>
        </SecondaryHeader>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Stepper currentStep={2} labels={STEP_LABELS} />

          {/* Who this release is for (already chosen on the last screen). */}
          <View style={styles.summaryCard}>
              <View style={styles.summaryPerson}>
                <UserAvatar
                  photoUrl={recipient.profilePhotoUrl}
                  fallbackText={getInitials(recipient.fullName)}
                  size={36}
                  backgroundColor={COLORS.primaryLight}
                  fallbackTextColor={COLORS.primary}
                />
                <View style={styles.summaryTextCol}>
                  <Text style={styles.summaryCaption}>{targetRecipient ? (ROLE_LABEL[recipient.role] || 'Recipient') : 'Releasing to'}</Text>
                  <Text style={styles.summaryName} numberOfLines={1}>{recipient.fullName}</Text>
                </View>
              </View>
            {targetRecipient && (
              <>
                <Icon name="arrowRight" size={16} color={COLORS.textSecondary} />
              <View style={styles.summaryPerson}>
                <UserAvatar
                  photoUrl={targetRecipient.profilePhotoUrl}
                  fallbackText={getInitials(targetRecipient.fullName)}
                  size={36}
                  backgroundColor={COLORS.primaryLight}
                  fallbackTextColor={COLORS.primary}
                />
                <View style={styles.summaryTextCol}>
                  <Text style={styles.summaryCaption}>Deliver to</Text>
                  <Text style={styles.summaryName} numberOfLines={1}>{targetRecipient.fullName}</Text>
                </View>
              </View>
              </>
            )}
          </View>

          <SectionHeader icon="qrCode" size="md" label="Scan a batch QR" style={styles.labelFirst} />
          <TouchableOpacity style={styles.scanBox} onPress={() => setIsScannerVisible(true)} activeOpacity={0.7}>
            <Icon name="qrCode" size={56} color={SCAN_BLUE} />
            <Text style={styles.scanTitle}>Scan QR Code</Text>
            <Text style={styles.scanSubtitle}>(For batches that already have a QR)</Text>
          </TouchableOpacity>

          <SectionHeader icon="package" size="md" label="No QR yet?" style={styles.labelSpaced} />
          <TouchableOpacity style={styles.urgentBox} onPress={handleQuickRegister} activeOpacity={0.7}>
            <Icon name="plus" size={18} color={COLORS.accentOrange} weight="bold" />
            <Text style={styles.urgentText}>Register New Items</Text>
          </TouchableOpacity>
          <Text style={styles.helperText}>Use this for items that are not in the system yet.</Text>
        </ScrollView>
      </View>

      <QRScannerModal
        visible={isScannerVisible}
        onClose={() => setIsScannerVisible(false)}
        onScanned={handleScanned}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
  },
  pageTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' },
  onlineText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.success,
  },
  titleTextCol: { flexShrink: 1, flex: 1 },
  pageSubtitle: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  content: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, gap: SPACING.sm, paddingBottom: 40 },
  labelFirst: { marginTop: SPACING.md, marginBottom: 0 },
  labelSpaced: { marginTop: SPACING.lg, marginBottom: 0 },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
  },
  summaryPerson: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  summaryTextCol: { flex: 1 },
  summaryCaption: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  summaryName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
  },
  helperText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  recipientNote: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  recipientName: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
    marginTop: SPACING.sm,
  },
  scanBox: {
    minHeight: 168,
    borderWidth: 1.5,
    borderColor: SCAN_BLUE,
    borderStyle: 'dotted',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    backgroundColor: SCAN_BLUE_TINT,
    marginTop: SPACING.sm,
  },
  scanTitle: {
    marginTop: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.primary,
  },
  scanSubtitle: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  urgentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.accentOrange + '14',
    borderWidth: 1,
    borderColor: COLORS.accentOrange + '66',
    marginTop: SPACING.sm,
  },
  urgentText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.accentOrange,
  },
});
