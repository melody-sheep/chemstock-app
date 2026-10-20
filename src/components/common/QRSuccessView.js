// src/components/common/QRSuccessView.js
import React, { useRef } from 'react';
import { View, Text, ScrollView, Dimensions, StyleSheet } from 'react-native';
import { BlurTargetView } from 'expo-blur';
import Alert from '../../utils/appAlert';
import PropTypes from 'prop-types';
import Icon from './Icon';
import Button from './Button';
import SaveableQRCode from './SaveableQRCode';
import BottomActionBar, { useBottomActionBarHeight } from './BottomActionBar';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import friendlyError from '../../utils/friendlyError';

// Shared post-action success layout: check icon, title, the QR (compact, with the batch code on
// one line), a receipt card, and Share/Done fixed in a glass bar at the bottom so they never need
// a scroll. `hideQr` drops the QR code and Share button entirely (just the receipt + a full-width
// Done) — used where a role should see batch details without being able to pull up/share the
// batch's QR code.
export default function QRSuccessView({ title, subtitle, qrValue, receipt, onDone, hideQr = false }) {
  const qrRef = useRef(null);
  const blurTarget = useRef(null);
  const bottomActionBarHeight = useBottomActionBarHeight();
  const handleShare = async () => {
    try {
      await qrRef.current?.shareAsImage();
    } catch (error) {
      Alert.alert('Share Failed', friendlyError(error.message) || 'Could not share the QR code.');
    }
  };
  const halfButtonWidth = Math.floor((Dimensions.get('window').width - SPACING.lg * 2 - SPACING.sm) / 2);
  const fullButtonWidth = Dimensions.get('window').width - SPACING.lg * 2;

  return (
    <View style={styles.root}>
      <BlurTargetView ref={blurTarget} style={styles.contentTarget}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.screen, { paddingBottom: bottomActionBarHeight + SPACING.md }]}
          showsVerticalScrollIndicator={false}
        >
          <Icon name="successCircle" size={48} color={COLORS.success} duotoneColor={COLORS.success + '15'} weight="duotone" />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {!hideQr && <SaveableQRCode ref={qrRef} value={qrValue} size={156} compact style={styles.qrCard} />}

          <View style={styles.receiptCard}>
            {receipt.map((row, index) => (
              <React.Fragment key={row.label}>
                {index > 0 && <View style={styles.receiptDivider} />}
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>{row.label}</Text>
                  <Text style={styles.receiptValue}>{row.value}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        </ScrollView>
      </BlurTargetView>

      <BottomActionBar variant="glass" blurTarget={blurTarget}>
        <View style={styles.actionsRow}>
          {!hideQr && (
            <Button
              title="Share"
              variant="outline"
              accentColor={COLORS.primary}
              icon="send"
              iconSize={16}
              onPress={handleShare}
              width={halfButtonWidth}
              height={48}
              fontSize={15}
              borderRadius={24}
            />
          )}
          <Button
            title="Done"
            variant="black"
            icon="checkmark"
            iconSize={16}
            onPress={onDone}
            width={hideQr ? fullButtonWidth : halfButtonWidth}
            height={48}
            fontSize={15}
            borderRadius={24}
          />
        </View>
      </BottomActionBar>
    </View>
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
  hideQr: PropTypes.bool,
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  contentTarget: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  screen: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    gap: SPACING.xs,
  },
  title: {
    marginTop: SPACING.xs,
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    marginBottom: SPACING.xs,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  qrCard: {
    marginBottom: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  receiptCard: {
    width: '100%',
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
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
    backgroundColor: '#F0F0F0',
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
    flexDirection: 'row',
    gap: SPACING.sm,
  },
});
