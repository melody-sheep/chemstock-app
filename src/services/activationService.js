// src/services/activationService.js
import { BaseService } from './BaseService';
import { supabase, isRLSError, getFriendlyErrorMessage } from './supabaseClient';
import { debugLog, logError } from '../utils/logger';

class ActivationService extends BaseService {
  constructor() {
    super('ActivationService');
    console.log('[INFO] [ActivationService] Service initialized');
  }

  /**
   * Validate an activation key
   * @param {string} key - The activation code to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateKey(key) {
    debugLog('info', 'ActivationService', 'Validating activation key', { key });

    try {
      const trimmedKey = key?.trim() || '';

      if (!trimmedKey) {
        return {
          success: false,
          message: 'Activation code is required',
          data: null,
          errorCode: 'EMPTY_KEY'
        };
      }

      if (trimmedKey.length < 4) {
        return {
          success: false,
          message: 'Activation code must be at least 4 characters',
          data: null,
          errorCode: 'TOO_SHORT'
        };
      }

      const { data, error } = await supabase
        .from('activation_keys')
        .select('*')
        .eq('code', trimmedKey)
        .limit(1);

      if (error && isRLSError(error)) {
        console.warn('[WARN] [ActivationService] RLS error validating key:', error.message);
        return {
          success: false,
          message: 'Permission denied. Please check your activation code or contact support.',
          data: null,
          errorCode: 'RLS_ERROR',
          originalError: error
        };
      }

      if (error) {
        console.error('[ERROR] [ActivationService] Database error:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        return {
          success: false,
          message: 'Invalid activation code. Please check and try again.',
          data: null,
          errorCode: 'NOT_FOUND'
        };
      }

      const record = data[0];

      if (record.is_used) {
        return {
          success: false,
          message: 'This activation code has already been used.',
          data: null,
          errorCode: 'ALREADY_USED'
        };
      }

      // Declare expiresAt here (outside the if block) so it's available below
      const now = new Date();
      let expiresAt = null;
      let isExpired = false;

      if (record.expires_at) {
        expiresAt = new Date(record.expires_at);
        isExpired = expiresAt < now;

        if (isExpired) {
          return {
            success: false,
            message: 'Activation code has expired.',
            data: null,
            errorCode: 'EXPIRED'
          };
        }
      }

      const branchNames = record.branch_names || [];
      const branchLocations = record.branch_locations || [];

      debugLog('info', 'ActivationService', 'Validation successful', {
        managerEmail: record.manager_email,
        branchNames: branchNames,
        branchCount: branchNames.length
      });

      return {
        success: true,
        message: 'Valid activation key',
        data: {
          activationId: record.id,
          managerName: record.manager_name,
          managerEmail: record.manager_email,
          branchNames: branchNames,
          branchLocations: branchLocations,
          branchIds: record.branch_ids || [],
          code: record.code,
          expiresAt: record.expires_at,
          isUsed: record.is_used
        }
      };

    } catch (error) {
      if (isRLSError(error)) {
        return {
          success: false,
          message: 'Permission denied. Please check your activation code or contact support.',
          data: null,
          errorCode: 'RLS_ERROR'
        };
      }

      this.log('error', 'Validation error', { key, error: error.message });

      return {
        success: false,
        message: error.message || 'Failed to validate activation code. Please check your connection.',
        data: null,
        errorCode: error.code || 'UNKNOWN_ERROR'
      };
    }
  }

  /**
   * Activate a manager using a valid key
   * @param {string} key - Activation code
   * @param {string} userId - User ID from auth
   * @param {Object} userData - Additional user data
   * @returns {Promise<Object>} Activation result
   */
  async activateManager(key, userId, userData = {}) {
  debugLog('info', 'ActivationService', 'Activating manager', { key, userId });

  try {
    this.validateRequired(['key', 'userId'], { key, userId });

    // Friendly pre-check — the RPC re-validates atomically regardless,
    // this just gives a better error message for the common cases.
    const validation = await this.validateKey(key);
    if (!validation.success) {
      throw new Error(validation.message);
    }

    const { data: profile, error: rpcError } = await supabase.rpc('activate_manager', {
      p_code: key.trim(),
      p_user_id: userId,
      p_username: userData.username,
      p_full_name: userData.fullName || userData.username,
    });

    if (rpcError) {
      console.error('[ERROR] [ActivationService] activate_manager RPC error:', rpcError);
      if (isRLSError(rpcError)) {
        throw new Error('Permission denied to activate this key. Please contact support.');
      }
      throw new Error(rpcError.message || 'Failed to activate manager.');
    }

    debugLog('info', 'ActivationService', 'Activation completed', {
      userId,
      branchCount: profile.branch_ids?.length || 0
    });

    return {
      success: true,
      message: `Successfully activated for ${validation.data.branchNames.length} branch(es): ${validation.data.branchNames.join(', ')}`,
      data: {
        managerId: profile.id,
        username: profile.username,
        fullName: profile.full_name,
        role: profile.role,
        branchIds: profile.branch_ids,
        branchNames: validation.data.branchNames,
        branchLocations: validation.data.branchLocations,
        managerName: validation.data.managerName,
        managerEmail: validation.data.managerEmail,
        activationId: validation.data.activationId
      }
    };

  } catch (error) {
    if (isRLSError(error)) {
      return {
        success: false,
        message: 'Permission denied to activate this key. Please contact support.',
        data: null,
        errorCode: 'RLS_ERROR'
      };
    }

    this.log('error', 'Activation error', { key, userId, error: error.message });

    return {
      success: false,
      message: error.message || 'Failed to activate manager. Please try again.',
      data: null,
      errorCode: error.code || 'UNKNOWN_ERROR'
    };
  }
}

  async checkKeyExists(key) {
    try {
      const trimmedKey = key?.trim() || '';
      if (!trimmedKey) {
        return false;
      }

      const { data, error } = await supabase
        .from('activation_keys')
        .select('id, code, is_used')
        .eq('code', trimmedKey)
        .limit(1);

      if (error) {
        console.error('[ERROR] [ActivationService] Error checking key:', error);
        return false;
      }

      const exists = data && data.length > 0;

      if (exists) {
        const record = data[0];
        return !record.is_used;
      }

      return false;

    } catch (error) {
      console.error('[ERROR] [ActivationService] Error in checkKeyExists:', error);
      return false;
    }
  }

  async getAllKeys() {
    try {
      const { data, error } = await supabase
        .from('activation_keys')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[ERROR] [ActivationService] Error getting all keys:', error);
        if (isRLSError(error)) {
          throw new Error('Permission denied to view keys.');
        }
        throw error;
      }

      return data || [];

    } catch (error) {
      this.handleError(error);
      return [];
    }
  }
}

const activationService = new ActivationService();
console.log('[INFO] [ActivationService] Service instance created');

export default activationService;
