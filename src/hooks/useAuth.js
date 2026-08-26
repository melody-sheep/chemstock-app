// src/hooks/useAuth.js
import { useState, useCallback, useRef } from 'react';
import { debugLog, logError } from '../utils/logger';
import {
  UsernameValidationStrategy,
  PasswordValidationStrategy
} from '../utils/validationStrategies';
import authService from '../services/authService';
import { isRLSError } from '../services/supabaseClient';

/**
 * Auth ViewModel class for OOP state management
 */
class AuthViewModel {
  constructor(authService) {
    this.authService = authService;
    this.usernameStrategy = new UsernameValidationStrategy(3, 50);
    this.passwordStrategy = new PasswordValidationStrategy(4);

    // State
    this.username = '';
    this.password = '';
    this.isLoading = false;
    this.usernameError = '';
    this.passwordError = '';
    this.isAuthenticated = false;
    this.user = null;

    // Callbacks for UI updates
    this.onStateChange = null;
  }

  setOnStateChange(callback) {
    this.onStateChange = callback;
  }

  notifyStateChange() {
    if (this.onStateChange) {
      this.onStateChange({
        username: this.username,
        password: this.password,
        isLoading: this.isLoading,
        usernameError: this.usernameError,
        passwordError: this.passwordError,
        isAuthenticated: this.isAuthenticated,
        user: this.user,
      });
    }
  }

  setUsername(username) {
    this.username = username;
    this.usernameError = '';
    this.notifyStateChange();
  }

  setPassword(password) {
    this.password = password;
    this.passwordError = '';
    this.notifyStateChange();
  }

  clearError() {
    this.usernameError = '';
    this.passwordError = '';
    this.notifyStateChange();
  }

  validateForm() {
    let isValid = true;

    if (!this.usernameStrategy.validate(this.username)) {
      this.usernameError = this.usernameStrategy.getErrorMessage();
      isValid = false;
    }

    if (!this.passwordStrategy.validate(this.password)) {
      this.passwordError = this.passwordStrategy.getErrorMessage();
      isValid = false;
    }

    this.notifyStateChange();
    return isValid;
  }

  async login() {
    debugLog('info', 'AuthViewModel', 'Login started');

    if (!this.validateForm()) {
      debugLog('warn', 'AuthViewModel', 'Form validation failed');
      return false;
    }

    this.isLoading = true;
    this.notifyStateChange();

    try {
      const result = await this.authService.login({
        username: this.username.trim(),
        password: this.password
      });

      if (result.success) {
        this.isAuthenticated = true;
        this.user = result.user;

        debugLog('info', 'AuthViewModel', 'Login successful', {
          userId: result.user?.id
        });
        return true;
      }

      console.warn('[WARN] [useAuth] Login failed:', result.message);
      this.passwordError = result.message || 'Invalid username or password';
      this.notifyStateChange();
      return false;

    } catch (error) {
      if (isRLSError(error)) {
        this.passwordError = 'Permission denied. Please contact support.';
      } else {
        this.passwordError = error.message || 'Login failed. Please check your connection.';
      }

      logError('AuthViewModel', error);
      this.notifyStateChange();
      return false;

    } finally {
      this.isLoading = false;
      this.notifyStateChange();
    }
  }

  async logout() {
    debugLog('info', 'AuthViewModel', 'Logout started');

    try {
      await this.authService.logout();
      this.isAuthenticated = false;
      this.user = null;
      this.username = '';
      this.password = '';
      this.usernameError = '';
      this.passwordError = '';
      this.notifyStateChange();
      debugLog('info', 'AuthViewModel', 'Logout successful');

    } catch (error) {
      logError('AuthViewModel', error);
    }
  }

  reset() {
    debugLog('debug', 'AuthViewModel', 'Resetting state');
    this.username = '';
    this.password = '';
    this.isLoading = false;
    this.usernameError = '';
    this.passwordError = '';
    this.isAuthenticated = false;
    this.user = null;
    this.notifyStateChange();
  }
}

/**
 * Custom hook for authentication state management
 * Implements MVVM pattern
 */
export const useAuth = () => {
  const [state, setState] = useState({
    username: '',
    password: '',
    isLoading: false,
    usernameError: '',
    passwordError: '',
    isAuthenticated: false,
    user: null,
  });

  const viewModelRef = useRef(null);

  if (!viewModelRef.current) {
    viewModelRef.current = new AuthViewModel(authService);
    viewModelRef.current.setOnStateChange((newState) => {
      setState(newState);
    });
  }

  const viewModel = viewModelRef.current;

  const setUsername = useCallback((username) => {
    viewModel.setUsername(username);
  }, [viewModel]);

  const setPassword = useCallback((password) => {
    viewModel.setPassword(password);
  }, [viewModel]);

  const clearError = useCallback(() => {
    viewModel.clearError();
  }, [viewModel]);

  const login = useCallback(async () => {
    return await viewModel.login();
  }, [viewModel]);

  const logout = useCallback(async () => {
    await viewModel.logout();
  }, [viewModel]);

  const reset = useCallback(() => {
    viewModel.reset();
  }, [viewModel]);

  return {
    ...state,
    setUsername,
    setPassword,
    clearError,
    login,
    logout,
    reset,
  };
};

export default useAuth;
