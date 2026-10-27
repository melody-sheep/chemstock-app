// src/screens/salesrep/SalesRepSettingsScreen.js
import React, { useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Image } from 'react-native';
import Alert from '../../utils/appAlert';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../../components/common/Icon';
import Header from '../../components/common/Header';
import UserAvatar from '../../components/common/UserAvatar';
import BottomNavBar from '../../components/common/BottomNavBar';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import QRScannerModal from '../../components/common/QRScannerModal';
import authService from '../../services/authService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { routeQrScan } from '../../utils/routeQrScan';
import friendlyError from '../../utils/friendlyError';
import SettingsDeviceSection from '../../components/common/SettingsDeviceSection';
import { appVersionLabel } from '../../utils/appVersion';
import useOutbox from '../../hooks/useOutbox';

// Matches BottomNavBar's own fixed bar height — the ScrollView's bottom
// padding must clear that bar (plus its safe-area inset, which varies by
// device and is often taller in a built APK than in Expo Go) or the last
// row ends up hidden behind it instead of merely unscrolled-to.
const BOTTOM_NAV_HEIGHT = 76;

// One settings row: a coloured icon tile, the label, and a chevron (or a value on the right).
const LOGO = require('../../../assets/ChemStockLogo.png');

function SettingsRow({ icon, color, label, onPress, value, labelStyle, iconStyle, cardStyle, logo = false }) {
  const content = (
    <>
      <View style={styles.rowLeft}>
        <View style={[styles.rowIconWrap, { backgroundColor: color + '1A' }, logo && styles.rowIconWrapLogo]}>
          {logo ? (
            <Image source={LOGO} style={styles.rowLogo} resizeMode="contain" accessibilityLabel="ChemStock" />
          ) : (
            <Icon name={icon} size={18} color={color} style={iconStyle} />
          )}
        </View>
        <Text style={[styles.rowLabel, labelStyle]}>{label}</Text>
      </View>
      {value ? <Text style={styles.rowValue}>{value}</Text> : onPress ? <Icon name="arrowRight" size={16} color="#94a3b8" /> : null}
    </>
  );
  return onPress ? (
    <Pressable style={[styles.rowItem, cardStyle]} onPress={onPress} accessibilityRole="button">
      {content}
    </Pressable>
  ) : (
    <View style={[styles.rowItem, cardStyle]}>{content}</View>
  );
}

