// src/services/activationService.js
import { BaseService } from './BaseService';
import { supabase, isRLSError, getFriendlyErrorMessage } from './supabaseClient';
import { debugLog, logError } from '../utils/logger';

class ActivationService extends BaseService {
  constructor() {
    super('ActivationService');
    console.log('🔑 [ActivationService] Service initialized');
  }
  
  /**
   * Validate an activation key
   * @param {string} key - The activation code to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateKey(key) {
    console.log('========================================');
    console.log('🔍 [ActivationService] ======================================');
    console.log('🔍 [ActivationService] validateKey called');
    console.log('🔍 [ActivationService] Key input:', key);
    console.log('🔍 [ActivationService] Key type:', typeof key);
    console.log('🔍 [ActivationService] Key length:', key?.length);
    
    debugLog('info', 'ActivationService', 'Validating activation key', { key });
    
    try {
      // Validate input
      const trimmedKey = key?.trim() || '';
      console.log('🔍 [ActivationService] Trimmed key:', trimmedKey);
      console.log('🔍 [ActivationService] Trimmed length:', trimmedKey.length);
      
      if (!trimmedKey) {
        console.log('❌ [ActivationService] Empty key provided');
        return {
          success: false,
          message: 'Activation code is required',
          data: null,
          errorCode: 'EMPTY_KEY'
        };
      }
      
      if (trimmedKey.length < 4) {
        console.log('❌ [ActivationService] Key too short (min 4 chars)');
        return {
          success: false,
          message: 'Activation code must be at least 4 characters',
          data: null,
          errorCode: 'TOO_SHORT'
        };
      }
      
      console.log('📡 [ActivationService] Querying activation_keys table...');
      console.log('📡 [ActivationService] Query: .eq("code", "' + trimmedKey + '")');
      
      const { data, error } = await supabase
        .from('activation_keys')
        .select('*')
        .eq('code', trimmedKey)
        .limit(1);
      
      console.log('📊 [ActivationService] Query result data:', data);
      console.log('📊 [ActivationService] Query error:', error);
      console.log('📊 [ActivationService] Data length:', data?.length);
      
      if (error && isRLSError(error)) {
        console.log('🔒 [ActivationService] RLS error detected!');
        console.log('🔒 [ActivationService] Error details:', error);
        return {
          success: false,
          message: 'Permission denied. Please check your activation code or contact support.',
          data: null,
          errorCode: 'RLS_ERROR',
          originalError: error
        };
      }
      
      if (error) {
        console.error('❌ [ActivationService] Database error:', error);
        console.error('❌ [ActivationService] Error code:', error.code);
        console.error('❌ [ActivationService] Error details:', error.details);
        console.error('❌ [ActivationService] Error message:', error.message);
        throw error;
      }
      
      if (!data || data.length === 0) {
        console.log('❌ [ActivationService] No matching code found!');
        console.log('🔍 [ActivationService] Code searched:', trimmedKey);
        return {
          success: false,
          message: 'Invalid activation code. Please check and try again.',
          data: null,
          errorCode: 'NOT_FOUND'
        };
      }
      
      const record = data[0];
      console.log('📄 [ActivationService] Found record:', record);
      console.log('📄 [ActivationService] Record ID:', record.id);
      console.log('📄 [ActivationService] Record manager:', record.manager_name);
      console.log('📄 [ActivationService] Record branches:', record.branch_names);
      console.log('📄 [ActivationService] Record is_used:', record.is_used);
      console.log('📄 [ActivationService] Record expires_at:', record.expires_at);
      
      if (record.is_used) {
        console.log('❌ [ActivationService] Code already used at:', record.used_at);
        return {
          success: false,
          message: 'This activation code has already been used.',
          data: null,
          errorCode: 'ALREADY_USED'
        };
      }
      
      // ✅ FIX: Declare expiresAt here (outside the if block)
      const now = new Date();
      let expiresAt = null;
      let isExpired = false;
      
      if (record.expires_at) {
        expiresAt = new Date(record.expires_at);
        isExpired = expiresAt < now;
        console.log('📅 [ActivationService] Current time:', now.toISOString());
        console.log('📅 [ActivationService] Expires at:', expiresAt.toISOString());
        console.log('📅 [ActivationService] Is expired?', isExpired);
        
        if (isExpired) {
          console.log('❌ [ActivationService] Code expired');
          return {
            success: false,
            message: 'Activation code has expired.',
            data: null,
            errorCode: 'EXPIRED'
          };
        }
      } else {
        console.log('ℹ️ [ActivationService] No expiration date set (never expires)');
      }
      
      const branchNames = record.branch_names || [];
      const branchLocations = record.branch_locations || [];
      
      // ============================================
      // ✅ ACCESS GRANTED - DETAILED LOG
      // ============================================
      console.log('========================================');
      console.log('✅ [ActivationService] ======================================');
      console.log('✅ [ActivationService] ACCESS GRANTED!');
      console.log('✅ [ActivationService] ======================================');
      console.log('👤 [ActivationService] Manager Name:', record.manager_name);
      console.log('📧 [ActivationService] Manager Email:', record.manager_email);
      console.log('🆔 [ActivationService] Activation ID:', record.id);
      console.log('🔑 [ActivationService] Activation Code:', record.code);
      console.log('🏢 [ActivationService] Branches Assigned:');
      branchNames.forEach((name, index) => {
        console.log(`   ${index + 1}. ${name} ${branchLocations[index] ? `(${branchLocations[index]})` : ''}`);
      });
      console.log('📊 [ActivationService] Total Branches:', branchNames.length);
      console.log('📅 [ActivationService] Expires At:', record.expires_at);
      // ✅ FIX: Use the expiresAt variable that we declared above
      console.log('📅 [ActivationService] Expiration Status:', expiresAt ? (isExpired ? 'EXPIRED' : '✅ ACTIVE') : 'NEVER EXPIRES');
      console.log('✅ [ActivationService] ======================================');
      console.log('========================================');
      
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
          code: record.code,
          expiresAt: record.expires_at,
          isUsed: record.is_used
        }
      };
      
    } catch (error) {
      console.error('❌ [ActivationService] Error caught in validateKey:', error);
      console.error('❌ [ActivationService] Error stack:', error.stack);
      
      if (isRLSError(error)) {
        console.log('🔒 [ActivationService] RLS error in catch block');
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
    console.log('========================================');
    console.log('🚀 [ActivationService] activateManager called');
    console.log('🔑 [ActivationService] Key:', key);
    console.log('🆔 [ActivationService] User ID:', userId);
    console.log('📋 [ActivationService] User data:', userData);
    
    debugLog('info', 'ActivationService', 'Activating manager', { key, userId });
    
    try {
      this.validateRequired(['key', 'userId'], { key, userId });
      
      console.log('🔍 [ActivationService] Step 1: Validating key...');
      const validation = await this.validateKey(key);
      
      console.log('📊 [ActivationService] Validation result:', validation);
      
      if (!validation.success) {
        console.log('❌ [ActivationService] Validation failed:', validation.message);
        throw new Error(validation.message);
      }
      
      console.log('✅ [ActivationService] Key validation passed');
      
      console.log('🔄 [ActivationService] Step 2: Marking key as used...');
      console.log('📡 [ActivationService] UPDATE activation_keys SET is_used=true WHERE code=' + key.trim());
      
      const { error: updateKeyError } = await supabase
        .from('activation_keys')
        .update({
          is_used: true,
          used_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('code', key.trim());
      
      if (updateKeyError) {
        console.error('❌ [ActivationService] Error updating key:', updateKeyError);
        console.error('❌ [ActivationService] Error code:', updateKeyError.code);
        console.error('❌ [ActivationService] Error message:', updateKeyError.message);
        
        if (isRLSError(updateKeyError)) {
          console.log('🔒 [ActivationService] RLS error on update');
          throw new Error('Permission denied to activate this key. Please contact support.');
        }
        
        throw updateKeyError;
      }
      
      console.log('✅ [ActivationService] Key marked as used successfully');
      
      const branchNames = validation.data.branchNames || [];
      const branchLocations = validation.data.branchLocations || [];
      
      console.log('========================================');
      console.log('🎉 [ActivationService] ======================================');
      console.log('🎉 [ActivationService] MANAGER ACTIVATION COMPLETE!');
      console.log('🎉 [ActivationService] ======================================');
      console.log('👤 [ActivationService] Manager ID:', userId);
      console.log('👤 [ActivationService] Manager Name:', validation.data.managerName);
      console.log('📧 [ActivationService] Manager Email:', validation.data.managerEmail);
      console.log('🏢 [ActivationService] Branches Assigned:');
      branchNames.forEach((name, index) => {
        console.log(`   ${index + 1}. ${name} ${branchLocations[index] ? `(${branchLocations[index]})` : ''}`);
      });
      console.log('📊 [ActivationService] Total Branches:', branchNames.length);
      console.log('🔑 [ActivationService] Activation Code:', validation.data.code);
      console.log('🆔 [ActivationService] Activation ID:', validation.data.activationId);
      console.log('✅ [ActivationService] Status: ACTIVATED');
      console.log('🎉 [ActivationService] ======================================');
      console.log('========================================');
      
      debugLog('info', 'ActivationService', 'Activation completed', { 
        userId, 
        branchNames: branchNames,
        branchCount: branchNames.length
      });
      
      return {
        success: true,
        message: `Successfully activated for ${branchNames.length} branch(es): ${branchNames.join(', ')}`,
        data: {
          managerId: userId,
          branchNames: branchNames,
          branchLocations: branchLocations,
          managerName: validation.data.managerName,
          managerEmail: validation.data.managerEmail,
          activationId: validation.data.activationId
        }
      };
      
    } catch (error) {
      console.error('❌ [ActivationService] Error in activateManager:', error);
      console.error('❌ [ActivationService] Error stack:', error.stack);
      console.error('❌ [ActivationService] Error code:', error.code);
      
      if (isRLSError(error)) {
        console.log('🔒 [ActivationService] RLS error in activateManager');
        return {
          success: false,
          message: 'Permission denied to activate this key. Please contact support.',
          data: null,
          errorCode: 'RLS_ERROR'
        };
      }
      
      this.handleError(error, { key, userId });
      
      return {
        success: false,
        message: error.message || 'Failed to activate manager. Please try again.',
        data: null,
        errorCode: error.code || 'UNKNOWN_ERROR'
      };
    }
  }
  
  async checkKeyExists(key) {
    console.log('🔍 [ActivationService] checkKeyExists called for:', key);
    
    try {
      const trimmedKey = key?.trim() || '';
      if (!trimmedKey) {
        console.log('❌ [ActivationService] Empty key');
        return false;
      }
      
      console.log('📡 [ActivationService] Querying if key exists...');
      
      const { data, error } = await supabase
        .from('activation_keys')
        .select('id, code, is_used')
        .eq('code', trimmedKey)
        .limit(1);
      
      if (error) {
        console.error('❌ [ActivationService] Error checking key:', error);
        if (isRLSError(error)) {
          console.log('🔒 [ActivationService] RLS error on check');
          return false;
        }
        return false;
      }
      
      const exists = data && data.length > 0;
      console.log(`📊 [ActivationService] Key exists: ${exists}`);
      
      if (exists) {
        const record = data[0];
        console.log(`📊 [ActivationService] Key is_used: ${record.is_used}`);
        return !record.is_used;
      }
      
      return false;
      
    } catch (error) {
      console.error('❌ [ActivationService] Error in checkKeyExists:', error);
      return false;
    }
  }
  
  async getAllKeys() {
    console.log('📋 [ActivationService] getAllKeys called');
    
    try {
      const { data, error } = await supabase
        .from('activation_keys')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ [ActivationService] Error getting all keys:', error);
        if (isRLSError(error)) {
          console.log('🔒 [ActivationService] RLS error on getAllKeys');
          throw new Error('Permission denied to view keys.');
        }
        throw error;
      }
      
      console.log(`📊 [ActivationService] Retrieved ${data?.length || 0} keys`);
      return data || [];
      
    } catch (error) {
      this.handleError(error);
      return [];
    }
  }
}

const activationService = new ActivationService();
console.log('✅ [ActivationService] Service instance created');

export default activationService;