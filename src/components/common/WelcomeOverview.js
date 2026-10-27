// src/components/common/WelcomeOverview.js
// First login on a phone (per account): what this role can do in the app and what the phone has to allow,
// in one message, like the Manager gets after activating a branch. Shown once, then remembered.
// Kept compact on purpose: everything fits on a normal phone screen without scrolling (the scroll area
// stays only as a safety net for very small screens).
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import PropTypes from 'prop-types';
import CustomModal from './Modal';
import Button from './Button';
import Icon from './Icon';
import PermissionsCard from './PermissionsCard';
import storage from '../../utils/storage';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const TOOLS = {
  sales_rep: [
    { icon: 'trayDown', color: '#0085F9', bg: '#EAF4FF', title: 'Receive stock', hint: 'Scan the shown QR, then take photo proof' },
    { icon: 'notePencil', color: '#D98200', bg: '#FFF1D6', title: 'Request stock', hint: 'Ask your Manager for more of a product' },
    { icon: 'backpack', color: '#1E7A3A', bg: '#E1F4E8', title: 'Backpack and stock', hint: 'See what you carry and what is left' },
    { icon: 'clipboardText', color: '#7B6FE8', bg: '#EEEBFF', title: 'Daily report', hint: 'Report what you sold and handed back' },
    { icon: 'truck', color: '#E5366B', bg: '#FDEBF1', title: 'Track deliveries', hint: 'Follow a delivery on its way to you' },
  ],
  collector: [
    { icon: 'qrCode', color: '#0085F9', bg: '#EAF4FF', title: 'Accept deliveries', hint: "Scan the Manager's QR, then take photo proof" },
    { icon: 'truck', color: '#D98200', bg: '#FFF1D6', title: 'Deliver stock', hint: 'Start a trip and mark each stop delivered' },
    { icon: 'arrowUUpLeft', color: '#E5366B', bg: '#FDEBF1', title: 'Return to Manager', hint: 'Press and hold a delivery to send it back' },
    { icon: 'location', color: '#1E7A3A', bg: '#E1F4E8', title: 'Trip on the map', hint: 'Your route and stops show while you travel' },
  ],
};

export default function WelcomeOverview({ role, userId, name, onSettled }) {
  const [visible, setVisible] = useState(false);
  const { height } = useWindowDimensions();
  const key = `chemstock_welcome_v1_${role}_${userId}`;

  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    storage.get(key).then((seen) => {
      if (!active) return;
      if (!seen) setVisible(true);
      // Tells the screen whether the welcome is open, so a tour waits for it to close.
      onSettled?.(!seen);
    });
    return () => {
      active = false;
    };
  }, [key, userId]);

  const close = () => {
    setVisible(false);
    storage.set(key, true);
    onSettled?.(false);
  };

  const firstName = String(name || '').split(' ')[0];

  return (
    <CustomModal visible={visible} onClose={close} height="auto" maxHeight={Math.round(height * 0.92)} closeOnBackdropPress={false}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.ring}>
            <View style={styles.circle}>
              <Icon name="home" size={22} color="#0085F9" />
            </View>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>{firstName ? `Welcome, ${firstName}!` : 'Welcome!'}</Text>
            <Text style={styles.lead}>What you can do, and what your phone needs to allow.</Text>
          </View>
        </View>

        <Text style={styles.label}>WHAT YOU CAN DO</Text>
        {(TOOLS[role] || []).map((item) => (
          <View key={item.title} style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: item.bg }]}>
              <Icon name={item.icon} size={16} color={item.color} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowHint}>{item.hint}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.label}>PERMISSIONS NEEDED</Text>
        <PermissionsCard />
        <Text style={styles.note}>No signal? Your work is saved on this phone and sent when you are back online. You can change permissions any time in Settings.</Text>
      </ScrollView>
      <Button title="Get Started" variant="black" onPress={close} height={48} fontSize={16} borderRadius={24} width="100%" style={styles.button} />
    </CustomModal>
  );
}

WelcomeOverview.propTypes = {
  role: PropTypes.oneOf(['sales_rep', 'collector']).isRequired,
  userId: PropTypes.string,
  name: PropTypes.string,
  onSettled: PropTypes.func,
};

const styles = StyleSheet.create({
  scroll: { flexShrink: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  ring: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#0085F914', alignItems: 'center', justifyContent: 'center' },
  circle: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#0085F926', alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  title: { fontSize: TYPOGRAPHY.fontSize.lg, color: '#272632', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  lead: { marginTop: 2, fontSize: 12, color: COLORS.textSecondary, lineHeight: 16, fontFamily: TYPOGRAPHY.fontFamily.regular },
  label: { marginTop: 14, marginBottom: 4, fontSize: 11, letterSpacing: 0.8, color: '#6B7280', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  rowIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowTitle: { fontSize: TYPOGRAPHY.fontSize.sm, color: '#272632', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  rowHint: { marginTop: 1, fontSize: 12, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.regular },
  note: { marginTop: SPACING.sm, fontSize: 11, color: COLORS.textSecondary, lineHeight: 15, fontFamily: TYPOGRAPHY.fontFamily.regular },
  button: { marginTop: SPACING.sm },
});
