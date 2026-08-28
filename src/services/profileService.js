// src/services/profileService.js
import { BaseService } from './BaseService';
import { supabase } from './supabaseClient';
import { debugLog } from '../utils/logger';
// /legacy: same reason as every other photo upload in this app — the new
// default File/Paths API needs a native module Expo Go doesn't ship yet.
import * as FileSystem from 'expo-file-system/legacy';
import { base64ToUint8Array } from '../utils/base64';

const SHIPMENT_BUCKET = 'shipment-media';

class ProfileService extends BaseService {
  constructor() {
    super('ProfileService');
  }

  /**
   * Uploads a new profile photo. Same base64-read-and-upload shape as
   * uploadStockAcceptancePhoto/uploadDiscrepancyPhoto — returns the storage
   * path (not a public URL), never a public URL, matching every other photo
   * in this app.
   * @returns {Promise<string>} the storage path
   */
  async uploadProfilePhoto(uri, userId) {
    debugLog('info', 'ProfileService', 'Uploading profile photo', { userId });

    try {
      this.validateRequired(['uri', 'userId'], { uri, userId });

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const bytes = base64ToUint8Array(base64);
      const path = `profile-photos/${userId}/${Date.now()}.jpg`;

      const { error } = await supabase.storage
        .from(SHIPMENT_BUCKET)
        .upload(path, bytes, { contentType: 'image/jpeg' });

      if (error) {
        console.error('[ERROR] [ProfileService] Profile photo upload failed:', error);
        throw new Error(error.message || 'Failed to upload photo');
      }

      return path;
    } catch (error) {
      this.log('error', 'uploadProfilePhoto failed', { error: error.message });
      throw error;
    }
  }

  async updateAgentProfilePhoto({ agentId, storagePath, deviceModel, deviceOs }) {
    debugLog('info', 'ProfileService', 'Updating agent profile photo', { agentId });

    try {
      this.validateRequired(['agentId', 'storagePath'], { agentId, storagePath });

      const { data, error } = await supabase.rpc('update_agent_profile_photo', {
        p_agent_id: agentId,
        p_storage_path: storagePath,
        p_device_model: deviceModel ?? null,
        p_device_os: deviceOs ?? null,
      });

      if (error) {
        console.error('[ERROR] [ProfileService] update_agent_profile_photo RPC error:', error);
        throw new Error(error.message || 'Failed to update profile photo');
      }

      return { success: true, data };
    } catch (error) {
      this.log('error', 'updateAgentProfilePhoto failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to update profile photo' };
    }
  }

  async updateManagerProfilePhoto({ storagePath, deviceModel, deviceOs }) {
    debugLog('info', 'ProfileService', 'Updating manager profile photo', {});

    try {
      this.validateRequired(['storagePath'], { storagePath });

      const { data, error } = await supabase.rpc('update_manager_profile_photo', {
        p_storage_path: storagePath,
        p_device_model: deviceModel ?? null,
        p_device_os: deviceOs ?? null,
      });

      if (error) {
        console.error('[ERROR] [ProfileService] update_manager_profile_photo RPC error:', error);
        throw new Error(error.message || 'Failed to update profile photo');
      }

      return { success: true, data };
    } catch (error) {
      this.log('error', 'updateManagerProfilePhoto failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to update profile photo' };
    }
  }
}

const profileService = new ProfileService();
export default profileService;
