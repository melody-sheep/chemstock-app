// src/utils/teamLocations.js
// The Manager's team (Sales Reps and Collectors in their branches) at the
// last place the app recorded each of them — a geotagged action, delivery
// checkpoint, daily report or stock request. Not live tracking. Shared by
// the Team Map and the release destination picker.
import authService from '../services/authService';
import { supabase } from '../services/supabaseClient';
import { getConnectionStatus } from '../services/connectionStatus';
import { resolveProfilePhotoUrls } from './profilePhoto';
import { photoForMap, savedPhotoDataUri } from './offlinePhoto';

export const TEAM_CACHE_KEY = 'manager-team-map';
export const ROLE_COLOR = { sales_rep: '#E63946', collector: '#F4A825' };
export const ROLE_LABEL = { sales_rep: 'Sales Rep', collector: 'Collector' };

// A failed load keeps the previous team instead of blanking the map.
export const loadTeamData = async (previous) => {
  const manager = await authService.getCurrentUser();
  const prev = previous?.managerId === manager?.id ? previous : null;
  const { data, error } = await supabase.rpc('get_team_last_locations');
  if (error || !Array.isArray(data)) return prev ?? { managerId: manager?.id, members: [] };
  const urls = await resolveProfilePhotoUrls(data.map((m) => m.photoPath));
  // Photos are saved on the phone so the map still shows faces offline.
  data.forEach((m) => urls[m.photoPath] && photoForMap(m.agentId, urls[m.photoPath]));
  return {
    managerId: manager?.id,
    members: data.map((m) => ({ ...m, photoUrl: urls[m.photoPath] || null })),
  };
};

/** Members with a location, photos swapped for the saved copies when offline. */
export async function teamForMap(members) {
  const located = (members || []).filter((m) => m.latitude != null && m.longitude != null);
  if (getConnectionStatus().online) return located;
  return Promise.all(located.map(async (m) => ({ ...m, photoUrl: await savedPhotoDataUri(m.agentId) })));
}
