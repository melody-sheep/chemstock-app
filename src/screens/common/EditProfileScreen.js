// src/screens/common/EditProfileScreen.js
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Device from 'expo-device';
import Header from '../../components/common/Header';
import UserAvatar from '../../components/common/UserAvatar';
import CustomModal from '../../components/common/Modal';
import CameraCaptureModal from '../../components/common/CameraCaptureModal';
import authService from '../../services/authService';
import profileService from '../../services/profileService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const ROLE_LABELS = {
  manager: 'Branch Manager',
  sales_rep: 'Sales Representative',
  collector: 'Collector',
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

  const roleLabel = ROLE_LABELS[user?.role] || user?.role || '';

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
          <View style={styles.content}>
            <View style={styles.avatarSection}>
              <View style={styles.avatarWrap}>
                <UserAvatar photoUrl={user?.profilePhotoUrl} size={120} iconName="person" />
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
                      <Text style={styles.cameraBadgeGlyph}>+</Text>
                    </View>
                  )}
                </Pressable>
              </View>

              <Text style={styles.userName} numberOfLines={1}>
                {user?.full_name || user?.username || ''}
              </Text>
              <Text style={styles.userRole}>{roleLabel}</Text>
              <Text style={styles.userBranch} numberOfLines={1}>
                {user?.branchName || 'No branch assigned'}
              </Text>
            </View>
          </View>
        )}
      </View>

      <CustomModal visible={isSourceModalVisible} onClose={() => setIsSourceModalVisible(false)} height={220}>
        <Text style={styles.modalTitle}>Change Profile Photo</Text>
        <Pressable style={styles.modalOption} onPress={handleTakePhoto}>
          <Text style={styles.modalOptionText}>Take Photo</Text>
        </Pressable>
        <Pressable style={styles.modalOption} onPress={handlePickFromGallery}>
          <Text style={styles.modalOptionText}>Choose from Gallery</Text>
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
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING['2xl'],
  },
  avatarSection: {
    alignItems: 'center',
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: SPACING.md,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  cameraBadgeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadgeGlyph: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 20,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
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
  userBranch: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 4,
  },
  modalTitle: {
    fontSize: 16,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  modalOption: {
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
  },
  modalOptionText: {
    fontSize: 15,
    color: '#03045E',
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
});
