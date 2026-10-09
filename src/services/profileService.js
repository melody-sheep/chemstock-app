// src/services/profileService.js
import { BaseService } from './BaseService';
import { supabase } from './supabaseClient';
import { debugLog } from '../utils/logger';
// /legacy: same reason as every other photo upload in this app — the new
// default File/Paths API needs a native module Expo Go doesn't ship yet.
import * as FileSystem from 'expo-file-system/legacy';
import { base64ToUint8Array } from '../utils/base64';
import { resolveProfilePhotoUrl } from '../utils/profilePhoto';

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

  async updateAgentPhoneNumber({ agentId, phoneNumber }) {
    debugLog('info', 'ProfileService', 'Updating agent phone number', { agentId });

    try {
      this.validateRequired(['agentId'], { agentId });

      const { data, error } = await supabase.rpc('update_agent_phone_number', {
        p_agent_id: agentId,
        p_phone_number: phoneNumber ?? null,
      });

      if (error) {
        console.error('[ERROR] [ProfileService] update_agent_phone_number RPC error:', error);
        throw new Error(error.message || 'Failed to update phone number');
      }

      return { success: true, data };
    } catch (error) {
      this.log('error', 'updateAgentPhoneNumber failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to update phone number' };
    }
  }

  async updateManagerPhoneNumber({ phoneNumber }) {
    debugLog('info', 'ProfileService', 'Updating manager phone number', {});

    try {
      const { data, error } = await supabase.rpc('update_manager_phone_number', {
        p_phone_number: phoneNumber ?? null,
      });

      if (error) {
        console.error('[ERROR] [ProfileService] update_manager_phone_number RPC error:', error);
        throw new Error(error.message || 'Failed to update phone number');
      }

      return { success: true, data };
    } catch (error) {
      this.log('error', 'updateManagerPhoneNumber failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to update phone number' };
    }
  }

  /**
   * Read-only lookup of ANOTHER agent's (sales_rep/collector) public
   * profile — same get_agent_profile RPC getCurrentUser() uses to refresh
   * its own session, just called with someone else's id. Used by "view
   * profile" taps (e.g. a Collector viewing the Sales Rep they're
   * delivering to) so those screens don't need their own RPC for this.
   * Returns null for a manager id — get_agent_profile only covers agents.
   */
  async getAgentProfileById(agentId) {
    debugLog('info', 'ProfileService', 'Fetching agent profile by id', { agentId });

    try {
      this.validateRequired(['agentId'], { agentId });

      const { data, error } = await supabase.rpc('get_agent_profile', { p_agent_id: agentId });

      if (error) {
        console.error('[ERROR] [ProfileService] get_agent_profile RPC error:', error);
        throw new Error(error.message || 'Failed to load profile');
      }

      if (!data) {
        return { success: false, message: 'Profile not found' };
      }

      const profilePhotoUrl = await resolveProfilePhotoUrl(data.profile_photo_path);

      return {
        success: true,
        data: {
          id: data.id,
          username: data.username,
          fullName: data.full_name,
          role: data.role,
          phoneNumber: data.phone_number || null,
          profilePhotoUrl,
        },
      };
    } catch (error) {
      this.log('error', 'getAgentProfileById failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to load profile' };
    }
  }
}

const profileService = new ProfileService();
export default profileService;
