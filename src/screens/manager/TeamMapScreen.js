// src/screens/manager/TeamMapScreen.js
// Manager's team map: every Sales Rep and Collector in the manager's branches
// at the last place the app recorded them (a geotagged action, delivery
// checkpoint, daily report or stock request), with when that was. Not live
// tracking — the app only knows a location when the agent does something.
import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import Alert from '../../utils/appAlert';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Header from '../../components/common/Header';
import Icon from '../../components/common/Icon';
import StaticRouteMap from '../../components/common/StaticRouteMap';
import MapZoomControls from '../../components/common/MapZoomControls';
import MapStatusCard from '../../components/common/MapStatusCard';
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

// Room kept under the map's markers for the team sheet when the map frames everyone.
const MAP_BOTTOM_PADDING = 340;

export default function TeamMapScreen() {
  const mapRef = useRef(null);
  const insets = useSafeAreaInsets();
  const { data: snapshot, isLoading, refreshControl } = useCachedFocusLoader(TEAM_CACHE_KEY, loadTeamData);
  const members = snapshot?.members ?? [];
  const [offlinePhotos, setOfflinePhotos] = useState({});
  // The team sheet can fold away so the whole map shows; the tapped person is highlighted.
  const [isSheetOpen, setIsSheetOpen] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

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

  const handleSelectMember = (m) => {
    if (m.latitude == null || m.longitude == null) {
      Alert.alert('No Location Yet', `${m.fullName} hasn't had a location recorded yet.`);
      return;
    }
    const next = selectedId === m.agentId ? null : m.agentId;
    setSelectedId(next);
    mapRef.current?.focusOn(m.latitude, m.longitude);
    mapRef.current?.selectMarker(next);
  };
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
            <StaticRouteMap
              ref={mapRef}
              fill
              destinations={markers}
              showRoute={false}
              showScale
              fitBottom={MAP_BOTTOM_PADDING}
              style={styles.mapFill}
            />
          )}
          <MapZoomControls
            onZoomIn={() => mapRef.current?.zoomIn()}
            onZoomOut={() => mapRef.current?.zoomOut()}
            onRecenter={() => mapRef.current?.recenter()}
            style={styles.zoomControls}
          />
          <MapStatusCard legend={LEGEND} style={styles.topCard} />

          <View style={[styles.sheet, { paddingBottom: insets.bottom + SPACING.sm }]}>
            <View style={styles.sheetHandle} />
            <Pressable
              style={styles.sheetHeader}
              onPress={() => setIsSheetOpen((open) => !open)}
              accessibilityRole="button"
              accessibilityLabel={isSheetOpen ? 'Hide the team list' : 'Show the team list'}
            >
              <Text style={styles.sheetTitle}>Team · last known location ({members.length})</Text>
              <Text style={styles.sheetToggle}>{isSheetOpen ? 'Hide' : 'Show more'}</Text>
              <View style={isSheetOpen ? styles.caretUp : null}>
                <Icon name="caretDown" size={14} color="#0085F9" />
              </View>
            </Pressable>

            {isSheetOpen && (
              <>
                <Text style={styles.sheetNote}>
                  Updated whenever someone receives, delivers, files a report or requests stock — not live tracking.
                </Text>
                <ScrollView
                  style={styles.list}
                  contentContainerStyle={styles.listContent}
                  refreshControl={refreshControl}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                >
                  {!isLoading && members.length === 0 && (
                    <Text style={styles.empty}>No Sales Reps or Collectors in your branches yet.</Text>
                  )}
                  {members.map((m) => {
                    const presence = describePresence(m.lastSeenAt);
                    const isLocated = m.latitude != null && m.longitude != null;
                    const roleColor = ROLE_COLOR[m.role] || ROLE_COLOR.sales_rep;
                    return (
                      <Pressable
                        key={m.agentId}
                        style={({ pressed }) => [
                          styles.row,
                          !isLocated && styles.rowMuted,
                          pressed && isLocated && styles.rowPressed,
                          selectedId === m.agentId && styles.rowSelected,
                        ]}
                        onPress={() => handleSelectMember(m)}
                        accessibilityRole="button"
                        accessibilityLabel={isLocated ? `Show ${m.fullName}'s last location on the map` : `${m.fullName} has no location recorded yet`}
                      >
                        <UserAvatar photoUrl={photoOf(m)} fallbackText={getInitials(m.fullName)} size={40} />
                        <View style={styles.rowText}>
                          <View style={styles.nameRow}>
                            <Text style={styles.rowName} numberOfLines={1}>{m.fullName}</Text>
                            <View style={[styles.roleChip, { borderColor: roleColor }]}>
                              <Text style={[styles.roleChipText, { color: roleColor }]}>{ROLE_LABEL[m.role] || m.role}</Text>
                            </View>
                          </View>
                          <Text style={styles.rowMeta} numberOfLines={1}>{presence.statusLabel}</Text>
                          <Text style={styles.rowMeta} numberOfLines={2}>
                            {m.capturedAt
                              ? `Last location ${formatCheckpointTime(m.capturedAt)}${m.source ? ` · ${m.source}` : ''}`
                              : 'No location recorded yet'}
                          </Text>
                        </View>
                        {isLocated && <Icon name="arrowRight" size={16} color="#0085F9" />}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            )}
            <Text style={styles.attribution}>Map © OpenStreetMap contributors · Leaflet</Text>
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  mapWrap: { flex: 1, position: 'relative', overflow: 'hidden' },
  mapFill: { borderRadius: 0, borderWidth: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  zoomControls: { position: 'absolute', top: SPACING.md, right: SPACING.md },
  topCard: { top: SPACING.md, left: SPACING.md },

  // Sheet attached to the left, right and bottom edges, like the pin picker's.
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 10,
  },
  sheetHandle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#DADDE3' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  sheetTitle: { flex: 1, fontSize: TYPOGRAPHY.fontSize.base, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', color: '#272632' },
  sheetToggle: { fontSize: TYPOGRAPHY.fontSize.xs, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', color: '#0085F9' },
  caretUp: { transform: [{ rotate: '180deg' }] },
  sheetNote: { fontSize: TYPOGRAPHY.fontSize.xs, fontFamily: TYPOGRAPHY.fontFamily.regular, color: COLORS.textSecondary },
  list: { maxHeight: 250 },
  listContent: { gap: 8, paddingBottom: 2 },
  empty: { fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E1EEFF',
    backgroundColor: '#F4F9FF',
  },
  rowMuted: { opacity: 0.65 },
  rowPressed: { backgroundColor: '#E3F0FF' },
  rowSelected: { backgroundColor: '#D6E9FF', borderColor: '#0085F9' },
  rowText: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowName: { flexShrink: 1, fontSize: TYPOGRAPHY.fontSize.sm, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', color: '#272632' },
  roleChip: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, borderWidth: 1 },
  roleChipText: { fontSize: 10, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  rowMeta: { fontSize: TYPOGRAPHY.fontSize.xs, fontFamily: TYPOGRAPHY.fontFamily.regular, color: COLORS.textSecondary, marginTop: 1 },
  attribution: { textAlign: 'center', fontSize: 10, lineHeight: 12, fontFamily: TYPOGRAPHY.fontFamily.regular, color: COLORS.textTertiary },
});
