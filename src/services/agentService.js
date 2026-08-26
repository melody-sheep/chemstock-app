import { BaseService } from './BaseService';
import { supabase } from './supabaseClient';
import { debugLog } from '../utils/logger';

class AgentService extends BaseService {
    constructor() {
        super('AgentService');
    }

    async createAgentAccount ({username, fullName, password, role, branchIds}) {
        debugLog('info', 'AgentService', 'Creating agent account', { username, role });

        try {
            this.validateRequired(['username', 'fullName', 'password', 'role'], {
                username, fullName, password, role,
            });

            const { data, error } = await supabase.rpc('create_agent_account', {
                p_username: username.trim(),
                p_full_name: fullName.trim(),
                p_password: password,
                p_role: role,
                p_branch_ids: branchIds || [],
            });

            if (error) {
                console.error('[ERROR] [AgentService] Error creating agent account:', error);
                if (error.code === '23505') {
                    throw new Error('That username is already taken.');
                }
            throw new Error(error.message || 'Failed to create account');
            }

            return { success: true, data };


        } catch (error) {
            this.log('error', 'createAgentAccount failed', { error: error.message });
            return { success: false, message: error.message || 'Failed to create account' };
        }
    }

    async getMyAgentAccounts() {
        debugLog('info', 'AgentService', 'Fetching agent accounts');

        try {
            const { data, error } = await supabase.rpc('get_my_agent_accounts');

            if (error) {
                console.error('[ERROR] [AgentService] Error fetching agent accounts:', error);
                throw new Error(error.message || 'Failed to load accounts');
            }

            const accounts = data || [];

            // Resolve every account's branch_ids to display names in one
            // batched query instead of one lookup per row.
            const allBranchIds = [...new Set(accounts.flatMap((a) => a.branch_ids || []))];
            let branchNameById = {};

            if (allBranchIds.length > 0) {
                const { data: branches, error: branchError } = await supabase
                    .from('branches')
                    .select('id, name')
                    .in('id', allBranchIds);

                if (branchError) {
                    console.error('[ERROR] [AgentService] Error fetching branch names:', branchError);
                } else {
                    branchNameById = Object.fromEntries((branches || []).map((b) => [b.id, b.name]));
                }
            }

            const enriched = accounts.map((account) => ({
                ...account,
                branchName: (account.branch_ids || [])
                    .map((id) => branchNameById[id])
                    .filter(Boolean)
                    .join(', '),
            }));

            return { success: true, data: enriched };

        } catch (error) {
            this.log('error', 'getMyAgentAccounts failed', { error: error.message });
            return { success: false, message: error.message || 'Failed to load accounts', data: [] };
        }
    }

    async deleteAgentAccount(agentId) {
        debugLog('info', 'AgentService', 'Deleting agent account', { agentId });

        try {
            this.validateRequired(['agentId'], { agentId });

            const { error } = await supabase.rpc('delete_agent_account', { p_agent_id: agentId });

            if (error) {
                console.error('[ERROR] [AgentService] Error deleting agent account:', error);
                throw new Error(error.message || 'Failed to remove account');
            }

            return { success: true };

        } catch (error) {
            this.log('error', 'deleteAgentAccount failed', { error: error.message });
            return { success: false, message: error.message || 'Failed to remove account' };
        }
    }
}

const agentService = new AgentService();
export default agentService;

