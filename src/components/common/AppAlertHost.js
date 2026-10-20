// src/components/common/AppAlertHost.js
// Renders the messages sent through utils/appAlert, one at a time, as the
// app's own centered dialog. Mount once near the root (App.js).
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import CustomModal from './Modal';
import Button from './Button';
import Icon from './Icon';
import { subscribeAppAlerts, dismissAppAlert } from '../../utils/appAlert';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const BAD = /\b(fail|failed|error|invalid|denied|cannot|can't|couldn't|unable|not found|refused|missing|wrong|blocked|expired|too weak|already)\b/i;
// "Be careful" notices (not errors): an amber warning instead of the plain question mark.
const WARN = /\b(far|warning|careful|different|sure|discard|unsaved|leave|anyway)\b/i;
const GOOD = /\b(saved|success|submitted|sent|done|complete|completed|created|updated|released|received|accepted|registered|ready|thank)\b/i;

// What the message is about decides its icon and colour, so errors, successes
// and plain notices don't all look the same.
function toneOf(title, buttons) {
  if (buttons.some((b) => b.style === 'destructive')) return 'bad';
  if (BAD.test(title)) return 'bad';
  if (GOOD.test(title)) return 'good';
  if (WARN.test(title)) return 'warn';
  return 'info';
}

const TONES = {
  bad: { icon: 'warningTriangle', color: COLORS.error },
  good: { icon: 'checkCircle', color: COLORS.success },
  warn: { icon: 'warningTriangle', color: '#F59E0B' },
  info: { icon: 'question', color: COLORS.primary },
};

const DISTANCE = /(\b\d[\d.,]*\s?(?:km|m)\b)/;

// Bold the distances in a message so the number that matters is easy to spot.
function renderMessage(message, boldStyle) {
  return message.split(DISTANCE).map((part, index) =>
    index % 2 === 1 ? (
      <Text key={index} style={boldStyle}>
        {part}
      </Text>
    ) : (
      part
    )
  );
}

export default function AppAlertHost() {
  const [queue, setQueue] = useState([]);
  useEffect(() => subscribeAppAlerts(setQueue), []);

  const current = queue[0];
  if (!current) return null;

  const { id, title, message, buttons, cancelable, onDismiss } = current;
  const tone = TONES[toneOf(title, buttons)];
  const cancelButton = buttons.find((b) => b.style === 'cancel');
  const actions = buttons.filter((b) => b !== cancelButton);

  // Close first, then run the button — so a button that opens another
  // message or changes screen isn't fighting this dialog.
  const press = (button) => {
    dismissAppAlert(id);
    if (button?.onPress) setTimeout(() => button.onPress(), 0);
  };
  const dismiss = () => {
    if (!cancelable) return;
    dismissAppAlert(id);
    if (cancelButton?.onPress) setTimeout(() => cancelButton.onPress(), 0);
    else if (onDismiss) setTimeout(() => onDismiss(), 0);
  };

  return (
    <CustomModal visible onClose={dismiss} variant="center" closeOnBackdropPress={cancelable}>
      <View style={styles.iconWrap}>
        <View style={[styles.iconRing, { backgroundColor: tone.color + '14' }]}>
          <View style={[styles.iconCircle, { backgroundColor: tone.color + '26' }]}>
            <Icon name={tone.icon} size={28} color={tone.color} />
          </View>
        </View>
      </View>
      {!!title && <Text style={styles.title}>{title}</Text>}
      {!!message && <Text style={styles.message}>{renderMessage(message, styles.messageBold)}</Text>}

      {actions.map((button, index) => (
        <Button
          key={`${button.text}-${index}`}
          title={button.text || 'OK'}
          variant={button.style === 'destructive' ? 'fill' : 'black'}
          accentColor={button.style === 'destructive' ? COLORS.error : undefined}
          onPress={() => press(button)}
          height={48}
          fontSize={16}
          borderRadius={24}
          style={styles.fullWidth}
        />
      ))}
      {cancelButton && (
        <Button
          title={cancelButton.text || 'Cancel'}
          variant="outline"
          onPress={() => press(cancelButton)}
          height={48}
          fontSize={16}
          borderRadius={24}
          hasShadow={false}
          style={styles.fullWidth}
        />
      )}
    </CustomModal>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: 'center', marginBottom: SPACING.md },
  iconRing: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  message: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  messageBold: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  fullWidth: { width: '100%', marginBottom: SPACING.sm },
});
