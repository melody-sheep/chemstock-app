// src/hooks/useActivation.js
import { useState, useCallback, useRef } from 'react';
import { debugLog, logError } from '../utils/logger';
import { ActivationKeyStrategy } from '../utils/validationStrategies';
import activationService from '../services/activationService';
import authService from '../services/authService';

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
    
    // Callbacks for UI updates
    this.onStateChange = null;
  }
  
  setOnStateChange(callback) {
    this.onStateChange = callback;
  }
  
  setUserId(userId) {
    this.userId = userId;
    console.log('🔍 [DEBUG] setUserId called:', userId);
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
      });
    }
  }
  
  setActivationKey(key) {
    console.log('🔍 [DEBUG] setActivationKey called with:', key);
    console.log('🔍 [DEBUG] setActivationKey type:', typeof key);
    console.log('🔍 [DEBUG] setActivationKey length:', key?.length);
    
    debugLog('debug', 'ActivationViewModel', 'Activation key changed', { 
      oldValue: this.activationKey, 
      newValue: key,
      length: key?.length 
    });
    
    this.activationKey = key || '';
    this.error = '';
    this.submitted = false;
    this.isValidCode = false;
    this.branchInfo = null;
    this.notifyStateChange();
  }
  
  async submit() {
    console.log('🚨🚨🚨 [DEBUG] SUBMIT FUNCTION CALLED! 🚨🚨🚨');
    console.log('🔍 [DEBUG] Activation key:', this.activationKey);
    console.log('🔍 [DEBUG] Activation key type:', typeof this.activationKey);
    console.log('🔍 [DEBUG] Activation key length:', this.activationKey?.length);
    console.log('🔍 [DEBUG] User ID:', this.userId);
    
    debugLog('info', 'ActivationViewModel', 'Submit started', { 
      hasKey: !!this.activationKey,
      keyLength: this.activationKey?.length,
      hasUserId: !!this.userId
    });
    
    // Input validation - check if empty
    if (!this.activationKey || !this.activationKey.trim()) {
      console.log('🔍 [DEBUG] Empty activation key');
      debugLog('warn', 'ActivationViewModel', 'Empty activation key submitted');
      this.error = 'Activation code is required';
      this.submitted = true;
      this.isValidCode = false;
      this.notifyStateChange();
      return false;
    }
    
    // Accept any string with minimum 4 characters
    const trimmedKey = this.activationKey.trim();
    console.log('🔍 [DEBUG] Trimmed key:', trimmedKey);
    console.log('🔍 [DEBUG] Trimmed length:', trimmedKey.length);
    
    if (trimmedKey.length < 4) {
      console.log('🔍 [DEBUG] Key too short (min 4 chars):', trimmedKey);
      this.error = 'Activation code must be at least 4 characters';
      this.submitted = true;
      this.isValidCode = false;
      this.notifyStateChange();
      return false;
    }
    
    this.isLoading = true;
    this.notifyStateChange();
    
    try {
      console.log('🔍 [DEBUG] Calling activationService.validateKey with:', trimmedKey);
      
      // Validate with backend
      const validationResult = await this.activationService.validateKey(trimmedKey);
      
      console.log('🔍 [DEBUG] Validation Result:', JSON.stringify(validationResult, null, 2));
      
      if (validationResult.success) {
        const branchNames = validationResult.data?.branchNames || [];
        const branchLocations = validationResult.data?.branchLocations || [];
        
        console.log('🔍 [DEBUG] Validation successful! Branches:', branchNames);
        
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
        this.isValidCode = true;
        this.submitted = true;
        
        console.log('🔍 [DEBUG] Final state - branchInfo:', this.branchInfo);
        console.log('🔍 [DEBUG] Final state - isValidCode:', this.isValidCode);
        
        this.notifyStateChange();
        return true;
        
      } else {
        console.log('🔍 [DEBUG] Validation failed:', validationResult.message);
        debugLog('warn', 'ActivationViewModel', 'Validation failed', { error: validationResult.message });
        this.error = validationResult.message || 'Invalid activation code';
        this.isValidCode = false;
        this.submitted = true;
        this.branchInfo = null;
        this.notifyStateChange();
        return false;
      }
      
    } catch (error) {
      console.log('🔍 [DEBUG] Error caught:', error.message);
      logError('ActivationViewModel', error);
      this.error = error.message || 'Network error. Please check your connection.';
      this.isValidCode = false;
      this.submitted = true;
      this.branchInfo = null;
      this.notifyStateChange();
      return false;
      
    } finally {
      this.isLoading = false;
      this.notifyStateChange();
      console.log('🔍 [DEBUG] Submit completed. isValidCode:', this.isValidCode);
      debugLog('info', 'ActivationViewModel', 'Submit completed', { 
        success: this.isValidCode,
        branchCount: this.branchInfo?.names?.length || 0
      });
    }
  }
  
  reset() {
    console.log('🔍 [DEBUG] Reset called');
    debugLog('debug', 'ActivationViewModel', 'Resetting state');
    this.activationKey = '';
    this.error = '';
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
  const [state, setState] = useState({
    activationKey: '',
    error: '',
    isValidCode: false,
    submitted: false,
    isLoading: false,
    branchInfo: null,
  });
  
  const viewModelRef = useRef(null);
  
  if (!viewModelRef.current) {
    console.log('🔍 [DEBUG] Creating new ActivationViewModel');
    viewModelRef.current = new ActivationViewModel(activationService, authService);
    viewModelRef.current.setOnStateChange((newState) => {
      console.log('🔍 [DEBUG] State update:', newState);
      setState(newState);
    });
  }
  
  // Update userId if provided
  if (userId && viewModelRef.current.userId !== userId) {
    console.log('🔍 [DEBUG] Updating userId in ViewModel:', userId);
    viewModelRef.current.setUserId(userId);
  }
  
  const viewModel = viewModelRef.current;
  
  const setActivationKey = useCallback((key) => {
    console.log('🔍 [DEBUG] setActivationKey callback with:', key);
    viewModel.setActivationKey(key);
  }, [viewModel]);
  
  const submit = useCallback(async () => {
    console.log('🔍 [DEBUG] submit callback invoked');
    return await viewModel.submit();
  }, [viewModel]);
  
  const reset = useCallback(() => {
    viewModel.reset();
  }, [viewModel]);
  
  return {
    ...state,
    setActivationKey,
    submit,
    reset,
  };
};

export default useActivation;