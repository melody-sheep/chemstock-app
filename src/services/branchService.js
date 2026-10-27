import { supabase } from './supabaseClient';
import { getConnectionStatus } from './connectionStatus';
import storage from '../utils/storage';

const BRANCH_CACHE_PREFIX = 'chemstock_cache_branches_';

const normalizeBranchIds = (branchIds) => [...new Set((branchIds || []).filter(Boolean))].sort();
const cacheKeyFor = (branchIds) => `${BRANCH_CACHE_PREFIX}${branchIds.join('_')}`;
const sortBranches = (branches) => [...branches].sort((a, b) => a.name.localeCompare(b.name));

class BranchService {
  async getBranches(branchIds) {
    const ids = normalizeBranchIds(branchIds);
    if (ids.length === 0) return [];

    const cacheKey = cacheKeyFor(ids);
    const cached = await storage.get(cacheKey);

    if (!getConnectionStatus().online) {
      return Array.isArray(cached) ? cached : [];
    }

    try {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .in('id', ids);

      if (error) throw new Error(error.message || 'Failed to load branches');

      const branches = sortBranches(data || []);
      await storage.set(cacheKey, branches);
      return branches;
    } catch (error) {
      console.error('[ERROR] [BranchService] Failed to load branches:', error);
      return Array.isArray(cached) ? cached : [];
    }
  }
}

export default new BranchService();
