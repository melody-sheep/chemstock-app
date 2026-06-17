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
    
    console.log('🏗️ [useAuth] AuthViewModel initialized');
  }
  
  setOnStateChange(callback) {
    console.log('🔗 [useAuth] Setting onStateChange callback');
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
    console.log('👤 [useAuth] Username changed:', username);
    debugLog('debug', 'AuthViewModel', 'Username changed', { username });
    this.username = username;
    this.usernameError = '';
    this.notifyStateChange();
  }
  
  setPassword(password) {
    console.log('🔑 [useAuth] Password changed (length):', password?.length);
    debugLog('debug', 'AuthViewModel', 'Password changed', { length: password.length });
    this.password = password;
    this.passwordError = '';
    this.notifyStateChange();
  }
  
  clearError() {
    console.log('🧹 [useAuth] Clearing errors');
    debugLog('debug', 'AuthViewModel', 'Clearing errors');
    this.usernameError = '';
    this.passwordError = '';
    this.notifyStateChange();
  }
  
  validateForm() {
    console.log('🔍 [useAuth] Validating form');
    debugLog('debug', 'AuthViewModel', 'Validating form');
    let isValid = true;
    
    if (!this.usernameStrategy.validate(this.username)) {
      this.usernameError = this.usernameStrategy.getErrorMessage();
      isValid = false;
      console.log('❌ [useAuth] Username validation failed:', this.usernameError);
    }
    
    if (!this.passwordStrategy.validate(this.password)) {
      this.passwordError = this.passwordStrategy.getErrorMessage();
      isValid = false;
      console.log('❌ [useAuth] Password validation failed:', this.passwordError);
    }
    
    this.notifyStateChange();
    console.log(`✅ [useAuth] Form validation completed: ${isValid}`);
    debugLog('info', 'AuthViewModel', 'Form validation completed', { isValid });
    return isValid;
  }
  
  async login() {
    console.log('========================================');
    console.log('🚀 [useAuth] Login started');
    debugLog('info', 'AuthViewModel', 'Login started');
    
    if (!this.validateForm()) {
      console.log('❌ [useAuth] Form validation failed');
      debugLog('warn', 'AuthViewModel', 'Form validation failed');
      return false;
    }
    
    this.isLoading = true;
    this.notifyStateChange();
    
    try {
      console.log('📡 [useAuth] Calling authService.login...');
      
      const result = await this.authService.login({
        username: this.username.trim(),
        password: this.password
      });
      
      console.log('📊 [useAuth] Login result:', result);
      
      if (result.success) {
        this.isAuthenticated = true;
        this.user = result.user;
        console.log('✅ [useAuth] Login successful!');
        console.log('👤 [useAuth] User:', this.user?.username);
        console.log('🆔 [useAuth] User ID:', this.user?.id);
        
        debugLog('info', 'AuthViewModel', 'Login successful', { 
          userId: result.user?.id
        });
        return true;
      }
      
      console.log('❌ [useAuth] Login failed:', result.message);
      this.passwordError = result.message || 'Invalid username or password';
      this.notifyStateChange();
      return false;
      
    } catch (error) {
      console.error('❌ [useAuth] Login error:', error);
      console.error('❌ [useAuth] Error message:', error.message);
      console.error('❌ [useAuth] Error stack:', error.stack);
      
      if (isRLSError(error)) {
        console.log('🔒 [useAuth] RLS error detected');
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
      console.log('✅ [useAuth] Login completed');
    }
  }
  
  async logout() {
    console.log('🚪 [useAuth] Logout started');
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
      console.log('✅ [useAuth] Logout successful');
      debugLog('info', 'AuthViewModel', 'Logout successful');
      
    } catch (error) {
      console.error('❌ [useAuth] Logout error:', error);
      logError('AuthViewModel', error);
    }
  }
  
  reset() {
    console.log('🔄 [useAuth] Resetting state');
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
  console.log('🎣 [useAuth] Hook called');
  
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
    console.log('🏗️ [useAuth] Creating new AuthViewModel');
    viewModelRef.current = new AuthViewModel(authService);
    viewModelRef.current.setOnStateChange((newState) => {
      console.log('🔄 [useAuth] State update:', newState);
      setState(newState);
    });
  }
  
  const viewModel = viewModelRef.current;
  
  const setUsername = useCallback((username) => {
    console.log('👤 [useAuth] setUsername callback:', username);
    viewModel.setUsername(username);
  }, [viewModel]);
  
  const setPassword = useCallback((password) => {
    console.log('🔑 [useAuth] setPassword callback (length):', password?.length);
    viewModel.setPassword(password);
  }, [viewModel]);
  
  const clearError = useCallback(() => {
    console.log('🧹 [useAuth] clearError callback');
    viewModel.clearError();
  }, [viewModel]);
  
  const login = useCallback(async () => {
    console.log('🚀 [useAuth] login callback invoked');
    return await viewModel.login();
  }, [viewModel]);
  
  const logout = useCallback(async () => {
    console.log('🚪 [useAuth] logout callback invoked');
    await viewModel.logout();
  }, [viewModel]);
  
  const reset = useCallback(() => {
    console.log('🔄 [useAuth] reset callback invoked');
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