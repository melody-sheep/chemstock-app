// src/screens/common/EditProfileScreen.js
import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, ScrollView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Device from 'expo-device';
import Header from '../../components/common/Header';
import UserAvatar from '../../components/common/UserAvatar';
import CustomModal from '../../components/common/Modal';
import CameraCaptureModal from '../../components/common/CameraCaptureModal';
import Icon from '../../components/common/Icon';
import authService from '../../services/authService';
import profileService from '../../services/profileService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { SHADOWS } from '../../styles/shadows';

const ROLE_LABELS = {
  manager: 'Branch Manager',
  sales_rep: 'Sales Representative',
  collector: 'Collector',
};

const ROLE_ICONS = {
  manager: 'idCard',
  sales_rep: 'users',
  collector: 'truck',
};

/**
 * EditProfileScreen - one shared screen for all three roles (same
 * role-agnostic precedent as ComingSoonScreen), reached only from each
 * role's own Settings "Edit Profile" row. Only the profile photo is
 * editable — name/role/branch are plain read-only text, per Jay's explicit
 * instruction.
 */
export default function EditProfileScreen() {
  const navigation = useNavigation();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSourceModalVisible, setIsSourceModalVisible] = useState(false);
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('+63 917 123 4567');
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState('');

  const loadUser = useCallback(async () => {
    setIsLoading(true);
    const currentUser = await authService.getCurrentUser();
    setUser(currentUser);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUser();
    }, [loadUser])
  );

  const handleBack = () => navigation.goBack();

  const savePhoto = async (uri) => {
    if (!user?.id) return;
    setIsSaving(true);
    try {
      const storagePath = await profileService.uploadProfilePhoto(uri, user.id);

      const result =
        user.role === 'manager'
          ? await profileService.updateManagerProfilePhoto({
              storagePath,
              deviceModel: Device.modelName || null,
              deviceOs: Device.osName || null,
            })
          : await profileService.updateAgentProfilePhoto({
              agentId: user.id,
              storagePath,
              deviceModel: Device.modelName || null,
              deviceOs: Device.osName || null,
            });

      if (!result.success) {
        Alert.alert('Update Failed', result.message || 'Could not update your profile photo.');
        return;
      }

      await loadUser();
    } catch (error) {
      Alert.alert('Update Failed', error.message || 'Could not update your profile photo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTakePhoto = () => {
    setIsSourceModalVisible(false);
    setIsCameraVisible(true);
  };

  const handlePickFromGallery = async () => {
    setIsSourceModalVisible(false);

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'ChemStock needs access to your photos to set your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      await savePhoto(result.assets[0].uri);
    }
  };

  const handleEditPhone = () => {
    setPhoneDraft(phoneNumber);
    setIsEditingPhone(true);
  };

  const handleSavePhone = () => {
    setPhoneNumber(phoneDraft.trim() || phoneNumber);
    setIsEditingPhone(false);
  };

  const handleCancelPhone = () => setIsEditingPhone(false);

  const roleLabel = ROLE_LABELS[user?.role] || user?.role || '';
  const roleIcon = ROLE_ICONS[user?.role] || 'idCard';

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton
          title="Edit Profile"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
          paddingHorizontal={SPACING.md}
        />

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.heroCard}>
              <View style={styles.avatarWrap}>
                <UserAvatar photoUrl={user?.profilePhotoUrl} size={112} iconName="person" style={styles.avatarRing} />
                <Pressable
                  style={styles.cameraBadge}
                  onPress={() => setIsSourceModalVisible(true)}
                  disabled={isSaving}
                  accessibilityLabel="Change profile photo"
                  accessibilityRole="button"
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <View style={styles.cameraBadgeIcon}>
                      <Icon name="camera" size={16} color="#FFFFFF" weight="fill" />
                    </View>
                  )}
                </Pressable>
              </View>

              <Text style={styles.userName} numberOfLines={1}>
                {user?.full_name || user?.username || ''}
              </Text>
              <Text style={styles.userRole}>{roleLabel}</Text>

              <Pressable
                style={styles.changePhotoBtn}
                onPress={() => setIsSourceModalVisible(true)}
                disabled={isSaving}
              >
                <Text style={styles.changePhotoText}>Change Photo</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionLabel}>Profile Information</Text>
            <View style={styles.groupCard}>
              <View style={styles.rowItem}>
                <View style={styles.rowLeft}>
                  <View style={styles.rowIconWrap}>
                    <Icon name="idCard" size={18} color="#03045E" />
                  </View>
                  <Text style={styles.rowLabel}>Full Name</Text>
                </View>
                <Text style={styles.rowValue} numberOfLines={1}>
                  {user?.full_name || user?.username || '—'}
                </Text>
              </View>

              <View style={styles.rowDivider} />

              <View style={styles.rowItem}>
                <View style={styles.rowLeft}>
                  <View style={styles.rowIconWrap}>
                    <Icon name={roleIcon} size={18} color="#03045E" />
                  </View>
                  <Text style={styles.rowLabel}>Role</Text>
                </View>
                <Text style={styles.rowValue} numberOfLines={1}>{roleLabel}</Text>
              </View>

              <View style={styles.rowDivider} />

              <View style={styles.rowItem}>
                <View style={styles.rowLeft}>
                  <View style={styles.rowIconWrap}>
                    <Icon name="location" size={18} color="#F04D59" />
                  </View>
                  <Text style={styles.rowLabel}>Branch</Text>
                </View>
                <Text style={styles.rowValue} numberOfLines={1}>
                  {user?.branchName || 'No branch assigned'}
                </Text>
              </View>

              <View style={styles.rowDivider} />

              <View style={styles.rowItem}>
                <View style={styles.rowLeft}>
                  <View style={styles.rowIconWrap}>
                    <Icon name="phone" size={18} color="#03045E" />
                  </View>
                  {isEditingPhone ? (
                    <TextInput
                      style={styles.phoneInput}
                      value={phoneDraft}
                      onChangeText={setPhoneDraft}
                      keyboardType="phone-pad"
                      placeholder="Enter phone number"
                      placeholderTextColor="#94a3b8"
                      autoFocus
                    />
                  ) : (
                    <Text style={styles.rowLabel}>Phone Number</Text>
                  )}
                </View>

                {isEditingPhone ? (
                  <View style={styles.phoneEditActions}>
                    <Pressable
                      style={styles.phoneActionBtn}
                      onPress={handleCancelPhone}
                      accessibilityLabel="Cancel phone number edit"
                      accessibilityRole="button"
                    >
                      <Icon name="xCircle" size={18} color="#94a3b8" />
                    </Pressable>
                    <Pressable
                      style={styles.phoneActionBtn}
                      onPress={handleSavePhone}
                      accessibilityLabel="Save phone number"
                      accessibilityRole="button"
                    >
                      <Icon name="check" size={18} color={COLORS.success} weight="bold" />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    style={styles.phoneEditTrigger}
                    onPress={handleEditPhone}
                    accessibilityLabel="Edit phone number"
                    accessibilityRole="button"
                  >
                    <Text style={styles.rowValue} numberOfLines={1}>{phoneNumber}</Text>
                    <Icon name="notePencil" size={15} color="#03045E" />
                  </Pressable>
                )}
              </View>
            </View>

            <View style={styles.noticeBox}>
              <Icon name="lock" size={14} color="#94a3b8" />
              <Text style={styles.noticeText}>
                Name, role, and branch are managed by your administrator — only your phone number can be edited here.
              </Text>
            </View>

            <View style={{ height: SPACING.xl }} />
          </ScrollView>
        )}
      </View>

      <CustomModal visible={isSourceModalVisible} onClose={() => setIsSourceModalVisible(false)} height={260}>
        <Text style={styles.modalTitle}>Change Profile Photo</Text>

        <Pressable style={styles.modalOption} onPress={handleTakePhoto}>
          <View style={styles.modalOptionIconWrap}>
            <Icon name="camera" size={18} color="#03045E" />
          </View>
          <Text style={styles.modalOptionText}>Take Photo</Text>
          <Icon name="arrowRight" size={16} color="#94a3b8" />
        </Pressable>

        <View style={styles.rowDivider} />

        <Pressable style={styles.modalOption} onPress={handlePickFromGallery}>
          <View style={styles.modalOptionIconWrap}>
            <Icon name="grid" size={18} color="#03045E" />
          </View>
          <Text style={styles.modalOptionText}>Choose from Gallery</Text>
          <Icon name="arrowRight" size={16} color="#94a3b8" />
        </Pressable>
      </CustomModal>

      <CameraCaptureModal
        visible={isCameraVisible}
        onClose={() => setIsCameraVisible(false)}
        onCapture={(uri) => {
          setIsCameraVisible(false);
          savePhoto(uri);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
  },
  heroCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 16,
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
    ...SHADOWS.cardSoft,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: SPACING.md,
  },
  avatarRing: {
    borderWidth: 3,
    borderColor: COLORS.primaryLight,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  cameraBadgeIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.primary,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: 18,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  userRole: {
    fontSize: 13,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  changePhotoBtn: {
    marginTop: SPACING.md,
    paddingVertical: 8,
    paddingHorizontal: SPACING.md,
    borderRadius: 999,
    backgroundColor: COLORS.primaryLight,
  },
  changePhotoText: {
    fontSize: 13,
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
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
    backgroundColor: '#FFFFFF',
    marginBottom: SPACING.md,
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
  rowLabel: {
    fontSize: 13,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  rowValue: {
    flexShrink: 1,
    textAlign: 'right',
    fontSize: 12,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#EEF2F7',
  },
  phoneEditTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phoneInput: {
    flex: 1,
    fontSize: 13,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    paddingVertical: 0,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary,
  },
  phoneEditActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  phoneActionBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 4,
  },
  noticeText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: '#94a3b8',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  modalTitle: {
    fontSize: 16,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  modalOptionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOptionText: {
    flex: 1,
    fontSize: 15,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
});
