// src/services/activationService.js
import { BaseService } from './BaseService';
import { debugLog, logError } from '../utils/logger';

class ActivationService extends BaseService {
  constructor(config) {
    super(config);
  }
  
  /**
   * Validate activation key
   * @param {string} key - Activation key
   * @returns {Promise<Object>} Validation result
   */
  async validateKey(key) {
    debugLog('info', 'ActivationService', 'Validating activation key', { key });
    
    try {
      // TODO: Replace with actual API call
      // const response = await this.post('/api/activate/validate', { activationKey: key });
      // return response;
      
      // Mock response
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const mockResponse = {
        success: key === '2026',
        message: key === '2026' ? 'Valid activation key' : 'Invalid activation key',
        data: key === '2026' ? { branchId: 1, branchName: 'CDO Branch' } : null
      };
      
      debugLog('info', 'ActivationService', 'Validation completed', mockResponse);
      return mockResponse;
      
    } catch (error) {
      logError('ActivationService', error, { key });
      throw error;
    }
  }
  
  /**
   * Get branches associated with activation key
   * @param {string} key - Activation key
   * @returns {Promise<Array>} List of branches
   */
  async getBranches(key) {
    debugLog('info', 'ActivationService', 'Fetching branches', { key });
    
    try {
      // TODO: Replace with actual API call
      // const response = await this.post('/api/activate/branches', { activationKey: key });
      // return response.branches;
      
      const mockBranches = [
        { id: 1, name: 'CDO Branch', code: 'CDO-001', location: 'Cagayan de Oro' },
        { id: 2, name: 'Butuan Branch', code: 'BUT-001', location: 'Butuan City' }
      ];
      
      debugLog('info', 'ActivationService', 'Branches fetched', { count: mockBranches.length });
      return mockBranches;
      
    } catch (error) {
      logError('ActivationService', error, { key });
      throw error;
    }
  }
  
  /**
   * Activate manager account
   * @param {string} key - Activation key
   * @param {Object} managerData - Manager information
   * @returns {Promise<Object>} Activation result
   */
  async activateManager(key, managerData) {
    debugLog('info', 'ActivationService', 'Activating manager', { key, managerData });
    
    try {
      // TODO: Replace with actual API call
      // const response = await this.post('/api/activate/manager', { activationKey: key, ...managerData });
      // return response;
      
      const mockResponse = {
        success: true,
        message: 'Manager account activated successfully',
        data: {
          managerId: 'MGR-001',
          branchId: 1,
          token: 'mock-jwt-token'
        }
      };
      
      debugLog('info', 'ActivationService', 'Activation completed', mockResponse);
      return mockResponse;
      
    } catch (error) {
      logError('ActivationService', error, { key });
      throw error;
    }
  }
}

// Singleton instance
const activationService = new ActivationService();
export default activationService;