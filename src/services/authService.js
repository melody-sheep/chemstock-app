// src/services/authService.js
import { BaseService } from './BaseService';
import { supabase, isRLSError, getFriendlyErrorMessage } from './supabaseClient';
import { debugLog, logError } from '../utils/logger';
import storage from '../utils/storage';

// Agents (Sales Rep/Collector) log in via a username+password_hash RPC, not
// Supabase Auth, so there's no supabase.auth session to recover their
// identity from later. This key persists the agent's profile across
// screens/focus events instead — see login()'s agent branch and
// getCurrentUser()'s fallback below.
const AGENT_SESSION_KEY = 'chemstock_agent_session';

class AuthService extends BaseService {
  constructor() {
    super('AuthService');
    this.currentSession = null;
    console.log('[INFO] [AuthService] Service initialized');
  }

  /**
   * Look up branch names for a set of branch IDs.
   * Degrades gracefully (empty string) if the branches table is missing
   * or the lookup fails, so it never breaks login/session fetching.
   */
  async _fetchBranchNames(branchIds) {
    if (!branchIds || branchIds.length === 0) return '';

    try {
      const { data, error } = await supabase
        .from('branches')
        .select('name')
        .in('id', branchIds);

      if (error) {
        console.error('[ERROR] [AuthService] Branch fetch error:', error);
        return '';
      }

      return (data || []).map((b) => b.name).join(', ');
    } catch (error) {
      console.error('[ERROR] [AuthService] Branch fetch error:', error);
      return '';
    }
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
        console.error(`[ERROR] [AuthService] Agent login RPC error: ${agentLoginError.message}`);
      }

      if (agentProfile && agentProfile.id) {
        console.log('[INFO] [AuthService] Agent login successful:', agentProfile.username);
        const branchName = await this._fetchBranchNames(agentProfile?.branch_ids);

        const agentUser = {
          id: agentProfile.id,
          email: null,
          username: agentProfile.username,
          full_name: agentProfile.full_name,
          role: agentProfile.role,
          branchIds: agentProfile.branch_ids || [],
          branchName,
          isActivated: true,
          authMode: 'agent',
        };

        // Clear any stale real Supabase session first — getCurrentUser()
        // checks supabase.auth.getSession() before the agent session, so a
        // leftover session from a *previous, different* Supabase-Auth login
        // that was never signed out would otherwise win and return the
        // wrong person entirely.
        await supabase.auth.signOut();

        // No Supabase Auth session exists for agents, so persist this
        // manually — getCurrentUser() reads it back on every screen focus.
        await storage.set(AGENT_SESSION_KEY, agentUser);

        return {
          success: true,
          token: null,
          user: agentUser,
        };
      }

        //========================================
        //2. Fall back to Supabase Auth (manager / admin login)
        //========================================
        let email = trimmedUsername;
        if (!email.includes('@')) {
          const { data: resolvedEmail, error: lookupError } = await supabase.rpc(
            'get_email_by_username',
            { p_username: trimmedUsername }
          );

          if (lookupError || !resolvedEmail) {
            console.warn('[WARN] [AuthService] Username not found:', email);
            throw new Error('Invalid username or password');
          }
          email = resolvedEmail;
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: credentials.password,
        });

        if (error) {
          throw error;
        }

        this.currentSession = data.session;

        // Mirror of the agent branch above — clear any stale agent session
        // so a later-expired Supabase session can't fall back to it.
        await storage.remove(AGENT_SESSION_KEY);

        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profileError) {
          console.error('[ERROR] [AuthService] Profile fetch error:', profileError);
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
            
        debugLog('info', 'AuthService', 'Login successful', {userId: result.user.id});
        return result;

      } catch (error) {
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
    debugLog('info', 'AuthService', 'Register attempt', { email: userData.email });

    try {
      // Validate input
      this.validateRequired(['email', 'password', 'username'], userData);

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
      });

      if (authError) {
        console.error('[ERROR] [AuthService] Auth signup error:', authError);
        throw authError;
      }

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
      // Never pass the raw userData through — it still has the plaintext
      // password on it, and handleError logs its context object verbatim.
      this.handleError(error, { email: userData.email, username: userData.username });

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
    debugLog('info', 'AuthService', 'Logout');

    try {
      // Always clear the agent session — harmless no-op for a Supabase-Auth
      // user (manager), required for an agent (no Supabase session to sign
      // out of at all).
      await storage.remove(AGENT_SESSION_KEY);

      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }

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

      if (sessionError) {
        throw sessionError;
      }

      if (!session) {
        // No active Supabase session — fall back to a persisted agent session.
        const agentUser = await storage.get(AGENT_SESSION_KEY);
        return agentUser;
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      const branchName = await this._fetchBranchNames(profile?.branch_ids);

      const user = {
        id: session.user.id,
        email: session.user.email,
        username: session.user.email?.split('@')[0],
        full_name: profile?.full_name || null,
        role: profile?.role || null,
        branchIds: profile?.branch_ids || [],
        branchName,
        isActivated: !!profile,
      };

      return user;

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
console.log('[INFO] [AuthService] Service instance created');

export default authService;