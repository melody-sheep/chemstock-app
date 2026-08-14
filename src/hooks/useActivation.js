// src/hooks/useActivation.js
import { useState, useCallback, useRef } from 'react';
import { debugLog, logError } from '../utils/logger';
import { ActivationKeyStrategy } from '../utils/validationStrategies';
import activationService from '../services/activationService';
import authService from '../services/authService';
import { isRLSError, getFriendlyErrorMessage } from '../services/supabaseClient';

/**
 * Activation ViewModel class for OOP state management
 * Supports multiple branches
 */
class ActivationViewModel {
  constructor(activationService, authService) {
    this.activationService = activationService;
    this.authService = authService;
    this.validationStrategy = new ActivationKeyStrategy();
    
    // State
    this.activationKey = '';
    this.error = '';
    this.isValidCode = false;
    this.submitted = false;
    this.isLoading = false;
    this.branchInfo = null; // { names: [], locations: [], managerName, managerEmail }
    this.userId = null;
    this.errorType = null; // 'rls', 'not_found', 'expired', 'used', 'validation'
    
    // Callbacks for UI updates
    this.onStateChange = null;
    
    console.log('🏗️ [useActivation] ActivationViewModel initialized');
  }
  
  setOnStateChange(callback) {
    console.log('🔗 [useActivation] Setting onStateChange callback');
    this.onStateChange = callback;
  }
  
  setUserId(userId) {
    console.log('🆔 [useActivation] setUserId called:', userId);
    this.userId = userId;
    debugLog('debug', 'ActivationViewModel', 'User ID set', { userId });
  }
  
  notifyStateChange() {
    if (this.onStateChange) {
      this.onStateChange({
        activationKey: this.activationKey,
        error: this.error,
        isValidCode: this.isValidCode,
        submitted: this.submitted,
        isLoading: this.isLoading,
        branchInfo: this.branchInfo,
        errorType: this.errorType,
      });
    }
  }
  
  setActivationKey(key) {
    console.log('🔑 [useActivation] setActivationKey called');
    console.log('🔑 [useActivation] Key:', key);
    console.log('🔑 [useActivation] Key type:', typeof key);
    console.log('🔑 [useActivation] Key length:', key?.length);
    
    debugLog('debug', 'ActivationViewModel', 'Activation key changed', { 
      oldValue: this.activationKey, 
      newValue: key,
      length: key?.length 
    });
    
    this.activationKey = key || '';
    this.error = '';
    this.errorType = null;
    this.submitted = false;
    this.isValidCode = false;
    this.branchInfo = null;
    this.notifyStateChange();
  }
  
