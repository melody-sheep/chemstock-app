// src/hooks/useActivation.js
import { useState, useCallback, useRef } from 'react';
import { debugLog, logError } from '../utils/logger';
import { ActivationKeyStrategy } from '../utils/validationStrategies';
import activationService from '../services/activationService';

/**
 * Activation ViewModel class for OOP state management
 */
class ActivationViewModel {
  constructor(activationService) {
    this.activationService = activationService;
    this.validationStrategy = new ActivationKeyStrategy();
    
    // State
    this.activationKey = '';
    this.error = '';
    this.isValidCode = false;
    this.submitted = false;
    this.isLoading = false;
    this.branches = [];
    
    // Callbacks for UI updates
    this.onStateChange = null;
  }
  
  setOnStateChange(callback) {
    this.onStateChange = callback;
  }
  
  notifyStateChange() {
    if (this.onStateChange) {
      this.onStateChange({
        activationKey: this.activationKey,
        error: this.error,
        isValidCode: this.isValidCode,
        submitted: this.submitted,
        isLoading: this.isLoading,
        branches: this.branches,
      });
    }
  }
  
  setActivationKey(key) {
    debugLog('debug', 'ActivationViewModel', 'Activation key changed', { 
      oldValue: this.activationKey, 
      newValue: key,
      length: key.length 
    });
    
    this.activationKey = key;
    this.error = '';
    this.submitted = false;
    this.isValidCode = false;
    this.notifyStateChange();
  }
  
  async submit() {
    debugLog('info', 'ActivationViewModel', 'Submit started', { 
      hasKey: !!this.activationKey,
      keyLength: this.activationKey.length 
    });
    
    // Input validation
    if (!this.activationKey.trim()) {
      debugLog('warn', 'ActivationViewModel', 'Empty activation key submitted');
      this.error = 'Activation code is required';
      this.submitted = true;
      this.isValidCode = false;
      this.notifyStateChange();
      return false;
    }
    
    // Format validation
    if (!this.validationStrategy.validate(this.activationKey)) {
      debugLog('warn', 'ActivationViewModel', 'Invalid format', { key: this.activationKey });
      this.error = this.validationStrategy.getErrorMessage();
      this.submitted = true;
      this.isValidCode = false;
      this.notifyStateChange();
      return false;
    }
    
    this.isLoading = true;
    this.notifyStateChange();
    
    try {
      // Validate with backend
      const validationResult = await this.activationService.validateKey(this.activationKey.trim());
      
      if (validationResult.success) {
        debugLog('info', 'ActivationViewModel', 'Activation successful');
        
        // Fetch branches
        const branches = await this.activationService.getBranches(this.activationKey.trim());
        
        this.branches = branches;
        this.error = '';
        this.isValidCode = true;
        this.submitted = true;
        
        debugLog('info', 'ActivationViewModel', 'Branches fetched', { count: branches.length });
        this.notifyStateChange();
        return true;
        
      } else {
        debugLog('warn', 'ActivationViewModel', 'Activation failed', { error: validationResult.message });
        this.error = validationResult.message || 'Invalid activation code';
        this.isValidCode = false;
        this.submitted = true;
        this.notifyStateChange();
        return false;
      }
      
    } catch (error) {
      logError('ActivationViewModel', error);
      this.error = 'Network error. Please check your connection.';
      this.isValidCode = false;
      this.submitted = true;
      this.notifyStateChange();
      return false;
      
    } finally {
      this.isLoading = false;
      this.notifyStateChange();
      debugLog('info', 'ActivationViewModel', 'Submit completed', { 
        success: this.isValidCode,
        finalError: this.error || 'none'
      });
    }
  }
  
  reset() {
    debugLog('debug', 'ActivationViewModel', 'Resetting state');
    this.activationKey = '';
    this.error = '';
    this.isValidCode = false;
    this.submitted = false;
    this.isLoading = false;
    this.branches = [];
    this.notifyStateChange();
  }
}

/**
 * Custom hook for activation state management
 * Implements MVVM pattern
 */
export const useActivation = () => {
  const [state, setState] = useState({
    activationKey: '',
    error: '',
    isValidCode: false,
    submitted: false,
    isLoading: false,
    branches: [],
  });
  
  const viewModelRef = useRef(null);
  
  if (!viewModelRef.current) {
    viewModelRef.current = new ActivationViewModel(activationService);
    viewModelRef.current.setOnStateChange((newState) => {
      setState(newState);
    });
  }
  
  const viewModel = viewModelRef.current;
  
  const setActivationKey = useCallback((key) => {
    viewModel.setActivationKey(key);
  }, [viewModel]);
  
  const submit = useCallback(async () => {
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