// src/services/authService.js
import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { BaseService } from './BaseService';
import { supabase, isRLSError, getFriendlyErrorMessage, hasStoredAuthSession, clearStoredAuthSession } from './supabaseClient';
import { setPresenceIdentity } from './presenceService';
import { getConnectionStatus } from './connectionStatus';
import { debugLog, logError } from '../utils/logger';
import storage from '../utils/storage';
import { resolveProfilePhotoUrl } from '../utils/profilePhoto';
import branchService from './branchService';

// Agents (Sales Rep/Collector) log in via a username+password_hash RPC, not
// Supabase Auth, so there's no supabase.auth session to recover their
// identity from later. This key persists the agent's profile across
// screens/focus events instead — see login()'s agent branch and
// getCurrentUser()'s fallback below.
const AGENT_SESSION_KEY = 'chemstock_agent_session';

// Mirrors AGENT_SESSION_KEY, but for Supabase-Auth users (managers/admins).
// Unlike agents, managers DO have a real Supabase session restored from
// AsyncStorage automatically — but rebuilding the app-level `user` object
// (role, branch, name) still required a *live* user_profiles fetch with no
// offline fallback, so a manager who closed the app without logging out and
// came back offline would have their valid session thrown away. This caches
// the last successfully-fetched profile so that fetch can degrade instead.
const MANAGER_PROFILE_CACHE_KEY = 'chemstock_manager_profile_cache';

// getCurrentUser() costs several round trips (session, profile, branch names,
// photo URL, and for agents an RPC), and nearly every screen calls it on
// focus. A result this recent is reused; login and logout clear it.
const CURRENT_USER_TTL_MS = 60 * 1000;
let currentUserCache = null;

// One load shared by every screen that asks at the same time.
let currentUserRequest = null;
// Bumped on login, logout and clear, so a load that started before one of
// those can't write the previous user back into the cache when it finishes.
let currentUserGeneration = 0;

// A Supabase token refresh retries for up to ~30 s and each try can wait the
// full request time limit, so a load is capped here and falls back to the
// login saved on the phone.
const CURRENT_USER_LOAD_TIMEOUT_MS = 20 * 1000;
const LOAD_TIMED_OUT = Symbol('load-timed-out');

const withTimeout = (promise, ms, fallbackValue) => {
  let timer;
  return Promise.race([
    promise,
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(fallbackValue), ms);
    }),
  ]).finally(() => clearTimeout(timer));
};

// How long log out waits for the server to end the session before moving on.
const LOGOUT_SERVER_WAIT_MS = 4000;

// Set while this app itself logs in or out, so the "signed out" event those
// cause isn't mistaken for the server ending the login (see endedByServer).
let ownAuthChanges = 0;
const duringOwnAuthChange = async (work) => {
  ownAuthChanges += 1;
  try {
    return await work();
  } finally {
    // supabase-js fires its event just after the call returns.
    setTimeout(() => {
      ownAuthChanges -= 1;
    }, 1000);
  }
};

const resetCurrentUser = () => {
  currentUserCache = null;
  currentUserRequest = null;
  currentUserGeneration += 1;
};

class AuthService extends BaseService {
  constructor() {
    super('AuthService');
    this.currentSession = null;
    console.log('[INFO] [AuthService] Service initialized');
  }

  /**
   * Look up branch names for a set of branch IDs.
   * Uses the persisted branch-record cache when offline so it never blocks
   * session restoration on a live branch lookup.
   */
  async _fetchBranchNames(branchIds) {
    if (!branchIds || branchIds.length === 0) return '';

    try {
      const branches = await branchService.getBranches(branchIds);
      return branches.map((branch) => branch.name).join(', ');
    } catch (error) {
      console.error('[ERROR] [AuthService] Branch fetch error:', error);
      return '';
    }
  }

  /**
   * Resolves a profile photo's storage path into a short-lived signed URL —
   * same bucket/TTL pattern as every other photo display in this app (e.g.
   * ReturnStockVerifyScreen.js). Degrades to null on any failure so a
   * missing/broken photo never blocks the rest of getCurrentUser().
   */
  async _resolveProfilePhotoUrl(storagePath) {
    return resolveProfilePhotoUrl(storagePath);
  }

