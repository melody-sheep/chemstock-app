// src/services/deliveryService.js
import { BaseService } from './BaseService';
import { supabase } from './supabaseClient';
import { debugLog } from '../utils/logger';

class DeliveryService extends BaseService {
  constructor() {
    super('DeliveryService');
  }

  /**
   * A Collector's own collector-movement transactions, every stage
   * (pending_pickup / ready_to_deliver / in_transit / delivered) in one
   * call — same "return everything, client filters by a computed field"
   * shape as requestService.getBranchStockRequests/getMyStockRequests.
   */
  async getMyCollectorDeliveries(agentId, limit = 200) {
    debugLog('info', 'DeliveryService', 'Fetching my collector deliveries', { agentId, limit });

    if (!agentId) {
      return { success: true, data: [] };
    }

    try {
      const { data, error } = await supabase.rpc('get_my_collector_deliveries', {
        p_agent_id: agentId,
        p_limit: limit,
      });

      if (error) {
        console.error('[ERROR] [DeliveryService] get_my_collector_deliveries RPC error:', error);
        throw new Error(error.message || 'Failed to load deliveries');
      }

      return { success: true, data: data || [] };
    } catch (error) {
      this.log('error', 'getMyCollectorDeliveries failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to load deliveries', data: [] };
    }
  }

  /**
   * Groups one or more accepted, undelivered transactions into a new trip
   * (single delivery = a trip with one item) and flips them to in_transit.
   */
  async startDeliveryTrip({ agentId, transactionIds, latitude, longitude }) {
    debugLog('info', 'DeliveryService', 'Starting delivery trip', { agentId, count: transactionIds?.length });

    try {
      this.validateRequired(['agentId'], { agentId });
      if (!transactionIds || transactionIds.length === 0) {
        throw new Error('At least one delivery is required to start a trip');
      }

      const { data, error } = await supabase.rpc('start_delivery_trip', {
        p_agent_id: agentId,
        p_transaction_ids: transactionIds,
        p_latitude: latitude ?? null,
        p_longitude: longitude ?? null,
      });

      if (error) {
        console.error('[ERROR] [DeliveryService] start_delivery_trip RPC error:', error);
        throw new Error(error.message || 'Failed to start trip');
      }

      return { success: true, data };
    } catch (error) {
      this.log('error', 'startDeliveryTrip failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to start trip' };
    }
  }

  /**
   * Cancels an active trip — allowed at any point, even mid-batch. Legs
   * already delivered stay delivered; the rest revert to ready-to-deliver.
   */
  async cancelDeliveryTrip(agentId, tripId) {
    debugLog('info', 'DeliveryService', 'Cancelling delivery trip', { agentId, tripId });

    try {
      this.validateRequired(['agentId', 'tripId'], { agentId, tripId });

      const { error } = await supabase.rpc('cancel_delivery_trip', {
        p_agent_id: agentId,
        p_trip_id: tripId,
      });

      if (error) {
        console.error('[ERROR] [DeliveryService] cancel_delivery_trip RPC error:', error);
        throw new Error(error.message || 'Failed to cancel trip');
      }

      return { success: true };
    } catch (error) {
      this.log('error', 'cancelDeliveryTrip failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to cancel trip' };
    }
  }

  /**
   * Logs an event-triggered location checkpoint (Shopee-style, not live
   * GPS) — fans out to every still-in-transit leg of the trip server-side.
   */
  async logDeliveryCheckpoint({ agentId, tripId, latitude, longitude, label }) {
    debugLog('info', 'DeliveryService', 'Logging delivery checkpoint', { agentId, tripId, label });

    try {
      this.validateRequired(['agentId', 'tripId', 'label'], { agentId, tripId, label });

      const { data, error } = await supabase.rpc('log_delivery_checkpoint', {
        p_agent_id: agentId,
        p_trip_id: tripId,
        p_latitude: latitude ?? null,
        p_longitude: longitude ?? null,
        p_label: label,
      });

      if (error) {
        console.error('[ERROR] [DeliveryService] log_delivery_checkpoint RPC error:', error);
        throw new Error(error.message || 'Failed to log checkpoint');
      }

      return { success: true, data };
    } catch (error) {
      this.log('error', 'logDeliveryCheckpoint failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to log checkpoint' };
    }
  }

  /**
   * Finishes one delivery leg. Returns tripCompleted so the caller knows
   * whether to return to the dashboard or stay on the map for other stops.
   */
  async finishDeliveryLeg({ agentId, transactionId, latitude, longitude, label }) {
    debugLog('info', 'DeliveryService', 'Finishing delivery leg', { agentId, transactionId });

    try {
      this.validateRequired(['agentId', 'transactionId'], { agentId, transactionId });

      const { data, error } = await supabase.rpc('finish_delivery_leg', {
        p_agent_id: agentId,
        p_transaction_id: transactionId,
        p_latitude: latitude ?? null,
        p_longitude: longitude ?? null,
        p_label: label ?? null,
      });

      if (error) {
        console.error('[ERROR] [DeliveryService] finish_delivery_leg RPC error:', error);
        throw new Error(error.message || 'Failed to finish delivery');
      }

      return { success: true, data };
    } catch (error) {
      this.log('error', 'finishDeliveryLeg failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to finish delivery' };
    }
  }
}

const deliveryService = new DeliveryService();
export default deliveryService;
