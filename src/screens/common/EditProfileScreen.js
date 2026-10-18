// src/screens/common/EditProfileScreen.js
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, ScrollView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Device from 'expo-device';
import Header from '../../components/common/Header';
import UserAvatar from '../../components/common/UserAvatar';
import CustomModal from '../../components/common/Modal';
import Icon from '../../components/common/Icon';
import PhilippinePhoneInput, {
  isValidPhNationalNumber,
  toPhE164,
  fromPhE164,
  formatPhDisplay,
} from '../../components/common/PhilippinePhoneInput';
import authService from '../../services/authService';
import profileService from '../../services/profileService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { SHADOWS } from '../../styles/shadows';
import friendlyError from '../../utils/friendlyError';
import { invalidateSavedData } from '../../utils/dataVersion';

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

const ROLE_PILL_COLORS = {
  manager: { backgroundColor: COLORS.primaryLight, color: COLORS.primary },
  sales_rep: { backgroundColor: '#FFE8F0', color: COLORS.accentPink },
  collector: { backgroundColor: '#FFF1E0', color: COLORS.accentOrange },
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
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [isPhoneModalVisible, setIsPhoneModalVisible] = useState(false);
  const [phoneDigits, setPhoneDigits] = useState('');
  const [phoneError, setPhoneError] = useState(null);

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
  const branchList = (user?.branchName || '').split(',').map((name) => name.trim()).filter(Boolean);

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
        Alert.alert('Update Failed', friendlyError(result.message) || 'Could not update your profile photo.');
        return;
      }

      // Every screen showing the old photo reloads, no log out needed.
      authService.clearCurrentUserCache();
      invalidateSavedData();
      await loadUser();
    } catch (error) {
      Alert.alert('Update Failed', friendlyError(error.message) || 'Could not update your profile photo.');
    } finally {
      setIsSaving(false);
    }
  };

  // Both sources open the phone's own crop screen, square because the
  // profile picture is shown as a circle.
  const CROP_OPTIONS = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 };

  const handleTakePhoto = async () => {
    setIsSourceModalVisible(false);

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'ChemStock needs camera access to take your profile picture.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync(CROP_OPTIONS);
    if (!result.canceled && result.assets?.[0]?.uri) {
      await savePhoto(result.assets[0].uri);
    }
  };

  const handlePickFromGallery = async () => {
    setIsSourceModalVisible(false);

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'ChemStock needs access to your photos to set your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync(CROP_OPTIONS);

    if (!result.canceled && result.assets?.[0]?.uri) {
      await savePhoto(result.assets[0].uri);
    }
  };

  const handleEditPhone = () => {
    setPhoneDigits(fromPhE164(user?.phoneNumber));
    setPhoneError(null);
    setIsPhoneModalVisible(true);
  };

  const handlePhoneChange = (digits) => {
    setPhoneDigits(digits);
    if (phoneError) setPhoneError(null);
  };

  const handleSavePhone = async () => {
    if (!user?.id || isSavingPhone) return;

    if (!isValidPhNationalNumber(phoneDigits)) {
      setPhoneError(
        phoneDigits.length === 0
          ? 'Phone number is required'
          : phoneDigits.length < 10
            ? `Enter all 10 digits (${phoneDigits.length}/10 so far)`
            : 'PH mobile numbers start with 9, e.g. 917 123 4567'
      );
      return;
    }

    setIsSavingPhone(true);

    try {
      const phoneNumber = toPhE164(phoneDigits);
      const result =
        user.role === 'manager'
          ? await profileService.updateManagerPhoneNumber({ phoneNumber })
          : await profileService.updateAgentPhoneNumber({ agentId: user.id, phoneNumber });

      if (!result.success) {
        Alert.alert('Update Failed', friendlyError(result.message) || 'Could not update your phone number.');
        return;
      }

      authService.clearCurrentUserCache();
      invalidateSavedData();
      setIsPhoneModalVisible(false);
      await loadUser();
    } catch (error) {
      Alert.alert('Update Failed', friendlyError(error.message) || 'Could not update your phone number.');
    } finally {
      setIsSavingPhone(false);
    }
  };

  const handleCancelPhone = () => setIsPhoneModalVisible(false);

  const roleLabel = ROLE_LABELS[user?.role] || user?.role || '';
  const roleIcon = ROLE_ICONS[user?.role] || 'idCard';
  const rolePillColors = ROLE_PILL_COLORS[user?.role] || { backgroundColor: '#EEF2FF', color: COLORS.primary };
  const hasPhoneNumber = !!user?.phoneNumber;

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
              <View style={[styles.rolePill, { backgroundColor: rolePillColors.backgroundColor }]}>
                <Text style={[styles.rolePillText, { color: rolePillColors.color }]}>{roleLabel}</Text>
              </View>

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
                  <View style={[styles.rowIconWrap, { backgroundColor: rolePillColors.backgroundColor }]}>
                    <Icon name={roleIcon} size={18} color={rolePillColors.color} />
                  </View>
                  <Text style={styles.rowLabel}>Role</Text>
                </View>
                <Text style={styles.rowValue} numberOfLines={1}>{roleLabel}</Text>
              </View>

              <View style={styles.rowDivider} />

              {branchList.length > 1 ? (
                // Several branches (managers): one chip each under the label,
                // instead of squeezing them all into the value column.
                <View style={styles.rowItemStacked}>
                  <View style={styles.rowLeft}>
                    <View style={styles.rowIconWrap}>
                      <Icon name="location" size={18} color="#F04D59" />
                    </View>
                    <Text style={styles.rowLabel}>Branches</Text>
                    <Text style={styles.rowCount}>{branchList.length}</Text>
                  </View>
                  <View style={styles.branchChips}>
                    {branchList.map((name) => (
                      <View key={name} style={styles.branchChip}>
                        <Text style={styles.branchChipText} numberOfLines={1}>{name}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : (
                <View style={styles.rowItem}>
                  <View style={styles.rowLeft}>
                    <View style={styles.rowIconWrap}>
                      <Icon name="location" size={18} color="#F04D59" />
                    </View>
                    <Text style={styles.rowLabel}>Branch</Text>
                  </View>
                  <Text style={styles.rowValue} numberOfLines={1}>
                    {branchList[0] || 'No branch assigned'}
                  </Text>
                </View>
              )}

              <View style={styles.rowDivider} />

              <Pressable
                style={styles.rowItem}
                onPress={handleEditPhone}
                accessibilityLabel="Edit phone number"
                accessibilityRole="button"
              >
                <View style={styles.rowLeft}>
                  <View style={styles.rowIconWrap}>
                    <Icon name="phone" size={18} color="#03045E" />
                  </View>
                  <Text style={styles.rowLabel}>Phone Number</Text>
                </View>

                <View style={styles.phoneEditTrigger}>
                  <Text
                    style={[styles.rowValue, !hasPhoneNumber && styles.rowValuePlaceholder]}
                    numberOfLines={1}
                  >
                    {hasPhoneNumber ? formatPhDisplay(user.phoneNumber) : 'Add phone number'}
                  </Text>
                  <Icon name="notePencil" size={15} color={COLORS.primary} />
                </View>
              </Pressable>
            </View>

            <View style={styles.noticeBox}>
              <View style={styles.noticeIconWrap}>
                <Icon name="lock" size={13} color="#94a3b8" />
              </View>
              <Text style={styles.noticeText}>
                Name, role, and branch are managed by your administrator — only your phone number can be edited here.
              </Text>
            </View>

            <View style={{ height: SPACING.xl }} />
          </ScrollView>
        )}
      </View>

      <CustomModal visible={isSourceModalVisible} onClose={() => setIsSourceModalVisible(false)} height="auto">
        <View style={styles.photoModalContent}>
          <View style={styles.phoneModalHandle} />
          <Pressable
            style={styles.phoneModalCloseBtn}
            onPress={() => setIsSourceModalVisible(false)}
            hitSlop={10}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <Icon name="xCircle" size={24} color="#94a3b8" />
          </Pressable>

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
        </View>
      </CustomModal>

      <CustomModal visible={isPhoneModalVisible} onClose={handleCancelPhone} height="auto">
        <View style={styles.phoneModalContent}>
          <View style={styles.phoneModalHandle} />
          <Pressable
            style={styles.phoneModalCloseBtn}
            onPress={handleCancelPhone}
            disabled={isSavingPhone}
            hitSlop={10}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <Icon name="xCircle" size={24} color="#94a3b8" />
          </Pressable>

          <View style={styles.phoneModalIconWrap}>
            <Icon name="phone" size={24} color={COLORS.primary} weight="fill" />
          </View>

          <Text style={styles.phoneModalTitle}>Edit Phone Number</Text>
          <Text style={styles.phoneModalSubtitle}>
            Enter your Philippine mobile number — it's used to reach you about deliveries.
          </Text>

          <View style={styles.phoneModalFieldOuter}>
            <PhilippinePhoneInput
              label={null}
              value={phoneDigits}
              onChangeText={handlePhoneChange}
              error={phoneError}
              style={styles.phoneModalFieldWrap}
            />
          </View>

          <View style={styles.phoneModalActions}>
            <Pressable
              style={[styles.phoneModalBtn, styles.phoneModalCancelBtn]}
              onPress={handleCancelPhone}
              disabled={isSavingPhone}
            >
              <Text style={styles.phoneModalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.phoneModalBtn, styles.phoneModalSaveBtn]}
              onPress={handleSavePhone}
              disabled={isSavingPhone}
            >
              {isSavingPhone ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.phoneModalSaveText}>Save Number</Text>
              )}
            </Pressable>
          </View>
        </View>
      </CustomModal>
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
  rolePill: {
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  rolePillText: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
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
    ...SHADOWS.cardSoft,
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
    flexShrink: 0,
    gap: 10,
  },
  rowItemStacked: {
    paddingVertical: 12,
    gap: 10,
  },
  rowCount: {
    minWidth: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#EEF2FF',
    color: COLORS.primary,
    fontSize: 11,
    textAlign: 'center',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  branchChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingLeft: 44,
  },
  branchChip: {
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FDEDEE',
  },
  branchChipText: {
    fontSize: 12,
    color: '#B4232F',
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: '600',
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
  rowValuePlaceholder: {
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: '600',
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
  phoneModalContent: { alignItems: 'center', paddingTop: 4 },
  phoneModalHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    marginBottom: 12,
  },
  phoneModalCloseBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    padding: 4,
  },
  phoneModalIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  phoneModalTitle: {
    marginTop: 14,
    fontSize: 18,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    textAlign: 'center',
  },
  phoneModalSubtitle: {
    marginTop: 4,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.sm,
    fontSize: 12,
    lineHeight: 17,
    color: '#94a3b8',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
  },
  phoneModalFieldOuter: {
    alignSelf: 'stretch',
  },
  phoneModalFieldWrap: {
    height: 52,
  },
  phoneModalActions: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  phoneModalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneModalCancelBtn: {
    backgroundColor: '#F1F3F6',
  },
  phoneModalCancelText: {
    fontSize: 14,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  phoneModalSaveBtn: {
    backgroundColor: COLORS.primary,
  },
  phoneModalSaveText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F7F9FC',
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 12,
    padding: 12,
  },
  noticeIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: '#EEF2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: '#94a3b8',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  photoModalContent: { paddingTop: 4 },
  modalTitle: {
    fontSize: 16,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 14,
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