  /**
   * Login user with Supabase Auth
   * @param {Object} credentials - { username, password }
   */
  async login(credentials) {
    return duringOwnAuthChange(() => this._login(credentials));
  }

  async _login(credentials) {
    resetCurrentUser();
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

        // The request never reached the server, so nothing was checked.
        // Without this, an offline login fell through to the username
        // lookup below and was reported as wrong credentials.
        if (!getConnectionStatus().online) {
          throw new Error('No internet connection. Signing in needs a connection — please reconnect and try again.');
        }
        // Locked after too many wrong passwords (verify_agent_login): say so
        // instead of falling through to "Invalid username or password".
        if (/Too many failed attempts/i.test(agentLoginError.message || '')) {
          throw new Error(agentLoginError.message);
        }
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
        // Mirror of the manager branch below, so the offline fallback can
        // never restore a previous manager on this phone.
        await storage.remove(MANAGER_PROFILE_CACHE_KEY);

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

          if (/Too many failed attempts/i.test(lookupError?.message || '')) {
            throw new Error(lookupError.message);
          }
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
            phoneNumber: profile?.phone_number || null,
            isActivated: !!profile,
            authMode: 'supabase',
          }
        };

        // Cache immediately on login too, not just on later getCurrentUser()
        // calls — so the offline fallback below has something to use even if
        // the app is closed right after this first login.
        await storage.set(MANAGER_PROFILE_CACHE_KEY, result.user);

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

      // A saved agent login takes priority on launch (see _loadCurrentUser),
      // so a manager activated on a phone an agent used must clear it.
      await storage.remove(AGENT_SESSION_KEY);

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
    return duringOwnAuthChange(() => this._logout());
  }

  async _logout() {
    resetCurrentUser();
    setPresenceIdentity(null);
    debugLog('info', 'AuthService', 'Logout');

    // Always clear both cached sessions — harmless no-op for whichever
    // auth mode the current user wasn't using, and prevents a stale
    // profile from a previous account leaking into the offline fallback
    // below for whoever logs in next on this device.
    try {
      await storage.remove(AGENT_SESSION_KEY);
      await storage.remove(MANAGER_PROFILE_CACHE_KEY);
    } catch (error) {
      debugLog('warn', 'AuthService', 'Could not clear the saved profile on log out', { error: error.message });
    }

    // Log out never fails and never makes the user wait on the network:
    // offline it goes straight through, online the server gets a few
    // seconds to end the session. If it can't, the saved login is removed
    // from this phone anyway (it expires on the server by itself).
    if (getConnectionStatus().online) {
      let timer;
      try {
        await Promise.race([
          supabase.auth.signOut(),
          new Promise((resolve) => {
            timer = setTimeout(resolve, LOGOUT_SERVER_WAIT_MS);
          }),
        ]);
      } catch (error) {
        debugLog('warn', 'AuthService', 'Server sign-out failed, logging out on this phone only', { error: error.message });
      } finally {
        clearTimeout(timer);
      }
    } else {
      debugLog('info', 'AuthService', 'Offline — logging out on this phone only');
    }
    await clearStoredAuthSession();

    this.currentSession = null;
    debugLog('info', 'AuthService', 'Logout successful');
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser() {
    if (currentUserCache && Date.now() - currentUserCache.fetchedAt < CURRENT_USER_TTL_MS) {
      debugLog('debug', 'Cache', 'Current user reused', { ageMs: Date.now() - currentUserCache.fetchedAt });
      return currentUserCache.user;
    }
    // Offline, a refetch can only fail after its timeouts — keep the user
    // already known instead of making every screen wait for that.
    if (currentUserCache?.user && !getConnectionStatus().online) {
      debugLog('debug', 'Cache', 'Current user reused while offline', { ageMs: Date.now() - currentUserCache.fetchedAt });
      return currentUserCache.user;
    }
    // Same offline shortcut straight after launch, before anything is in memory.
    if (!getConnectionStatus().online) {
      const savedUser = await this.getSavedUser();
      if (savedUser) {
        debugLog('info', 'Auth', 'Offline — using the login saved on this phone', { role: savedUser.role });
        // fetchedAt 0: the first call once back online refreshes it.
        currentUserCache = { user: savedUser, fetchedAt: 0 };
        return savedUser;
      }
    }
    if (!currentUserRequest) {
      const request = this._loadCurrentUserCapped();
      currentUserRequest = request;
      request.finally(() => {
        if (currentUserRequest === request) currentUserRequest = null;
      }).catch(() => {});
    } else {
      debugLog('debug', 'Auth', 'Current user load already running, sharing it');
    }
    return currentUserRequest;
  }

  async _loadCurrentUserCapped() {
    const generation = currentUserGeneration;
    const startedAt = Date.now();
    let user = await withTimeout(this._loadCurrentUser(), CURRENT_USER_LOAD_TIMEOUT_MS, LOAD_TIMED_OUT);
    const timedOut = user === LOAD_TIMED_OUT;
    if (timedOut) {
      user = await this.getSavedUser();
      debugLog('warn', 'Auth', 'Current user load timed out, using the login saved on this phone', { ms: Date.now() - startedAt, found: Boolean(user) });
    } else {
      debugLog('info', 'Cache', 'Current user loaded from server', { ms: Date.now() - startedAt });
    }
    // A login or logout happened meanwhile: don't overwrite it.
    if (generation !== currentUserGeneration) return currentUserCache?.user ?? user;
    setPresenceIdentity(user?.id);
    // A timed-out result is stored as stale, so the next call tries again.
    currentUserCache = { user, fetchedAt: timedOut ? 0 : Date.now() };
    return user;
  }

  /**
   * Called when supabase-js reports the manager's login was removed. That
   * only happens when the server refused the saved login (being offline
   * never removes it) — e.g. it was revoked or reused. Returns true when a
   * manager was using the app and has to log in again; the saved profile is
   * cleared so the phone doesn't keep treating them as logged in.
   */
  async endedByServer() {
    if (ownAuthChanges > 0) return false;
    if (await storage.get(AGENT_SESSION_KEY)) return false; // agents don't use Supabase logins
    if (!(await storage.get(MANAGER_PROFILE_CACHE_KEY))) return false;
    debugLog('warn', 'AuthService', 'Manager login was ended by the server, asking to log in again');
    resetCurrentUser();
    setPresenceIdentity(null);
    await storage.remove(MANAGER_PROFILE_CACHE_KEY).catch(() => {});
    return true;
  }

  /**
   * Resumes a Manager activation that stopped after the login account was
   * made (N5): signs in with the email + password just entered, so the
   * activation step can run again instead of failing on "already registered".
   */
  async signInForActivation(email, password) {
    const { data, error } = await duringOwnAuthChange(() => supabase.auth.signInWithPassword({ email, password }));
    if (error) throw error;
    await storage.remove(AGENT_SESSION_KEY);
    resetCurrentUser();
    return { user: data.user, session: data.session };
  }

  /** Forget the cached current user, e.g. after the profile is edited. */
  clearCurrentUserCache() {
    resetCurrentUser();
  }

  /**
   * The last signed-in user saved on this phone, read from storage only — no
   * network. Used when restoring a session takes too long on a bad connection.
   * An agent session wins because a manager login always removes it, so its
   * presence means an agent signed in last. A saved manager profile only
   * counts while the manager's Supabase login is also still on the phone.
   */
  /** Id of the user already loaded in memory, or null. No storage or network. */
  peekCurrentUserId() {
    return currentUserCache?.user?.id ?? null;
  }

  async getSavedUser() {
    const agentUser = await storage.get(AGENT_SESSION_KEY);
    if (agentUser) return agentUser;
    if (!(await hasStoredAuthSession())) return null;
    return storage.get(MANAGER_PROFILE_CACHE_KEY);
  }

  async _loadCurrentUser() {
    debugLog('info', 'AuthService', 'Fetching current user');

    try {
      // Checked before the Supabase session: a manager login always removes
      // this key, so if it's here an agent signed in last. A manager session
      // left behind by a sign-out that failed must not take over.
      const agentUser = await storage.get(AGENT_SESSION_KEY);

      const { data: { session }, error: sessionError } = agentUser
        ? { data: { session: null }, error: null }
        : await supabase.auth.getSession();

      if (sessionError) {
        // Offline, an expired access token can't be refreshed, but the
        // refresh token is still stored and will work once back online. Only
        // a real auth rejection (e.g. revoked token) should log the user out.
        if (isAuthRetryableFetchError(sessionError) || !getConnectionStatus().online) {
          const cachedManager = await storage.get(MANAGER_PROFILE_CACHE_KEY);
          if (cachedManager) {
            debugLog('info', 'AuthService', 'Token refresh failed offline, restored cached manager profile', { userId: cachedManager.id });
            return cachedManager;
          }
        }
        throw sessionError;
      }

      if (!session) {
        // No active Supabase session — fall back to a persisted agent session.
        if (!agentUser) {
          return agentUser;
        }

        // Agents have no real Supabase Auth session to key a fresh fetch
        // off of, so their profile — branch_ids especially — was previously
        // only ever captured once at login and cached forever. Re-verify
        // against the DB on every call instead, degrading gracefully to the
        // cached copy if the agent is offline or the refresh fails, rather
        // than breaking or force-logging-out an otherwise-working session.
        debugLog('info', 'AuthService', 'Refreshing agent profile', { agentId: agentUser.id, cachedBranchIds: agentUser.branchIds });
        try {
          const { data: freshProfile, error: refreshError } = await supabase.rpc('get_agent_profile', {
            p_agent_id: agentUser.id,
          });

          if (refreshError) {
            console.error('[ERROR] [AuthService] Agent profile refresh error:', refreshError);
            return agentUser;
          }

          debugLog('info', 'AuthService', 'Agent profile refresh RPC result', { freshProfile });

          if (!freshProfile) {
            // Agent no longer exists or is no longer sales_rep/collector —
            // keep the cached session rather than abruptly logging them out.
            console.warn('[WARN] [AuthService] get_agent_profile returned no row for agent id', agentUser.id);
            return agentUser;
          }

          const branchName = await this._fetchBranchNames(freshProfile.branch_ids);
          const profilePhotoUrl = await this._resolveProfilePhotoUrl(freshProfile.profile_photo_path);
          const refreshedUser = {
            ...agentUser,
            username: freshProfile.username,
            full_name: freshProfile.full_name,
            role: freshProfile.role,
            branchIds: freshProfile.branch_ids || [],
            branchName,
            profilePhotoUrl,
            phoneNumber: freshProfile.phone_number || null,
          };

          debugLog('info', 'AuthService', 'Agent profile refreshed', { branchIds: refreshedUser.branchIds, branchName: refreshedUser.branchName });

          await storage.set(AGENT_SESSION_KEY, refreshedUser);
          return refreshedUser;
        } catch (refreshException) {
          console.error('[ERROR] [AuthService] Agent profile refresh failed:', refreshException);
          return agentUser;
        }
      }

      // The session object above came straight from local storage, no
      // network needed. Rebuilding the app-level user (role, branch, name)
      // still needs a live profile fetch, which is the one thing that can
      // fail while offline — so it's isolated here with its own fallback,
      // same reasoning as the agent branch's refresh fallback above.
      try {
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*, media:profile_media_id(storage_path)')
          .eq('id', session.user.id)
          .single();

        if (profileError) throw profileError;

        const branchName = await this._fetchBranchNames(profile?.branch_ids);
        const profilePhotoUrl = await this._resolveProfilePhotoUrl(profile?.media?.storage_path);

        const user = {
          id: session.user.id,
          email: session.user.email,
          username: session.user.email?.split('@')[0],
          full_name: profile?.full_name || null,
          role: profile?.role || null,
          branchIds: profile?.branch_ids || [],
          branchName,
          profilePhotoUrl,
          phoneNumber: profile?.phone_number || null,
          isActivated: !!profile,
        };

        await storage.set(MANAGER_PROFILE_CACHE_KEY, user);
        return user;
      } catch (profileFetchError) {
        console.warn('[WARN] [AuthService] Profile fetch failed, trying cached profile:', profileFetchError.message);
        const cachedUser = await storage.get(MANAGER_PROFILE_CACHE_KEY);
        if (cachedUser && cachedUser.id === session.user.id) {
          debugLog('info', 'AuthService', 'Restored manager session from cached profile (offline)', { userId: cachedUser.id });
          return cachedUser;
        }
        // No cache to fall back to (e.g. first-ever launch while offline) —
        // nothing left to do but surface the failure like before.
        throw profileFetchError;
      }

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