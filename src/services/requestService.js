// src/services/requestService.js
import { BaseService } from './BaseService';
import { supabase } from './supabaseClient';
import { debugLog } from '../utils/logger';

class RequestService extends BaseService {
  constructor() {
    super('RequestService');
  }

  /**
   * Submits a Sales Rep/Collector's stock request — agent-facing, same
   * auth.uid()-is-always-null caveat as every other agent action (see
   * inventoryService.getTransactionByQrCodeForAgent for the full reasoning).
   */
  async submitStockRequest({ agentId, latitude, longitude, deviceModel, deviceOs, items }) {
    debugLog('info', 'RequestService', 'Submitting stock request', { agentId, itemCount: items?.length });

    try {
      this.validateRequired(['agentId'], { agentId });

      const { data, error } = await supabase.rpc('submit_stock_request', {
        p_agent_id: agentId,
        p_latitude: latitude ?? null,
        p_longitude: longitude ?? null,
        p_device_model: deviceModel ?? null,
        p_device_os: deviceOs ?? null,
        p_items: (items || []).map((item) => ({
          product_code: item.productCode,
          product_name: item.productName,
          quantity: item.quantity,
        })),
      });

      if (error) {
        console.error('[ERROR] [RequestService] submit_stock_request RPC error:', error);
        throw new Error(error.message || 'Failed to submit request');
      }

      return { success: true, data };
    } catch (error) {
      this.log('error', 'submitStockRequest failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to submit request' };
    }
  }

  /**
   * A Sales Rep/Collector's own request history (all statuses) — agent-facing.
   */
  async getMyStockRequests(agentId, limit = 20) {
    debugLog('info', 'RequestService', 'Fetching my stock requests', { agentId, limit });

    if (!agentId) {
      return { success: true, data: [] };
    }

    try {
      const { data, error } = await supabase.rpc('get_my_stock_requests', {
        p_agent_id: agentId,
        p_limit: limit,
      });

      if (error) {
        console.error('[ERROR] [RequestService] get_my_stock_requests RPC error:', error);
        throw new Error(error.message || 'Failed to load your requests');
      }

      return { success: true, data: data || [] };
    } catch (error) {
      this.log('error', 'getMyStockRequests failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to load your requests', data: [] };
    }
  }

  /**
   * All stock requests (any status) for the manager's branches — manager-
   * facing, real auth.uid(). Feeds both the Dashboard's pending-count stat
   * (caller filters status === 'pending') and the full request queue screen.
   */
  async getBranchStockRequests(limit = 50) {
    debugLog('info', 'RequestService', 'Fetching branch stock requests', { limit });

    try {
      const { data, error } = await supabase.rpc('get_branch_stock_requests', { p_limit: limit });

      if (error) {
        console.error('[ERROR] [RequestService] get_branch_stock_requests RPC error:', error);
        throw new Error(error.message || 'Failed to load requests');
      }

      return { success: true, data: data || [] };
    } catch (error) {
      this.log('error', 'getBranchStockRequests failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to load requests', data: [] };
    }
  }

  async acceptStockRequest(requestId) {
    debugLog('info', 'RequestService', 'Accepting stock request', { requestId });

    try {
      this.validateRequired(['requestId'], { requestId });

      const { error } = await supabase.rpc('accept_stock_request', { p_request_id: requestId });

      if (error) {
        console.error('[ERROR] [RequestService] accept_stock_request RPC error:', error);
        throw new Error(error.message || 'Failed to accept request');
      }

      return { success: true };
    } catch (error) {
      this.log('error', 'acceptStockRequest failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to accept request' };
    }
  }

  async declineStockRequest(requestId, reason) {
    debugLog('info', 'RequestService', 'Declining stock request', { requestId });

    try {
      this.validateRequired(['requestId'], { requestId });

      const { error } = await supabase.rpc('decline_stock_request', {
        p_request_id: requestId,
        p_reason: reason ?? null,
      });

      if (error) {
        console.error('[ERROR] [RequestService] decline_stock_request RPC error:', error);
        throw new Error(error.message || 'Failed to decline request');
      }

      return { success: true };
    } catch (error) {
      this.log('error', 'declineStockRequest failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to decline request' };
    }
  }

  /**
   * Links a completed release transaction back to the request it fulfilled,
   * for traceability. Called as a non-blocking follow-up right after a real
   * release_stock_batch call succeeds — the release itself is already the
   * source of truth, so a failure here should be logged, not surfaced as a
   * failure of the release.
   */
  async linkRequestFulfillment(requestId, transactionId) {
    debugLog('info', 'RequestService', 'Linking request fulfillment', { requestId, transactionId });

    try {
      this.validateRequired(['requestId', 'transactionId'], { requestId, transactionId });

      const { error } = await supabase.rpc('link_request_fulfillment', {
        p_request_id: requestId,
        p_transaction_id: transactionId,
      });

      if (error) {
        console.error('[ERROR] [RequestService] link_request_fulfillment RPC error:', error);
        throw new Error(error.message || 'Failed to link request fulfillment');
      }

      return { success: true };
    } catch (error) {
      this.log('error', 'linkRequestFulfillment failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to link request fulfillment' };
    }
  }
}

const requestService = new RequestService();
export default requestService;
