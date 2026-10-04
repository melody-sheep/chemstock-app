// src/components/common/QRSuccessView.js
import React, { useRef } from 'react';
import { View, Text, ScrollView, Alert, Dimensions, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import Icon from './Icon';
import Button from './Button';
import SaveableQRCode from './SaveableQRCode';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

// Shared post-action success layout: check icon, title, the QR, a receipt card, then Share/Done.
export default function QRSuccessView({ title, subtitle, qrValue, receipt, onDone }) {
  const qrRef = useRef(null);
  const handleShare = async () => {
    try {
      await qrRef.current?.shareAsImage();
    } catch (error) {
      Alert.alert('Share Failed', error.message || 'Could not share the QR code.');
    }
  };
  const halfButtonWidth = Math.floor((Dimensions.get('window').width - SPACING.lg * 2 - SPACING.sm) / 2);

  return (
    <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
      <Icon name="successCircle" size={64} color={COLORS.success} duotoneColor={COLORS.success + '15'} weight="duotone" />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      <SaveableQRCode ref={qrRef} value={qrValue} size={150} style={styles.qrCard} />

      <View style={styles.receiptCard}>
        {receipt.map((row, index) => (
          <React.Fragment key={row.label}>
            {index > 0 && <View style={styles.receiptDivider} />}
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>{row.label}</Text>
              <Text style={styles.receiptValue} numberOfLines={1}>{row.value}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>

      <View style={styles.actionsRow}>
        <Button
          title="Share"
          variant="outline"
          accentColor={COLORS.accentPurple}
          icon="send"
          iconSize={16}
          onPress={handleShare}
          width={halfButtonWidth}
          height={40}
          fontSize={14}
        />
        <Button
          title="Done"
          variant="black"
          icon="checkmark"
          iconSize={16}
          onPress={onDone}
          width={halfButtonWidth}
          height={40}
          fontSize={14}
        />
      </View>
    </ScrollView>
  );
}

QRSuccessView.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string.isRequired,
  qrValue: PropTypes.string.isRequired,
  receipt: PropTypes.arrayOf(
    PropTypes.shape({ label: PropTypes.string.isRequired, value: PropTypes.string.isRequired })
  ).isRequired,
  onDone: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xl,
    gap: SPACING.xs,
  },
  title: {
    marginTop: SPACING.xs,
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  qrCard: {
    marginTop: SPACING.sm,
  },
  receiptCard: {
    alignSelf: 'stretch',
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.textWhite,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  receiptDivider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
  },
  receiptLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  receiptValue: {
    flexShrink: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textPrimary,
    textAlign: 'right',
  },
  actionsRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
});
