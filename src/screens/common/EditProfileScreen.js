// src/screens/common/EditProfileScreen.js
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, StyleSheet, Linking } from 'react-native';
import Alert from '../../utils/appAlert';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Device from 'expo-device';
import Header from '../../components/common/Header';
import UserAvatar from '../../components/common/UserAvatar';
import CustomModal from '../../components/common/Modal';
import ImageViewerModal from '../../components/common/ImageViewerModal';
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
import friendlyError from '../../utils/friendlyError';
import { invalidateSavedData } from '../../utils/dataVersion';
import { getDeviceOs } from '../../utils/deviceInfo';

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
  const [managerContact, setManagerContact] = useState(null);
  const [isLoadingManager, setIsLoadingManager] = useState(false);
  const [managerContactError, setManagerContactError] = useState(false);
  const [isManagerModalVisible, setIsManagerModalVisible] = useState(false);
  const [isProfilePhotoPreviewVisible, setIsProfilePhotoPreviewVisible] = useState(false);

  const loadManagerContact = useCallback(async (agentId) => {
    setIsLoadingManager(true);
    setManagerContactError(false);
    const result = await profileService.getAgentManagerContact(agentId);
    if (result.success) {
      setManagerContact(result.data || null);
    } else {
      setManagerContact(null);
      setManagerContactError(true);
    }
    setIsLoadingManager(false);
  }, []);

  const loadUser = useCallback(async () => {
    setIsLoading(true);
    const currentUser = await authService.getCurrentUser();
    setUser(currentUser);
    setIsLoading(false);
    if (currentUser?.role === 'sales_rep' || currentUser?.role === 'collector') {
      await loadManagerContact(currentUser.id);
    } else {
      setManagerContact(null);
      setManagerContactError(false);
    }
  }, [loadManagerContact]);

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
              deviceOs: getDeviceOs() || null,
            })
          : await profileService.updateAgentProfilePhoto({
              agentId: user.id,
              storagePath,
              deviceModel: Device.modelName || null,
              deviceOs: getDeviceOs() || null,
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
  const managerRowValue = isLoadingManager
    ? 'Loading…'
    : managerContact?.full_name || (managerContactError ? 'Could not load · tap to retry' : 'Not assigned');
  const handleManagerRowPress = () => {
    if (managerContact) {
      setIsManagerModalVisible(true);
    } else if (managerContactError && user?.id) {
      loadManagerContact(user.id);
    }
  };
  const openManagerContact = async (url) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Unable to Open Contact', friendlyError(error.message) || 'Please try again.');
    }
  };

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
                <Pressable
                  onPress={() => user?.profilePhotoUrl && setIsProfilePhotoPreviewVisible(true)}
                  disabled={!user?.profilePhotoUrl}
                  accessibilityLabel={user?.profilePhotoUrl ? 'Preview profile photo' : 'No profile photo to preview'}
                  accessibilityRole="button"
                >
                  <UserAvatar photoUrl={user?.profilePhotoUrl} size={88} iconName="person" style={styles.avatarRing} />
                </Pressable>
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
                <Icon name={roleIcon} size={14} color={rolePillColors.color} />
                <Text style={[styles.rolePillText, { color: rolePillColors.color }]}>{roleLabel}</Text>
              </View>

              <Pressable
                style={styles.changePhotoBtn}
                onPress={() => setIsSourceModalVisible(true)}
                disabled={isSaving}
              >
                <Icon name="camera" size={15} color={COLORS.primary} />
              </Pressable>
            </View>

            <Text style={styles.sectionLabel}>Profile Information</Text>
            <View style={styles.groupCard}>
              <View style={styles.rowItem}>
                <View style={styles.rowLeft}>
                  <View style={[styles.rowIconWrap, { backgroundColor: '#0085F91A' }]}>
                    <Icon name="idCard" size={18} color="#0085F9" />
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
                    <View style={[styles.rowIconWrap, { backgroundColor: '#E5484D1A' }]}>
                      <Icon name="location" size={18} color="#E5484D" />
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
                    <View style={[styles.rowIconWrap, { backgroundColor: '#E5484D1A' }]}>
                      <Icon name="location" size={18} color="#E5484D" />
                    </View>
                    <Text style={styles.rowLabel}>Branch</Text>
                  </View>
                  <Text style={styles.rowValue} numberOfLines={1}>
                    {branchList[0] || 'No branch assigned'}
                  </Text>
                </View>
              )}

              {(user?.role === 'sales_rep' || user?.role === 'collector') && (
                <>
                  <View style={styles.rowDivider} />
                  <Pressable
                    style={styles.rowItem}
                    onPress={handleManagerRowPress}
                    disabled={isLoadingManager || (!managerContact && !managerContactError)}
                    accessibilityLabel={managerContact ? `View contact details for Manager ${managerContact.full_name}` : 'Manager contact'}
                    accessibilityRole="button"
                  >
                    <View style={styles.rowLeft}>
                      <View style={[styles.rowIconWrap, { backgroundColor: '#EEF2FF' }]}>
                        <Icon name="idCard" size={18} color={COLORS.primary} />
                      </View>
                      <Text style={styles.rowLabel}>Manager</Text>
                    </View>
                    <View style={styles.phoneEditTrigger}>
                      {isLoadingManager && <ActivityIndicator size="small" color={COLORS.primary} />}
                      <Text style={styles.rowValue} numberOfLines={1}>{managerRowValue}</Text>
                      {!!managerContact && <Icon name="arrowRight" size={14} color="#94a3b8" />}
                    </View>
                  </Pressable>
                </>
              )}

              <View style={styles.rowDivider} />

              <Pressable
                style={styles.rowItem}
                onPress={handleEditPhone}
                accessibilityLabel="Edit phone number"
                accessibilityRole="button"
              >
                <View style={styles.rowLeft}>
                  <View style={[styles.rowIconWrap, { backgroundColor: '#2E9E5B1A' }]}>
                    <Icon name="phone" size={18} color="#2E9E5B" />
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
                  <Icon name="pencilSimpleLine" size={16} color="#0085F9" />
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
            <Icon name="phone" size={26} color="#2E9E5B" weight="fill" />
          </View>

          <Text style={styles.phoneModalTitle}>Edit Phone Number</Text>
          <Text style={styles.phoneModalSubtitle}>
            Enter your Philippine mobile number. It's used to reach you about deliveries.
          </Text>
          {hasPhoneNumber && (
            <View style={styles.currentPhonePill}>
              <Text style={styles.currentPhoneLabel}>Current</Text>
              <Text style={styles.currentPhoneValue}>{formatPhDisplay(user.phoneNumber)}</Text>
            </View>
          )}

          <View style={styles.phoneModalFieldOuter}>
            <PhilippinePhoneInput
              label={null}
              value={phoneDigits}
              onChangeText={handlePhoneChange}
              error={phoneError}
              style={styles.phoneModalFieldWrap}
            />
            <Text style={styles.phoneHint}>Example: 917 123 4567 (10 digits, no leading 0)</Text>
          </View>

          <View style={styles.phoneModalActions}>
            <Pressable
              style={[styles.phoneModalBtn, styles.phoneModalCancelBtn]}
              accessibilityRole="button"
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

      <CustomModal
        visible={isManagerModalVisible}
        onClose={() => setIsManagerModalVisible(false)}
        variant="center"
        height="auto"
      >
        <View style={styles.managerModalContent}>
          <Pressable
            style={styles.phoneModalCloseBtn}
            onPress={() => setIsManagerModalVisible(false)}
            hitSlop={10}
            accessibilityLabel="Close manager contact"
            accessibilityRole="button"
          >
            <Icon name="xCircle" size={24} color="#94a3b8" />
          </Pressable>
          <View style={styles.managerModalIconWrap}>
            <UserAvatar
              photoUrl={managerContact?.profile_photo_url}
              size={48}
              iconName="person"
              backgroundColor={COLORS.primaryLight}
              style={styles.managerAvatar}
            />
          </View>
          <Text style={styles.managerModalTitle}>{managerContact?.full_name || 'Manager'}</Text>
          <Text style={styles.managerModalName}>Your Manager</Text>
          <View style={styles.managerContactList}>
            <Pressable
              style={styles.managerContactRow}
              onPress={() => managerContact?.email && openManagerContact(`mailto:${managerContact.email}`)}
              disabled={!managerContact?.email}
              accessibilityRole="button"
              accessibilityLabel={managerContact?.email ? `Email ${managerContact.email}` : 'Manager email not provided'}
            >
              <Icon name="envelope" size={17} color={COLORS.primary} />
              <View style={styles.managerContactTextWrap}>
                <Text style={styles.managerContactLabel}>Email</Text>
                <Text style={styles.managerContactValue}>{managerContact?.email || 'Not provided'}</Text>
              </View>
              {!!managerContact?.email && <Icon name="arrowRight" size={16} color="#94a3b8" />}
            </Pressable>
            <View style={styles.managerContactDivider} />
            <Pressable
              style={styles.managerContactRow}
              onPress={() => {
                const phone = managerContact?.phone_number?.replace(/[^\d+]/g, '');
                if (phone) openManagerContact(`tel:${phone}`);
              }}
              disabled={!managerContact?.phone_number}
              accessibilityRole="button"
              accessibilityLabel={
                managerContact?.phone_number
                  ? `Call ${managerContact.full_name || 'your Manager'}`
                  : 'Manager contact number not provided'
              }
            >
              <Icon name="phone" size={17} color="#2E9E5B" />
              <View style={styles.managerContactTextWrap}>
                <Text style={styles.managerContactLabel}>Contact number</Text>
                <Text style={styles.managerContactValue}>
                  {managerContact?.phone_number ? formatPhDisplay(managerContact.phone_number) : 'Not provided'}
                </Text>
              </View>
              {!!managerContact?.phone_number && <Icon name="arrowRight" size={16} color="#94a3b8" />}
            </Pressable>
          </View>
        </View>
      </CustomModal>
      <ImageViewerModal
        visible={isProfilePhotoPreviewVisible}
        onClose={() => setIsProfilePhotoPreviewVisible(false)}
        imageUri={user?.profilePhotoUrl}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  heroCard: {
    alignItems: 'center',
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
    marginBottom: 0,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: SPACING.xs,
  },
  avatarRing: {
    borderWidth: 3,
    borderColor: '#BFE0FF',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  cameraBadgeIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#0085F9',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  rolePillText: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  changePhotoBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: '#D6E4FF',
  },
  sectionLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 0,
    marginTop: SPACING.sm,
  },
  groupCard: {
    marginBottom: SPACING.md,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    paddingHorizontal: 12,
    gap: 10,
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 14,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 10,
  },
  rowItemStacked: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    gap: 10,
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 14,
  },
  rowCount: {
    minWidth: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#EEF2FF',
    color: COLORS.primary,
    fontSize: 12,
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
    backgroundColor: '#EAF4FF',
  },
  branchChipText: {
    fontSize: 12,
    color: '#0A66C2',
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
    fontSize: 15,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  rowValue: {
    flexShrink: 1,
    textAlign: 'right',
    fontSize: 13,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  rowValuePlaceholder: {
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: '600',
  },
  rowDivider: { height: 0 },
  phoneEditTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phoneModalContent: { alignItems: 'center', paddingTop: 4 },
  managerModalContent: { alignItems: 'center', paddingTop: 2 },
  managerModalIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: '#BFE0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  managerAvatar: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  managerModalTitle: {
    marginTop: 8,
    fontSize: 17,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    textAlign: 'center',
  },
  managerModalName: {
    marginTop: 0,
    marginBottom: SPACING.sm,
    fontSize: 13,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    textAlign: 'center',
  },
  managerContactList: {
    alignSelf: 'stretch',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAEFF5',
    backgroundColor: '#F9FAFC',
    paddingHorizontal: 12,
  },
  managerContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  managerContactTextWrap: { flex: 1 },
  managerContactLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  managerContactValue: {
    marginTop: 2,
    fontSize: 14,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: '600',
  },
  managerContactDivider: { height: 1, backgroundColor: '#EAEFF5' },
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
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2E9E5B1A',
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
    marginBottom: SPACING.md,
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
  currentPhonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.md,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F3F6',
  },
  currentPhoneLabel: { fontSize: 12, color: '#6B7280', fontFamily: TYPOGRAPHY.fontFamily.regular },
  currentPhoneValue: { fontSize: 13, color: '#272632', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  phoneHint: {
    marginTop: 6,
    marginBottom: SPACING.md,
    fontSize: 12,
    color: '#6B7280',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  phoneModalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneModalCancelBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D5DAE3',
  },
  phoneModalCancelText: {
    fontSize: 16,
    color: '#555353',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  phoneModalSaveBtn: {
    backgroundColor: COLORS.primary,
  },
  phoneModalSaveText: {
    fontSize: 16,
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
    fontSize: 12,
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
