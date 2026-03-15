import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getSessions, getLumaEvents, importFromLuma, createSession } from '../../../lib/api';
import { colors } from '../../../lib/theme';
import type { Session } from '../../../lib/api';

interface LumaEvent {
  api_id: string;
  name: string;
  start_at: string;
}

export default function EventsScreen() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Luma import
  const [showLuma, setShowLuma] = useState(false);
  const [lumaEvents, setLumaEvents] = useState<LumaEvent[]>([]);
  const [lumaLoading, setLumaLoading] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);

  // Manual create
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchSessions = useCallback(async () => {
    try {
      setError(null);
      const data = await getSessions();
      const sorted = [...data].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setSessions(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    }
  }, []);

  useEffect(() => {
    fetchSessions().finally(() => setLoading(false));
  }, [fetchSessions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSessions();
    setRefreshing(false);
  }, [fetchSessions]);

  const handleOpenLuma = useCallback(async () => {
    setShowLuma(true);
    setLumaLoading(true);
    try {
      const res = await getLumaEvents();
      setLumaEvents(res.entries || []);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load Luma events');
    } finally {
      setLumaLoading(false);
    }
  }, []);

  const handleImportLuma = useCallback(async (eventId: string, eventName: string) => {
    setImporting(eventId);
    try {
      const res = await importFromLuma(eventId);
      Alert.alert('Imported!', `${res.count} guests from "${eventName}"`);
      setShowLuma(false);
      await fetchSessions();
      router.push(`/(tabs)/events/${res.session_id}`);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(null);
    }
  }, [fetchSessions, router]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const session = await createSession(newName.trim());
      setShowCreate(false);
      setNewName('');
      await fetchSessions();
      router.push(`/(tabs)/events/${session.session_id}`);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setCreating(false);
    }
  }, [newName, fetchSessions, router]);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return dateStr; }
  };

  const renderSession = ({ item }: { item: Session }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => router.push(`/(tabs)/events/${item.session_id}`)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}>
          <Text style={{ fontSize: 20 }}>📅</Text>
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
        </View>
        <Text style={{ fontSize: 20, color: colors.muted }}>›</Text>
      </View>
      <View style={styles.cardFooter}>
        <View style={styles.stat}>
          <Text style={{ fontSize: 14 }}>👥</Text>
          <Text style={styles.statText}>{item.applicant_count} applicant{item.applicant_count !== 1 ? 's' : ''}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: colors.gold + '20' }]}>
          <Text style={[styles.statusTextBadge, { color: colors.gold }]}>{item.status || 'active'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.gold} size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.lumaButton} onPress={handleOpenLuma} activeOpacity={0.8}>
          <Text style={styles.lumaButtonText}>📅 Import from Luma</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.createButton} onPress={() => setShowCreate(true)} activeOpacity={0.8}>
          <Text style={styles.createButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.session_id}
        renderItem={renderSession}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 48 }}>📅</Text>
            <Text style={styles.emptyText}>No events yet</Text>
            <Text style={styles.emptySubtext}>Import from Luma or create a new event</Text>
          </View>
        }
      />

      {/* Luma Import Modal */}
      <Modal visible={showLuma} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Luma Events</Text>
            <TouchableOpacity onPress={() => setShowLuma(false)}>
              <Text style={styles.modalClose}>Done</Text>
            </TouchableOpacity>
          </View>
          {lumaLoading ? (
            <View style={styles.center}><ActivityIndicator color={colors.gold} size="large" /></View>
          ) : (
            <FlatList
              data={lumaEvents}
              keyExtractor={(item) => item.api_id}
              contentContainerStyle={{ padding: 16 }}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>No Luma events found</Text>
                  <Text style={styles.emptySubtext}>Make sure Stardrop is added to your Luma events</Text>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.lumaCard}
                  onPress={() => handleImportLuma(item.api_id, item.name)}
                  disabled={importing === item.api_id}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lumaName} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.lumaDate}>{formatDate(item.start_at)}</Text>
                  </View>
                  {importing === item.api_id ? (
                    <ActivityIndicator color={colors.gold} size="small" />
                  ) : (
                    <Text style={styles.importBtn}>Import</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>

      {/* Create Event Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.createModal}>
            <Text style={styles.createTitle}>New Event</Text>
            <TextInput
              style={styles.createInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Event name"
              placeholderTextColor={colors.muted}
              autoFocus
            />
            <View style={styles.createActions}>
              <TouchableOpacity onPress={() => { setShowCreate(false); setNewName(''); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createSubmit, !newName.trim() && { opacity: 0.4 }]}
                onPress={handleCreate}
                disabled={creating || !newName.trim()}
              >
                {creating ? (
                  <ActivityIndicator color={colors.background} size="small" />
                ) : (
                  <Text style={styles.createSubmitText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  actions: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  lumaButton: { flex: 1, backgroundColor: colors.gold, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  lumaButtonText: { color: colors.background, fontSize: 15, fontWeight: '700' },
  createButton: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center' },
  createButtonText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  list: { padding: 16, paddingBottom: 32 },
  card: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  cardIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.gold + '15', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardContent: { flex: 1, marginRight: 8 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text, lineHeight: 22 },
  cardDate: { fontSize: 13, color: colors.muted, marginTop: 2 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statText: { fontSize: 13, color: colors.muted },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusTextBadge: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 18, fontWeight: '600', color: colors.text },
  emptySubtext: { fontSize: 14, color: colors.muted, textAlign: 'center' },

  // Luma modal
  modal: { flex: 1, backgroundColor: colors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  modalClose: { fontSize: 16, fontWeight: '600', color: colors.gold },
  lumaCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 },
  lumaName: { fontSize: 15, fontWeight: '600', color: colors.text },
  lumaDate: { fontSize: 13, color: colors.muted, marginTop: 2 },
  importBtn: { color: colors.gold, fontWeight: '700', fontSize: 14, marginLeft: 12 },

  // Create modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', paddingHorizontal: 28 },
  createModal: { backgroundColor: colors.card, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: colors.border },
  createTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 16 },
  createInput: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.text },
  createActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
  cancelText: { color: colors.muted, fontSize: 15, fontWeight: '500' },
  createSubmit: { backgroundColor: colors.gold, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  createSubmitText: { color: colors.background, fontSize: 15, fontWeight: '700' },
});
