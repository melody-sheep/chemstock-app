// src/services/authService.js
import { BaseService } from './BaseService';
import { debugLog, logError } from '../utils/logger';

class AuthService extends BaseService {
  constructor(config) {
    super(config);
    this.token = null;
  }
  
  /**
   * Login user
   * @param {Object} credentials - User credentials
   * @returns {Promise<Object>} Login result with token and user data
   */
  async login(credentials) {
    debugLog('info', 'AuthService', 'Login attempt', { 
      username: credentials.username,
      passwordLength: credentials.password?.length 
    });
    
    try {
      // TODO: Replace with actual API call
      // const response = await this.post('/api/auth/login', credentials);
      // this.setToken(response.token);
      // return response;
      
      // Mock validation
      const isValid = credentials.username === 'admin' && credentials.password === 'admin123';
      
      if (isValid) {
        const mockResponse = {
          success: true,
          token: 'mock-jwt-token-12345',
          user: {
            id: 1,
            username: credentials.username,
            role: 'manager',
            branchId: 1,
            branchName: 'CDO Branch'
          }
        };
        
        this.setToken(mockResponse.token);
        debugLog('info', 'AuthService', 'Login successful', { userId: mockResponse.user.id });
        return mockResponse;
      } else {
        debugLog('warn', 'AuthService', 'Login failed - invalid credentials');
        throw new Error('Invalid username or password');
      }
      
    } catch (error) {
      logError('AuthService', error, { username: credentials.username });
      throw error;
    }
  }
  
  /**
   * Logout user
   */
  async logout() {
    debugLog('info', 'AuthService', 'Logout');
    
    try {
      // TODO: Implement actual API call
      // await this.post('/api/auth/logout');
      
      this.setToken(null);
      debugLog('info', 'AuthService', 'Logout successful');
      
    } catch (error) {
      logError('AuthService', error);
      throw error;
    }
  }
  
  /**
   * Get current authenticated user
   */
  async getCurrentUser() {
    debugLog('info', 'AuthService', 'Fetching current user');
    
    try {
      if (!this.token) {
        debugLog('warn', 'AuthService', 'No token found');
        return null;
      }
      
      // TODO: Implement actual API call
      // return await this.get('/api/auth/me');
      
      const mockUser = {
        id: 1,
        username: 'admin',
        role: 'manager',
        branchId: 1,
        branchName: 'CDO Branch'
      };
      
      debugLog('info', 'AuthService', 'User fetched', { userId: mockUser.id });
      return mockUser;
      
    } catch (error) {
      logError('AuthService', error);
      throw error;
    }
  }
  
  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    const hasToken = !!this.token;
    debugLog('debug', 'AuthService', 'Auth status checked', { isAuthenticated: hasToken });
    return hasToken;
  }
}

// Singleton instance
const authService = new AuthService();
export default authService;