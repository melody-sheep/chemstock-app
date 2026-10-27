// src/components/common/HintChip.js
// A small "how to use this" tip: a minimal glass strip (translucent, light border, square corners) with an
// icon, one short line and a small "Got it" button. Each tip shows until it is dismissed and is then
// remembered on this phone, so it never nags. resetHints() brings them all back (Settings → Show tips again).
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import Icon from './Icon';
import storage from '../../utils/storage';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const PREFIX = 'chemstock_hint_v1_';
const INDEX_KEY = 'chemstock_hint_v1_index';

// Every tip id that has been dismissed, so they can all be cleared at once.
const readIndex = async () => (await storage.get(INDEX_KEY)) || [];

export async function resetHints() {
  const ids = await readIndex();
  await Promise.all(ids.map((id) => storage.remove(PREFIX + id)));
  await storage.remove(INDEX_KEY);
  // The highlight tips (SpotlightHint, via useFirstTimeHint) keep their own list; bring those back too.
  await storage.remove('chemstock_seen_hints');
}

export default function HintChip({ id, text, icon = 'info', style }) {
  // null while the saved choice is being read, so a dismissed tip never flashes.
  const [visible, setVisible] = useState(null);

  useEffect(() => {
    let active = true;
    storage.get(PREFIX + id).then((dismissed) => {
      if (active) setVisible(!dismissed);
    });
    return () => {
      active = false;
    };
  }, [id]);

  const dismiss = async () => {
    setVisible(false);
    await storage.set(PREFIX + id, true);
    const ids = await readIndex();
    if (!ids.includes(id)) await storage.set(INDEX_KEY, [...ids, id]);
  };

  if (!visible) return null;

  return (
    <View style={[styles.chip, style]} accessibilityRole="text">
      <Icon name={icon} size={16} color="#0085F9" />
      <Text style={styles.text}>{text}</Text>
      <Pressable style={styles.button} onPress={dismiss} hitSlop={6} accessibilityRole="button" accessibilityLabel="Dismiss this tip">
        <Text style={styles.buttonText}>Got it</Text>
      </Pressable>
    </View>
  );
}

HintChip.propTypes = {
  id: PropTypes.string.isRequired,
  text: PropTypes.string.isRequired,
  icon: PropTypes.string,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

const styles = StyleSheet.create({
  // Square corners on purpose (no rounding), glass = translucent fill + light border + soft shadow.
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 8,
    paddingHorizontal: SPACING.sm,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    backgroundColor: 'rgba(234, 244, 255, 0.78)',
    shadowColor: '#0B3A66',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  text: { flex: 1, fontSize: 12, lineHeight: 16, color: '#1F3A5F', fontFamily: TYPOGRAPHY.fontFamily.regular },
  button: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#0085F9',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  buttonText: { fontSize: 11, color: '#0085F9', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
});
