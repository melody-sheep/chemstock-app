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
                console.error('❌ [AgentService] Error creating agent account:', error);
                if (error.code === '23505') {
                    throw new Error('That username is already taken.');
                }
            throw new Error(error.message || 'Failed to create account');   
            }

            return { success: true, data };
        

        } catch (error) {
            this.logError(error, 'createAgentAccount', {error: error.message});
            return { success: false, error: error.message || 'Failed to create account' };
        }
    }
}

const agentService = new AgentService();
export default agentService;