export default function SalesRepSettingsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState(null);
  // Items saved offline by this account, mentioned in the log-out dialog.
  const { pendingCount: unsyncedCount } = useOutbox(null, user?.id ?? null);
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  useFocusEffect(
    useCallback(() => {
      authService.getCurrentUser().then(setUser);
    }, [])
  );


  const handleTabPress = (key) => {
    if (key === 'dashboard') {
      navigation.navigate('SalesRepDashboard');
    } else if (key === 'stock') {
      navigation.navigate('SalesRepStock');
    } else if (key === 'reports') {
      navigation.navigate('SalesRepReports');
    } else if (key !== 'settings') {
      Alert.alert('Coming Soon', `${key.charAt(0).toUpperCase()}${key.slice(1)} isn't built yet.`);
    }
  };

  const handleScanned = async (qrCode) => {
    setIsScannerVisible(false);
    try {
      const currentAgent = await authService.getCurrentUser();
      await routeQrScan({ qrCode, agentId: currentAgent?.id, navigation });
    } catch (error) {
      Alert.alert('Unable to Verify QR', friendlyError(error.message) || 'Please try again.');
    }
  };

  const openLegalInfo = (type) => {
    navigation.navigate('LegalInfo', { type, role: 'salesrep' });
  };

  const handleLogout = () => setShowLogoutDialog(true);

  // A second tap while logging out is ignored.
  const isLoggingOut = useRef(false);
  const handleConfirmLogout = async () => {
    if (isLoggingOut.current) return;
    isLoggingOut.current = true;
    setShowLogoutDialog(false);
    try {
      await authService.logout();
    } finally {
      isLoggingOut.current = false;
    }
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const repName = user?.full_name || user?.username || 'Sales Representative';
  const branchName = user?.branchName || 'No branch assigned';
  const branchCount = (user?.branchIds || []).length;

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <Header
          title="Settings"
          titleAlign="left"
          height={56}
          backgroundColor={COLORS.primary}
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
        />

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: BOTTOM_NAV_HEIGHT + insets.bottom + SPACING.xl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            style={styles.profileBlock}
            onPress={() => navigation.navigate('EditProfile')}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
          >
            <UserAvatar photoUrl={user?.profilePhotoUrl} size={60} iconName="person" style={styles.avatarWrap} />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName} numberOfLines={1}>{repName}</Text>
              <Text style={styles.profileRole}>
                Sales Representative{branchCount > 0 ? ` · ${branchCount} branch${branchCount === 1 ? '' : 'es'}` : ''}
              </Text>
              <View style={styles.profileBranchRow}>
                <Icon name="location" size={13} color="#E5484D" />
                <Text style={styles.profileBranch} numberOfLines={2}>{branchName}</Text>
              </View>
            </View>
            <Icon name="arrowRight" size={16} color="#94a3b8" />
          </Pressable>

          <Text style={styles.sectionLabel}>Account</Text>
          <View style={styles.group}>
            <SettingsRow icon="profile" color="#0085F9" label="Edit Profile" onPress={() => navigation.navigate('EditProfile')} />
            <View style={styles.rowDivider} />
            <SettingsRow icon="lock" color="#D98200" label="Change Password" onPress={() => navigation.navigate('ChangePassword')} />
          </View>

          <Text style={styles.sectionLabel}>Device & Sending</Text>
          <SettingsDeviceSection agentId={user?.id} styles={styles} />

          <Text style={styles.sectionLabel}>About</Text>
          <View style={styles.group}>
            <SettingsRow icon="question" color="#7B6FE8" label="FAQ" onPress={() => openLegalInfo('faq')} />
            <View style={styles.rowDivider} />
            <SettingsRow icon="document" color="#4F5BD5" label="Laws" onPress={() => openLegalInfo('legal')} />
            <View style={styles.rowDivider} />
            <SettingsRow logo icon="checkCircle" color="#6B7280" label="App Version" value={appVersionLabel()} />
          </View>

          <View style={[styles.group, styles.logoutGroup]}>
            <SettingsRow
              icon="doorOpen"
              color="#D92D3A"
              label="Log Out"
              onPress={handleLogout}
              labelStyle={styles.logoutText}
              cardStyle={styles.logoutCard}
            />
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>

        <BottomNavBar activeTab="settings" onTabPress={handleTabPress} onFabPress={() => setIsScannerVisible(true)} fabLabel="Scan" />
      </View>

      <ConfirmationDialog
        visible={showLogoutDialog}
        onCancel={() => setShowLogoutDialog(false)}
        onConfirm={handleConfirmLogout}
        icon="lock"
        title="Log Out"
        description={
          unsyncedCount > 0
            ? `${unsyncedCount === 1 ? '1 item has not' : `${unsyncedCount} items have not`} been sent yet. It stays on this phone and sends automatically once you're online — you can log out safely.`
            : "You're about to log out of ChemStock. You'll need to sign in again to access your inventory."
        }
        confirmLabel="Log Out"
        variant="center"
      />

      <QRScannerModal
        visible={isScannerVisible}
        onClose={() => setIsScannerVisible(false)}
        onScanned={handleScanned}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: 96,
  },
  // No card boxes: the rows sit on the screen itself, split by thin lines.
  profileBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
    marginBottom: SPACING.xs,
  },
  avatarWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F1F3F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 3,
    borderColor: COLORS.primaryLight,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  profileRole: {
    fontSize: 13,
    color: '#0085F9',
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginTop: 2,
  },
  profileBranchRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginTop: 4,
  },
  profileBranch: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  sectionLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
    marginTop: SPACING.lg,
  },
  // groupCard keeps its name because SettingsDeviceSection reads it; it is just a plain container now.
  group: {},
  groupCard: {},
  logoutGroup: { marginTop: SPACING.lg },
  // Each row is its own card (white, thin outline), with a gap between them.
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 14,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  rowIconWrapLogo: { backgroundColor: '#EEF0FF', overflow: 'hidden' },
  rowLogo: { width: 56, height: 56 },
  rowIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleTextWrap: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  rowSubLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: '#6B7280',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  rowValue: {
    fontSize: 13,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  // Thin line that starts after the icon tile.
  rowDivider: { height: 0 },
  grantedPill: {
    backgroundColor: '#EAFBF2',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  grantedPillText: {
    fontSize: 11,
    color: '#1E7A3A',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  debugButton: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
    gap: 2,
  },
  debugText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
    textDecorationLine: 'underline',
  },
  debugHint: {
    fontSize: 11,
    color: COLORS.textTertiary,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
  },
  // A soft red card, so it reads as the leave-the-account button and is not tapped by mistake.
  logoutCard: {
    backgroundColor: '#FDECEE',
    borderColor: '#F6C4C9',
  },
  logoutText: {
    color: '#D92D3A',
  },
});
