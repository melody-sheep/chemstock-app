// src/services/authService.js
import { BaseService } from './BaseService';
import { supabase } from './supabaseClient';
import { debugLog, logError } from '../utils/logger';

class AuthService extends BaseService {
  constructor() {
    super();
    this.currentSession = null;
  }
  
  /**
   * Login user with Supabase Auth
   * @param {Object} credentials - { username, password }
   */
  async login(credentials) {
    debugLog('info', 'AuthService', 'Login attempt', { 
      username: credentials.username 
    });
    
    try {
      // Supabase uses email, but your system uses username
      // Assuming username is actually email, or you have email field
      const email = credentials.username.includes('@') 
        ? credentials.username 
        : `${credentials.username}@chemstock.local`;
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: credentials.password,
      });
      
      if (error) throw error;
      
      // Get user profile from user_profiles_table (no branches_table join)
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles_table')
        .select('*')
        .eq('id', data.user.id)
        .single();
      
      if (profileError && profileError.code !== 'PGRST116') {
        this.log('login', 'Profile fetch warning', profileError);
      }
      
      this.currentSession = data.session;
      
      // Get branch name from the profile's branch_names field (array)
      const branchName = profile?.branch_names && profile.branch_names.length > 0 
        ? profile.branch_names[0] 
        : null;
      
      const result = {
        success: true,
        token: data.session.access_token,
        user: {
          id: data.user.id,
          username: profile?.username || data.user.email?.split('@')[0] || credentials.username,
          role: profile?.role || 'sales_rep',
          branchId: profile?.branch_ids && profile.branch_ids.length > 0 
            ? profile.branch_ids[0] 
            : null,
          branchName: branchName,
          isActivated: profile?.is_activated || false,
        }
      };
      
      debugLog('info', 'AuthService', 'Login successful', { userId: result.user.id });
      return result;
      
    } catch (error) {
      this.handleError(error, { username: credentials.username });
      throw new Error(error.message === 'Invalid login credentials' 
        ? 'Invalid username or password' 
        : error.message);
    }
  }
  
  /**
   * Register new user (for managers to create accounts)
   */
  async register(userData) {
    debugLog('info', 'AuthService', 'Register attempt', { email: userData.email });
    
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
      });
      
      if (authError) throw authError;
      
      // Create profile in your table (no branch_id, use branch_names array)
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles_table')
        .insert([
          {
            id: authData.user.id,
            username: userData.username,
            email: userData.email,
            role: userData.role || 'sales_rep',
            branch_names: userData.branchNames || [],
            branch_ids: userData.branchIds || [],
            is_activated: userData.role === 'manager' ? false : true,
          }
        ])
        .select()
        .single();
      
      if (profileError) throw profileError;
      
      debugLog('info', 'AuthService', 'Registration successful', { userId: authData.user.id });
      
      return {
        success: true,
        user: profile,
        message: 'User registered successfully'
      };
      
    } catch (error) {
      this.handleError(error, userData);
      throw error;
    }
  }
  
  /**
   * Logout user
   */
  async logout() {
    debugLog('info', 'AuthService', 'Logout');
    
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      this.currentSession = null;
      debugLog('info', 'AuthService', 'Logout successful');
      
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }
  
  /**
   * Get current authenticated user
   */
  async getCurrentUser() {
    debugLog('info', 'AuthService', 'Fetching current user');
    
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) throw sessionError;
      if (!session) return null;
      
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles_table')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      if (profileError && profileError.code !== 'PGRST116') {
        this.log('getCurrentUser', 'Profile fetch warning', profileError);
      }
      
      const branchName = profile?.branch_names && profile.branch_names.length > 0 
        ? profile.branch_names[0] 
        : null;
      
      return {
        id: session.user.id,
        email: session.user.email,
        username: profile?.username || session.user.email?.split('@')[0],
        role: profile?.role || 'sales_rep',
        branchId: profile?.branch_ids && profile.branch_ids.length > 0 
          ? profile.branch_ids[0] 
          : null,
        branchName: branchName,
        isActivated: profile?.is_activated || false,
      };
      
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }
  
  /**
   * Check if user is authenticated
   */
  async isAuthenticated() {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  }
  
  /**
   * Get current session token
   */
  getToken() {
    return this.currentSession?.access_token || null;
  }
}

// Singleton instance
const authService = new AuthService();
export default authService;