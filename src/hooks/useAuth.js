// src/hooks/useAuth.js
import { useState, useCallback, useRef } from 'react';
import { debugLog, logError } from '../utils/logger';
import { UsernameStrategy, PasswordStrategy, CompositeStrategy } from '../utils/validationStrategies';
import authService from '../services/authService';

/**
 * Auth ViewModel class for OOP state management
 */
class AuthViewModel {
  constructor(authService) {
    this.authService = authService;
    this.usernameStrategy = new UsernameStrategy(3);
    this.passwordStrategy = new PasswordStrategy(4);
    
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
    debugLog('debug', 'AuthViewModel', 'Username changed', { username });
    this.username = username;
    this.usernameError = '';
    this.notifyStateChange();
  }
  
  setPassword(password) {
    debugLog('debug', 'AuthViewModel', 'Password changed', { length: password.length });
    this.password = password;
    this.passwordError = '';
    this.notifyStateChange();
  }
  
  validateForm() {
    debugLog('debug', 'AuthViewModel', 'Validating form');
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
    debugLog('info', 'AuthViewModel', 'Form validation completed', { isValid });
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
        debugLog('info', 'AuthViewModel', 'Login successful', { userId: result.user?.id });
        return true;
      }
      
      return false;
      
    } catch (error) {
      logError('AuthViewModel', error);
      this.passwordError = error.message || 'Login failed';
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
      this.notifyStateChange();
      debugLog('info', 'AuthViewModel', 'Logout successful');
      
    } catch (error) {
      logError('AuthViewModel', error);
    }
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
  
  const login = useCallback(async () => {
    return await viewModel.login();
  }, [viewModel]);
  
  const logout = useCallback(async () => {
    await viewModel.logout();
  }, [viewModel]);
  
  return {
    ...state,
    setUsername,
    setPassword,
    login,
    logout,
  };
};