  async submit() {
    console.log('========================================');
    console.log('🚨 [useActivation] SUBMIT FUNCTION CALLED!');
    console.log('🔑 [useActivation] Activation key:', this.activationKey);
    console.log('🔑 [useActivation] Key type:', typeof this.activationKey);
    console.log('🔑 [useActivation] Key length:', this.activationKey?.length);
    console.log('🆔 [useActivation] User ID:', this.userId);
    
    debugLog('info', 'ActivationViewModel', 'Submit started', { 
      hasKey: !!this.activationKey,
      keyLength: this.activationKey?.length,
      hasUserId: !!this.userId
    });
    
    // Input validation - check if empty
    if (!this.activationKey || !this.activationKey.trim()) {
      console.log('❌ [useActivation] Empty activation key');
      debugLog('warn', 'ActivationViewModel', 'Empty activation key submitted');
      this.error = 'Activation code is required';
      this.errorType = 'validation';
      this.submitted = true;
      this.isValidCode = false;
      this.notifyStateChange();
      return false;
    }
    
    // Accept any string with minimum 4 characters
    const trimmedKey = this.activationKey.trim();
    console.log('🔑 [useActivation] Trimmed key:', trimmedKey);
    console.log('🔑 [useActivation] Trimmed length:', trimmedKey.length);
    
    if (trimmedKey.length < 4) {
      console.log('❌ [useActivation] Key too short (min 4 chars)');
      this.error = 'Activation code must be at least 4 characters';
      this.errorType = 'validation';
      this.submitted = true;
      this.isValidCode = false;
      this.notifyStateChange();
      return false;
    }
    
    this.isLoading = true;
    this.error = '';
    this.errorType = null;
    this.notifyStateChange();
    
    try {
      console.log('📡 [useActivation] Calling activationService.validateKey with:', trimmedKey);
      
      // Validate with backend
      const validationResult = await this.activationService.validateKey(trimmedKey);
      
      console.log('📊 [useActivation] Validation Result:', JSON.stringify(validationResult, null, 2));
      console.log('📊 [useActivation] Success:', validationResult.success);
      console.log('📊 [useActivation] Message:', validationResult.message);
      console.log('📊 [useActivation] Error code:', validationResult.errorCode);
      
      if (validationResult.success) {
        const branchNames = validationResult.data?.branchNames || [];
        const branchLocations = validationResult.data?.branchLocations || [];
        
        console.log('✅ [useActivation] Validation successful!');
        console.log('📊 [useActivation] Branches:', branchNames);
        console.log('📊 [useActivation] Branch count:', branchNames.length);
        console.log('👤 [useActivation] Manager:', validationResult.data.managerName);
        
        debugLog('info', 'ActivationViewModel', 'Key validation successful', {
          branchNames: branchNames,
          branchCount: branchNames.length
        });
        
        // Store branch info (multiple branches)
        this.branchInfo = {
          names: branchNames,
          locations: branchLocations,
          managerName: validationResult.data.managerName,
          managerEmail: validationResult.data.managerEmail,
          activationId: validationResult.data.activationId,
          code: validationResult.data.code
        };
        
        this.error = '';
        this.errorType = null;
        this.isValidCode = true;
        this.submitted = true;
        
        console.log('✅ [useActivation] Final state - branchInfo:', this.branchInfo);
        console.log('✅ [useActivation] Final state - isValidCode:', this.isValidCode);
        
        this.notifyStateChange();
        return true;
        
      } else {
        console.log('❌ [useActivation] Validation failed:', validationResult.message);
        console.log('❌ [useActivation] Error code:', validationResult.errorCode);
        
        // Set appropriate error message based on error code
        let errorMessage = validationResult.message || 'Invalid activation code';
        let errorType = validationResult.errorCode || 'unknown';
        
        // Check for specific error types
        if (validationResult.errorCode === 'RLS_ERROR') {
          errorMessage = 'Permission denied. Please check your activation code or contact support.';
          errorType = 'rls';
        } else if (validationResult.errorCode === 'NOT_FOUND') {
          errorMessage = 'Invalid activation code. Please check and try again.';
          errorType = 'not_found';
        } else if (validationResult.errorCode === 'ALREADY_USED') {
          errorMessage = 'This activation code has already been used.';
          errorType = 'used';
        } else if (validationResult.errorCode === 'EXPIRED') {
          errorMessage = 'Activation code has expired. Please request a new one.';
          errorType = 'expired';
        }
        
        debugLog('warn', 'ActivationViewModel', 'Validation failed', { 
          error: errorMessage,
          errorType: errorType
        });
        
        this.error = errorMessage;
        this.errorType = errorType;
        this.isValidCode = false;
        this.submitted = true;
        this.branchInfo = null;
        this.notifyStateChange();
        return false;
      }
      
    } catch (error) {
      console.error('❌ [useActivation] Error caught:', error);
      console.error('❌ [useActivation] Error message:', error.message);
      console.error('❌ [useActivation] Error stack:', error.stack);
      
      // Check if it's an RLS error
      if (isRLSError(error)) {
        console.log('🔒 [useActivation] RLS error detected');
        this.error = 'Permission denied. Please check your activation code or contact support.';
        this.errorType = 'rls';
      } else {
        this.error = error.message || 'Network error. Please check your connection.';
        this.errorType = 'network';
      }
      
      logError('ActivationViewModel', error);
      this.isValidCode = false;
      this.submitted = true;
      this.branchInfo = null;
      this.notifyStateChange();
      return false;
      
    } finally {
      this.isLoading = false;
      this.notifyStateChange();
      console.log('✅ [useActivation] Submit completed');
      console.log('📊 [useActivation] Final isValidCode:', this.isValidCode);
      debugLog('info', 'ActivationViewModel', 'Submit completed', { 
        success: this.isValidCode,
        branchCount: this.branchInfo?.names?.length || 0
      });
    }
  }
  
