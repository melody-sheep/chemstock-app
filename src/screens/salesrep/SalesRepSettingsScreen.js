// src/screens/salesrep/SalesRepSettingsScreen.js
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Switch, Alert, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from '../../components/common/Icon';
import Header from '../../components/common/Header';
import UserAvatar from '../../components/common/UserAvatar';
import BottomNavBar from '../../components/common/BottomNavBar';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import authService from '../../services/authService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

export default function SalesRepSettingsScreen() {
  const navigation = useNavigation();
  const [user, setUser] = useState(null);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
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

  const handleLocationToggle = (value) => {
    if (!value) {
      Alert.alert(
        'Disable Location?',
        'Geotagging is required to confirm stock receipts and handovers. Disabling it will prevent you from completing transactions.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Disable Anyway', style: 'destructive', onPress: () => setLocationEnabled(false) },
        ]
      );
      return;
    }
    setLocationEnabled(true);
  };

  const handleComingSoon = (label) => {
    Alert.alert('Coming Soon', `${label} isn't built yet.`);
  };

  const handleLogout = () => setShowLogoutDialog(true);

  const handleConfirmLogout = async () => {
    setShowLogoutDialog(false);
    await authService.logout();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const repName = user?.full_name || user?.username || 'Sales Representative';
  const branchName = user?.branchName || 'No branch assigned';

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <Header
          title="Settings"
          titleAlign="left"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
        />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.profileCard}>
            <UserAvatar photoUrl={user?.profilePhotoUrl} size={56} iconName="person" style={styles.avatarWrap} />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName} numberOfLines={1}>{repName}</Text>
              <Text style={styles.profileRole}>Sales Representative</Text>
              <View style={styles.profileBranchRow}>
                <Icon name="location" size={12} color="#F04D59" />
                <Text style={styles.profileBranch} numberOfLines={1}>{branchName}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Account</Text>
          <View style={styles.groupCard}>
            <Pressable style={styles.rowItem} onPress={() => navigation.navigate('EditProfile')}>
              <View style={styles.rowLeft}>
                <View style={styles.rowIconWrap}>
                  <Icon name="idCard" size={18} color="#03045E" />
                </View>
                <Text style={styles.rowLabel}>Edit Profile</Text>
              </View>
              <Icon name="arrowRight" size={16} color="#94a3b8" />
            </Pressable>

            <View style={styles.rowDivider} />

            <Pressable style={styles.rowItem} onPress={() => handleComingSoon('Change Password')}>
              <View style={styles.rowLeft}>
                <View style={styles.rowIconWrap}>
                  <Icon name="lock" size={18} color="#03045E" />
                </View>
                <Text style={styles.rowLabel}>Change Password</Text>
              </View>
              <Icon name="arrowRight" size={16} color="#94a3b8" />
            </Pressable>
          </View>

          <Text style={styles.sectionLabel}>Privacy & Permissions</Text>
          <View style={styles.groupCard}>
            <View style={styles.rowItem}>
              <View style={styles.rowLeft}>
                <View style={styles.rowIconWrap}>
                  <Icon name="location" size={18} color="#F04D59" />
                </View>
                <View style={styles.toggleTextWrap}>
                  <Text style={styles.rowLabel}>Geotagging (GPS)</Text>
                  <Text style={styles.rowSubLabel}>Captured only at stock release and receipt confirmation.</Text>
                </View>
              </View>
              <Switch
                value={locationEnabled}
                onValueChange={handleLocationToggle}
                trackColor={{ false: '#D1D5DB', true: '#B7FFD6' }}
                thumbColor={locationEnabled ? '#03045E' : '#FFFFFF'}
              />
            </View>

            <View style={styles.rowDivider} />

            <View style={styles.rowItem}>
              <View style={styles.rowLeft}>
                <View style={styles.rowIconWrap}>
                  <Icon name="camera" size={18} color="#03045E" />
                </View>
                <View style={styles.toggleTextWrap}>
                  <Text style={styles.rowLabel}>Camera Access</Text>
                  <Text style={styles.rowSubLabel}>Required for QR scanning and photo handover proof.</Text>
                </View>
              </View>
              <View style={styles.grantedPill}>
                <Text style={styles.grantedPillText}>Granted</Text>
              </View>
            </View>

            <View style={styles.rowDivider} />

            <View style={styles.rowItem}>
              <View style={styles.rowLeft}>
                <View style={styles.rowIconWrap}>
                  <Icon name="notification" size={18} color="#03045E" />
                </View>
                <Text style={styles.rowLabel}>Push Notifications</Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: '#D1D5DB', true: '#B7FFD6' }}
                thumbColor={notificationsEnabled ? '#03045E' : '#FFFFFF'}
              />
            </View>
          </View>

          <Text style={styles.sectionLabel}>About</Text>
          <View style={styles.groupCard}>
            <Pressable style={styles.rowItem} onPress={() => handleComingSoon('Data Privacy Notice')}>
              <View style={styles.rowLeft}>
                <View style={styles.rowIconWrap}>
                  <Icon name="document" size={18} color="#03045E" />
                </View>
                <Text style={styles.rowLabel}>Data Privacy Notice (RA 10173)</Text>
              </View>
              <Icon name="arrowRight" size={16} color="#94a3b8" />
            </Pressable>

            <View style={styles.rowDivider} />

            <View style={styles.rowItem}>
              <View style={styles.rowLeft}>
                <View style={styles.rowIconWrap}>
                  <Icon name="checkCircle" size={18} color="#03045E" />
                </View>
                <Text style={styles.rowLabel}>App Version</Text>
              </View>
              <Text style={styles.rowValue}>1.0.0</Text>
            </View>
          </View>

          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <Icon name="arrowRight" size={18} color="#B91C1C" style={styles.logoutIcon} />
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>

          <View style={{ height: 24 }} />
        </ScrollView>

        <BottomNavBar activeTab="settings" onTabPress={handleTabPress} onFabPress={() => {}} />
      </View>

      <ConfirmationDialog
        visible={showLogoutDialog}
        onCancel={() => setShowLogoutDialog(false)}
        onConfirm={handleConfirmLogout}
        icon="lock"
        title="Log Out"
        description="You're about to log out of ChemStock. You'll need to sign in again to access your inventory."
        confirmLabel="Log Out"
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 96,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 14,
    padding: 12,
    marginBottom: 20,
  },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F1F3F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  profileRole: {
    fontSize: 12,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  profileBranchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  profileBranch: {
    fontSize: 11,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  sectionLabel: {
    fontSize: 13,
    color: '#94a3b8',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  groupCard: {
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 14,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: 10,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleTextWrap: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 13,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  rowSubLabel: {
    fontSize: 10,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  rowValue: {
    fontSize: 12,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#EEF2F7',
  },
  grantedPill: {
    backgroundColor: '#EAFBF2',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  grantedPillText: {
    fontSize: 10,
    color: '#1E7A3A',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FBDCDC',
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    height: 50,
    gap: 8,
  },
  logoutIcon: {
    transform: [{ rotate: '180deg' }],
  },
  logoutText: {
    color: '#B91C1C',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
});
