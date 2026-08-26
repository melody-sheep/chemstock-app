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
  }

  setOnStateChange(callback) {
    this.onStateChange = callback;
  }

  setUserId(userId) {
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
    this.activationKey = key || '';
    this.error = '';
    this.errorType = null;
    this.submitted = false;
    this.isValidCode = false;
    this.branchInfo = null;
    this.notifyStateChange();
  }

  async submit() {
    debugLog('info', 'ActivationViewModel', 'Submit started', {
      hasKey: !!this.activationKey,
      keyLength: this.activationKey?.length,
      hasUserId: !!this.userId
    });

    // Input validation - check if empty
    if (!this.activationKey || !this.activationKey.trim()) {
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

    if (trimmedKey.length < 4) {
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
      // Validate with backend
      const validationResult = await this.activationService.validateKey(trimmedKey);

      if (validationResult.success) {
        const branchNames = validationResult.data?.branchNames || [];
        const branchLocations = validationResult.data?.branchLocations || [];

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

        this.notifyStateChange();
        return true;

      } else {
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
      // Check if it's an RLS error
      if (isRLSError(error)) {
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
      debugLog('info', 'ActivationViewModel', 'Submit completed', {
        success: this.isValidCode,
        branchCount: this.branchInfo?.names?.length || 0
      });
    }
  }

  async completeSetup(username, password) {
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

      debugLog('info', 'ActivationViewModel', 'Setup complete', {
        managerId: activationResult.data?.managerId
      });

      return {
        success: true,
        hasSession: !!registerResult.session,
        profile: activationResult.data,
      };

    } catch (error) {
      console.error('[ERROR] [useActivation] completeSetup error:', error);
      this.error = error.message || 'Setup failed. Please try again.';
      return { success: false, message: this.error };

    } finally {
      this.isLoading = false;
      this.notifyStateChange();
    }
  }

  reset() {
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
    viewModelRef.current = new ActivationViewModel(activationService, authService);
    viewModelRef.current.setOnStateChange((newState) => {
      setState(newState);
    });
  }

  // Update userId if provided
  if (userId && viewModelRef.current.userId !== userId) {
    viewModelRef.current.setUserId(userId);
  }

  const viewModel = viewModelRef.current;

  const setActivationKey = useCallback((key) => {
    viewModel.setActivationKey(key);
  }, [viewModel]);

  const submit = useCallback(async () => {
    return await viewModel.submit();
  }, [viewModel]);

  const completeSetup = useCallback(async (username, password) => {
    return await viewModel.completeSetup(username, password);
  }, [viewModel]);

  const reset = useCallback(() => {
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
