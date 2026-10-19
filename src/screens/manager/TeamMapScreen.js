// src/screens/manager/TeamMapScreen.js
// Manager's team map: every Sales Rep and Collector in the manager's branches
// at the last place the app recorded them (a geotagged action, delivery
// checkpoint, daily report or stock request), with when that was. Not live
// tracking — the app only knows a location when the agent does something.
import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Header from '../../components/common/Header';
import StaticRouteMap from '../../components/common/StaticRouteMap';
import MapZoomControls from '../../components/common/MapZoomControls';
import MapLegend from '../../components/common/MapLegend';
import ConnectionPill from '../../components/common/ConnectionPill';
import UserAvatar from '../../components/common/UserAvatar';
import useCachedFocusLoader from '../../hooks/useCachedFocusLoader';
import { describePresence } from '../../services/presenceService';
import { savedPhotoDataUri } from '../../utils/offlinePhoto';
import { TEAM_CACHE_KEY, ROLE_COLOR, ROLE_LABEL, loadTeamData } from '../../utils/teamLocations';
import { getInitials } from '../../utils/initials';
import { formatCheckpointTime } from '../../utils/formatters';
import { getConnectionStatus } from '../../services/connectionStatus';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const LEGEND = [
  { label: 'Sales Rep', color: ROLE_COLOR.sales_rep, shape: 'dot' },
  { label: 'Collector', color: ROLE_COLOR.collector, shape: 'dot' },
];

export default function TeamMapScreen() {
  const mapRef = useRef(null);
  const { data: snapshot, isLoading, refreshControl } = useCachedFocusLoader(TEAM_CACHE_KEY, loadTeamData);
  const members = snapshot?.members ?? [];
  const [offlinePhotos, setOfflinePhotos] = useState({});

  // Offline the saved signed URLs don't load; use the photos kept on the phone.
  React.useEffect(() => {
    if (getConnectionStatus().online || members.length === 0) return;
    let active = true;
    Promise.all(members.map(async (m) => [m.agentId, await savedPhotoDataUri(m.agentId)])).then((pairs) => {
      if (active) setOfflinePhotos(Object.fromEntries(pairs));
    });
    return () => {
      active = false;
    };
  }, [members]);

  const photoOf = (m) => (getConnectionStatus().online ? m.photoUrl : offlinePhotos[m.agentId] || null);
  const located = members.filter((m) => m.latitude != null && m.longitude != null);
  const markers = located.map((m) => ({
    id: m.agentId,
    label: m.fullName,
    distanceLabel: formatCheckpointTime(m.capturedAt),
    latitude: m.latitude,
    longitude: m.longitude,
    color: ROLE_COLOR[m.role] || ROLE_COLOR.sales_rep,
    avatar: { photoUrl: photoOf(m), initials: getInitials(m.fullName), ...describePresence(m.lastSeenAt) },
  }));

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <Header showBackButton title="Team Locations" height={56} backgroundColor={COLORS.primary} textColor="#FFFFFF" />

        <View style={styles.mapWrap}>
          {isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : (
            <StaticRouteMap ref={mapRef} fill destinations={markers} showRoute={false} showScale style={styles.mapFill} />
          )}
          <MapZoomControls
            onZoomIn={() => mapRef.current?.zoomIn()}
            onZoomOut={() => mapRef.current?.zoomOut()}
            onRecenter={() => mapRef.current?.recenter()}
            style={styles.zoomControls}
          />
          <View style={styles.topOverlay} pointerEvents="box-none">
            <MapLegend items={LEGEND} />
            <ConnectionPill />
          </View>
        </View>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} refreshControl={refreshControl}>
          <Text style={styles.listTitle}>Team · last known location</Text>
          <Text style={styles.listNote}>
            Updated whenever someone receives, delivers, files a report or requests stock — not live tracking.
          </Text>
          {!isLoading && members.length === 0 && (
            <Text style={styles.empty}>No Sales Reps or Collectors in your branches yet.</Text>
          )}
          {members.map((m) => {
            const presence = describePresence(m.lastSeenAt);
            return (
              <Pressable key={m.agentId} style={styles.row} disabled>
                <UserAvatar photoUrl={photoOf(m)} fallbackText={getInitials(m.fullName)} size={40} />
                <View style={styles.rowText}>
                  <Text style={styles.rowName} numberOfLines={1}>{m.fullName}</Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {ROLE_LABEL[m.role] || m.role} · {presence.statusLabel}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {m.capturedAt
                      ? `Last location ${formatCheckpointTime(m.capturedAt)} (${m.source})`
                      : 'No location recorded yet'}
                  </Text>
                </View>
                <View style={[styles.roleDot, { backgroundColor: ROLE_COLOR[m.role] || ROLE_COLOR.sales_rep }]} />
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  mapWrap: { height: '50%', position: 'relative', overflow: 'hidden' },
  mapFill: { borderRadius: 0, borderWidth: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  zoomControls: { position: 'absolute', top: SPACING.md, right: SPACING.md },
  topOverlay: { position: 'absolute', top: SPACING.md, left: SPACING.md, gap: SPACING.sm, alignItems: 'flex-start' },
  list: { flex: 1 },
  listContent: { padding: SPACING.lg, gap: SPACING.sm },
  listTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    color: '#272632',
  },
  listNote: { fontSize: TYPOGRAPHY.fontSize.xs, fontFamily: TYPOGRAPHY.fontFamily.regular, color: COLORS.textSecondary, marginBottom: SPACING.xs },
  empty: { fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAEFF5',
    backgroundColor: '#FFFFFF',
  },
  rowText: { flex: 1 },
  rowName: { fontSize: TYPOGRAPHY.fontSize.sm, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', color: '#272632' },
  rowMeta: { fontSize: TYPOGRAPHY.fontSize.xs, fontFamily: TYPOGRAPHY.fontFamily.regular, color: COLORS.textSecondary, marginTop: 1 },
  roleDot: { width: 10, height: 10, borderRadius: 5 },
});