  async completeSetup(username, password) {
    console.log('🚀 [useActivation] completeSetup called');

    if (!this.branchInfo) {
      this.error = 'Please validate your activation code first';
      this.notifyStateChange();
      return { success: false, message: this.error };
    }

    this.isLoading = true;
    this.error = '';
    this.notifyStateChange();

    try {
      const registerResult = await this.authService.register({
        email: this.branchInfo.managerEmail,
        password,
        username,
      });

      if (!registerResult.success) {
      throw new Error(registerResult.message || 'Failed to create account');
      }

      const activationResult = await this.activationService.activateManager(
        this.activationKey,
        registerResult.user.id,
        { username, fullName: username }
      );

      if (!activationResult.success) {
        throw new Error(activationResult.message);
      }

      console.log('✅ [useActivation] Setup complete:', activationResult.data);

      return {
        success: true,
        hasSession: !!registerResult.session,
        profile: activationResult.data,
      };

    } catch (error) {
      console.error('❌ [useActivation] completeSetup error:', error);
      this.error = error.message || 'Setup failed. Please try again.';
      return { success: false, message: this.error };

    } finally {
      this.isLoading = false;
      this.notifyStateChange();
    }
  }

  reset() {
    console.log('🔄 [useActivation] Reset called');
    debugLog('debug', 'ActivationViewModel', 'Resetting state');
    this.activationKey = '';
    this.error = '';
    this.errorType = null;
    this.isValidCode = false;
    this.submitted = false;
    this.isLoading = false;
    this.branchInfo = null;
    this.notifyStateChange();
  }
}

/**
 * Custom hook for activation state management
 * Implements MVVM pattern
 */
export const useActivation = (userId) => {
  console.log('🎣 [useActivation] Hook called with userId:', userId);
  
  const [state, setState] = useState({
    activationKey: '',
    error: '',
    errorType: null,
    isValidCode: false,
    submitted: false,
    isLoading: false,
    branchInfo: null,
  });
  
  const viewModelRef = useRef(null);
  
  if (!viewModelRef.current) {
    console.log('🏗️ [useActivation] Creating new ActivationViewModel');
    viewModelRef.current = new ActivationViewModel(activationService, authService);
    viewModelRef.current.setOnStateChange((newState) => {
      console.log('🔄 [useActivation] State update:', newState);
      setState(newState);
    });
  }
  
  // Update userId if provided
  if (userId && viewModelRef.current.userId !== userId) {
    console.log('🆔 [useActivation] Updating userId in ViewModel:', userId);
    viewModelRef.current.setUserId(userId);
  }
  
  const viewModel = viewModelRef.current;
  
  const setActivationKey = useCallback((key) => {
    console.log('🔑 [useActivation] setActivationKey callback with:', key);
    viewModel.setActivationKey(key);
  }, [viewModel]);
  
  const submit = useCallback(async () => {
    console.log('🚀 [useActivation] submit callback invoked');
    return await viewModel.submit();
  }, [viewModel]);

  const completeSetup = useCallback(async (username, password) => {
    return await viewModel.completeSetup(username, password);
  }, [viewModel]);

  const reset = useCallback(() => {
    console.log('🔄 [useActivation] reset callback invoked');
    viewModel.reset();
  }, [viewModel]);

  return {
    ...state,
    setActivationKey,
    submit,
    completeSetup,   // NEW
    reset,
  };
  
  return {
    ...state,
    setActivationKey,
    submit,
    reset,
  };
};

export default useActivation;