// src/services/activationService.js
import { BaseService } from './BaseService';
import { supabase } from './supabaseClient';
import { debugLog, logError } from '../utils/logger';

class ActivationService extends BaseService {
  constructor() {
    super();
  }
  
  async validateKey(key) {
    console.log('🔍 [SERVICE] ======================================');
    console.log('🔍 [SERVICE] validateKey called with:', key);
    console.log('🔍 [SERVICE] Key type:', typeof key);
    console.log('🔍 [SERVICE] Key length:', key?.length);
    
    debugLog('info', 'ActivationService', 'Validating activation key', { key });
    
    try {
      const trimmedKey = key?.trim() || '';
      console.log('🔍 [SERVICE] Trimmed key:', trimmedKey);
      console.log('🔍 [SERVICE] Trimmed length:', trimmedKey.length);
      
      if (!trimmedKey) {
        return {
          success: false,
          message: 'Activation code is required',
          data: null
        };
      }
      
      console.log('🔍 [SERVICE] Querying table: activation_keys');
      console.log('🔍 [SERVICE] Query: .eq("code", "' + trimmedKey + '")');
      
      // Query the activation_keys table
      const { data, error } = await supabase
        .from('activation_keys')
        .select('*')
        .eq('code', trimmedKey)
        .single();  // ← REMOVED .eq('is_used', false) for debugging
      
      console.log('🔍 [SERVICE] Query result data:', data);
      console.log('🔍 [SERVICE] Query error:', error);
      
      if (error) {
        console.log('🔍 [SERVICE] Error code:', error.code);
        console.log('🔍 [SERVICE] Error details:', error.details);
        console.log('🔍 [SERVICE] Error message:', error.message);
        
        if (error.code === 'PGRST116') {
          console.log('🔍 [SERVICE] ❌ No matching code found!');
          debugLog('warn', 'ActivationService', 'Invalid activation key', { key });
          return {
            success: false,
            message: 'Invalid activation code',
            data: null
          };
        }
        throw error;
      }
      
      if (!data) {
        console.log('🔍 [SERVICE] ❌ Data is null!');
        return {
          success: false,
          message: 'Invalid activation code',
          data: null
        };
      }
      
      // Check if already used
      if (data.is_used) {
        console.log('🔍 [SERVICE] ❌ Code already used!');
        return {
          success: false,
          message: 'Activation code already used',
          data: null
        };
      }
      
      // Check expiration
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        console.log('🔍 [SERVICE] ❌ Code expired:', data.expires_at);
        return {
          success: false,
          message: 'Activation code has expired',
          data: null
        };
      }
      
      const branchNames = data.branch_names || [];
      const branchLocations = data.branch_locations || [];
      
      console.log('🔍 [SERVICE] ✅ Found data!');
      console.log('🔍 [SERVICE] Branch names:', branchNames);
      console.log('🔍 [SERVICE] Manager name:', data.manager_name);
      
      debugLog('info', 'ActivationService', 'Validation successful', { 
        managerEmail: data.manager_email,
        branchNames: branchNames,
        branchCount: branchNames.length
      });
      
      return {
        success: true,
        message: 'Valid activation key',
        data: {
          activationId: data.id,
          managerName: data.manager_name,
          managerEmail: data.manager_email,
          branchNames: branchNames,
          branchLocations: branchLocations,
          code: data.code,
          expiresAt: data.expires_at
        }
      };
      
    } catch (error) {
      console.error('🔍 [SERVICE] ❌ Error caught:', error);
      console.error('🔍 [SERVICE] Error stack:', error.stack);
      this.handleError(error, { key });
      return {
        success: false,
        message: error.message || 'Failed to validate activation code',
        data: null
      };
    }
  }
  
  async activateManager(key, userId) {
    console.log('🔍 [SERVICE] activateManager called with:', { key, userId });
    debugLog('info', 'ActivationService', 'Activating manager', { key, userId });
    
    try {
      const validation = await this.validateKey(key);
      
      if (!validation.success) {
        throw new Error(validation.message);
      }
      
      const { error: updateKeyError } = await supabase
        .from('activation_keys')
        .update({
          is_used: true,
          used_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('code', key.trim());
      
      if (updateKeyError) {
        console.error('🔍 [SERVICE] Error updating key:', updateKeyError);
        throw updateKeyError;
      }
      
      console.log('🔍 [SERVICE] Activation key marked as used');
      
      const branchNames = validation.data.branchNames || [];
      const branchLocations = validation.data.branchLocations || [];
      
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
          managerEmail: validation.data.managerEmail
        }
      };
      
    } catch (error) {
      console.error('🔍 [SERVICE] Error in activateManager:', error);
      this.handleError(error, { key, userId });
      return {
        success: false,
        message: error.message || 'Failed to activate manager',
        data: null
      };
    }
  }
  
  async checkKeyExists(key) {
    try {
      const { data, error } = await supabase
        .from('activation_keys')
        .select('id, code, is_used')
        .eq('code', key.trim())
        .single();
      
      if (error) return false;
      return !data.is_used;
    } catch (error) {
      return false;
    }
  }
  
  async getAllKeys() {
    try {
      const { data, error } = await supabase
        .from('activation_keys')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      this.handleError(error);
      return [];
    }
  }
}

const activationService = new ActivationService();
export default activationService;