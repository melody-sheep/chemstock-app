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
    
    debugLog('info', 'AuthService', 'Login attempt', { 
      username: credentials.username 
    });
    
    try {   
      // Validate input
      this.validateRequired(['username', 'password'], credentials);
      const trimmedUsername = credentials.username.trim();

      //========================================
      //1. Try agent (Sales Rep / Collector) login first
      //No Supabase Auth involved - just a username + password_hash
      //Row in user_profiles, verified server-side
      //========================================
      const { data: agentProfile, error: agentLoginError } = await supabase.rpc('verify_agent_login', {
        p_username: trimmedUsername,
        p_password: credentials.password,
      }); 

      if (agentLoginError) {
        console.error(`❌ [AuthService] Agent login RPC error: ${agentLoginError.message}`);
      }

      if (agentProfile) {
        console.log('✅ [AuthService] Agent login successful:', agentProfile.username);
        const branchName = await this._fetchBranchNames(agentProfile?.branch_ids);

        return {
          success: true,
          token: null, 
          user: {
            id: agentProfile.id,
            email: null,
            username: agentProfile.username,
            full_name: agentProfile.full_name,
            role: agentProfile.role,
            branchIds: agentProfile.branch_ids || [],
            branchName,
            isActivated: true,
            authMode: 'agent',
          },
        };
      }

        //========================================
        //2. Fall back to Supabase Auth (manager / admin login)
        //========================================
        let email = trimmedUsername;
        if (!email.includes('@')) {
          console.log('📡 [AuthService] Resolving username to email via RPC...');
          const { data: resolvedEmail, error: lookupError } = await supabase.rpc(
            'get_email_by_username',
            { p_username: trimmedUsername }
          );

          if (lookupError || !resolvedEmail) {
            console.warn('⚠️ [AuthService] Username not found:', email);
            throw new Error('Invalid username or password');
          }
          email = resolvedEmail;
        }

        console.log('📧 [AuthService] Using email:', email);

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: credentials.password,
        });

        if (error) {
          throw error;
        }

        this.currentSession = data.session;

        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profileError) {
          console.error('❌ [AuthService] Profile fetch error:', profileError);
        }

        const branchName = await this._fetchBranchNames(profile?.branch_ids);

        const result = {
          success: true,
          token: data.session.access_token,
          user: {
            id: data.user.id,
            email: data.user.email,
            username: profile?.username || data.user.email?.split('@')[0] || credentials.username,
            full_name: profile?.full_name || null,
            role: profile?.role || null,
            branchIds: profile?.branch_ids || [],
            branchName,
            isActivated: !!profile,
            authMode: 'supabase',
          }
        };
            
        console.log('✅ [AuthService] Login successful');
        debugLog('info', 'AuthService', 'Login successful', {userId: result.user.id});
        return result;
        
      } catch (error) {
          console.error('❌ [AuthService] Login error:', error);

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
        session: authData.session, 
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
      
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      const user = {
        id: session.user.id,
        email: session.user.email,
        username: session.user.email?.split('@')[0],
        full_name: profile?.full_name || null,
        role: profile?.role || null,
        branchIds: profile?.branch_ids || [],
        isActivated: !!profile,
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