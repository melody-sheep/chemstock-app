// src/services/authService.js
import { BaseService } from './BaseService';
import { supabase, isRLSError, getFriendlyErrorMessage } from './supabaseClient';
import { debugLog, logError } from '../utils/logger';

class AuthService extends BaseService {
  constructor() {
    super('AuthService');
    this.currentSession = null;
    console.log('🔐 [AuthService] Service initialized');
  }
  
  /**
   * Login user with Supabase Auth
   * @param {Object} credentials - { username, password }
   */
  async login(credentials) {
    console.log('========================================');
    console.log('🔐 [AuthService] Login attempt');
    console.log('👤 [AuthService] Username:', credentials.username);
    console.log('🔑 [AuthService] Password length:', credentials.password?.length);
    
    debugLog('info', 'AuthService', 'Login attempt', { 
      username: credentials.username 
    });
    
    try {
      // Validate input
      this.validateRequired(['username', 'password'], credentials);
      
      // Supabase uses email, but your system uses username
      const email = credentials.username.includes('@') 
        ? credentials.username 
        : `${credentials.username}@chemstock.local`;
      
      console.log('📧 [AuthService] Using email:', email);
      console.log('📡 [AuthService] Calling supabase.auth.signInWithPassword...');
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: credentials.password,
      });
      
      if (error) {
        console.error('❌ [AuthService] Sign in error:', error);
        console.error('❌ [AuthService] Error code:', error.code);
        console.error('❌ [AuthService] Error message:', error.message);
        throw error;
      }
      
      console.log('✅ [AuthService] Sign in successful');
      console.log('🆔 [AuthService] User ID:', data.user?.id);
      console.log('📧 [AuthService] User email:', data.user?.email);
      
      this.currentSession = data.session;
      
      // ✅ REMOVED: No profile fetching since profiles table is deleted
      // Just return the auth user data
      const result = {
        success: true,
        token: data.session.access_token,
        user: {
          id: data.user.id,
          email: data.user.email,
          username: data.user.email?.split('@')[0] || credentials.username,
          // No role or branch info yet - will come from activation
        }
      };
      
      console.log('✅ [AuthService] Login successful');
      console.log('👤 [AuthService] User ID:', result.user.id);
      
      debugLog('info', 'AuthService', 'Login successful', { 
        userId: result.user.id
      });
      
      return result;
      
    } catch (error) {
      console.error('❌ [AuthService] Login error:', error);
      console.error('❌ [AuthService] Error stack:', error.stack);
      
      this.handleError(error, { username: credentials.username });
      
      if (isRLSError(error)) {
        throw new Error('Permission denied. Please contact support.');
      }
      
      throw new Error(error.message === 'Invalid login credentials' 
        ? 'Invalid username or password' 
        : getFriendlyErrorMessage(error));
    }
  }
  
  /**
   * Register new user (for managers to create accounts)
   */
  async register(userData) {
    console.log('========================================');
    console.log('📝 [AuthService] Register attempt');
    console.log('👤 [AuthService] Email:', userData.email);
    console.log('🔑 [AuthService] Password length:', userData.password?.length);
    
    debugLog('info', 'AuthService', 'Register attempt', { email: userData.email });
    
    try {
      // Validate input
      this.validateRequired(['email', 'password', 'username'], userData);
      
      console.log('📡 [AuthService] Creating auth user...');
      
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
      });
      
      if (authError) {
        console.error('❌ [AuthService] Auth signup error:', authError);
        console.error('❌ [AuthService] Error code:', authError.code);
        console.error('❌ [AuthService] Error message:', authError.message);
        throw authError;
      }
      
      console.log('✅ [AuthService] Auth user created');
      console.log('🆔 [AuthService] User ID:', authData.user?.id);
      
      // ✅ REMOVED: Profile creation since profiles table is deleted
      // The activation will handle storing branch info later
      
      console.log('✅ [AuthService] Registration successful (no profile created)');
      
      debugLog('info', 'AuthService', 'Registration successful', { 
        userId: authData.user.id
      });
      
      return {
        success: true,
        user: {
          id: authData.user.id,
          email: authData.user.email,
          username: userData.username,
        },
        message: 'User registered successfully. Please activate your account.'
      };
      
    } catch (error) {
      console.error('❌ [AuthService] Register error:', error);
      console.error('❌ [AuthService] Error stack:', error.stack);
      
      this.handleError(error, userData);
      
      if (isRLSError(error)) {
        throw new Error('Permission denied to register. Please contact support.');
      }
      
      throw error;
    }
  }
  
  /**
   * Logout user
   */
  async logout() {
    console.log('🚪 [AuthService] Logout called');
    debugLog('info', 'AuthService', 'Logout');
    
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('❌ [AuthService] Logout error:', error);
        throw error;
      }
      
      this.currentSession = null;
      console.log('✅ [AuthService] Logout successful');
      debugLog('info', 'AuthService', 'Logout successful');
      
    } catch (error) {
      console.error('❌ [AuthService] Logout error:', error);
      this.handleError(error);
      throw error;
    }
  }
  
  /**
   * Get current authenticated user
   */
  async getCurrentUser() {
    console.log('👤 [AuthService] getCurrentUser called');
    debugLog('info', 'AuthService', 'Fetching current user');
    
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('❌ [AuthService] Session error:', sessionError);
        throw sessionError;
      }
      
      if (!session) {
        console.log('ℹ️ [AuthService] No active session');
        return null;
      }
      
      console.log('✅ [AuthService] Session found for user:', session.user?.id);
      
      // ✅ REMOVED: No profile fetching
      // Just return the auth user
      const user = {
        id: session.user.id,
        email: session.user.email,
        username: session.user.email?.split('@')[0],
        // No role or branch info yet
      };
      
      console.log('✅ [AuthService] User fetched:', user.username);
      
      return user;
      
    } catch (error) {
      console.error('❌ [AuthService] Error in getCurrentUser:', error);
      this.handleError(error);
      return null;
    }
  }
  
  /**
   * Check if user is authenticated
   */
  async isAuthenticated() {
    console.log('🔍 [AuthService] Checking authentication status');
    const { data: { session } } = await supabase.auth.getSession();
    const isAuth = !!session;
    console.log(`🔍 [AuthService] Is authenticated: ${isAuth}`);
    return isAuth;
  }
  
  /**
   * Get current session token
   */
  getToken() {
    const token = this.currentSession?.access_token || null;
    console.log(`🔑 [AuthService] Token available: ${!!token}`);
    return token;
  }
}

// Singleton instance
const authService = new AuthService();
console.log('✅ [AuthService] Service instance created');

export default authService;