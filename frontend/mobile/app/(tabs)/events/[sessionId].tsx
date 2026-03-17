import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  Dimensions, Alert, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getSession, getApplicants, updateApplicantStatus, batchUpdateStatus } from '../../../lib/api';
import { colors, getStatusColor } from '../../../lib/theme';
import type { Session, Applicant } from '../../../lib/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function computeStats(applicants: Applicant[]) {
  const stats = { total: applicants.length, accepted: 0, rejected: 0, waitlisted: 0, pending: 0 };
  for (const a of applicants) {
    const s = (a.status || 'pending').toLowerCase();
    if (s === 'accepted') stats.accepted++;
    else if (s === 'rejected') stats.rejected++;
    else if (s === 'waitlisted') stats.waitlisted++;
    else stats.pending++;
  }
  return stats;
}

function StatBox({ label, value, color: c }: { label: string; value: number; color: string }) {
  return (
    <View style={[statStyles.box, { borderColor: c + '40' }]}>
      <Text style={[statStyles.value, { color: c }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 8, borderWidth: 1, backgroundColor: colors.card },
  value: { fontSize: 20, fontWeight: '700' },
  label: { fontSize: 10, fontWeight: '600', color: colors.muted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },
});

export default function SessionDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!sessionId) return;
    try {
      setError(null);
      const [sessionData, applicantData] = await Promise.all([
        getSession(sessionId), getApplicants(sessionId),
      ]);
      setSession(sessionData);
      // Pending first, then by score desc
      const sorted = [...applicantData].sort((a, b) => {
        const order: Record<string, number> = { pending: 0, waitlisted: 1, accepted: 2, rejected: 3 };
        const oa = order[(a.status || 'pending').toLowerCase()] ?? 0;
        const ob = order[(b.status || 'pending').toLowerCase()] ?? 0;
        if (oa !== ob) return oa - ob;
        return parseFloat(String(b.ai_score || '0')) - parseFloat(String(a.ai_score || '0'));
      });
      setApplicants(sorted);
      setCurrentIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, [sessionId]);

  useEffect(() => { fetchData().finally(() => setLoading(false)); }, [fetchData]);

  const handleDecision = useCallback(async (status: string) => {
    const applicant = applicants[currentIndex];
    if (!applicant || saving) return;
    setSaving(true);
    try {
      await updateApplicantStatus(applicant.applicant_id, status);
      // Update local state
      setApplicants(prev => prev.map(a =>
        a.applicant_id === applicant.applicant_id ? { ...a, status } : a
      ));
      // Move to next card
      setCurrentIndex(prev => prev + 1);
    } catch (err) {
      Alert.alert('Failed to save', err instanceof Error ? err.message : 'Try again');
    } finally {
      setSaving(false);
    }
  }, [applicants, currentIndex, saving]);

  const handleResetAll = useCallback(() => {
    Alert.alert(
      'Reset All to Pending?',
      'This will set all applicants back to pending so you can re-evaluate from scratch.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset All',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              const allIds = applicants.map(a => a.applicant_id);
              await batchUpdateStatus(allIds, 'pending');
              // Refresh
              await fetchData();
              Alert.alert('Done', 'All applicants reset to pending');
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to reset');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  }, [applicants, fetchData]);

  const stats = computeStats(applicants);
  const current = applicants[currentIndex];
  const remaining = applicants.length - currentIndex;

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.gold} size="large" /></View>;
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.goldBtn} onPress={fetchData}>
          <Text style={styles.goldBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          {session && <Text style={styles.sessionName} numberOfLines={1}>{session.name}</Text>}
          <TouchableOpacity onPress={handleResetAll} style={styles.resetLink}>
            <Text style={styles.resetLinkText}>Reset All</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.statsRow}>
          <StatBox label="Total" value={stats.total} color={colors.text} />
          <StatBox label="Accept" value={stats.accepted} color={colors.statusAccepted} />
          <StatBox label="Wait" value={stats.waitlisted} color={colors.statusWaitlisted} />
          <StatBox label="Reject" value={stats.rejected} color={colors.statusRejected} />
        </View>
        {remaining > 0 && (
          <Text style={styles.remainingText}>{remaining} of {applicants.length} remaining</Text>
        )}
      </View>

      {/* Card or Done State */}
      {current ? (
        <ScrollView style={styles.cardScroll} contentContainerStyle={styles.cardScrollContent}>
          <View style={styles.card}>
            {/* Avatar */}
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(current.name || current.email || '?')[0]?.toUpperCase()}
              </Text>
            </View>

            {/* Score badge */}
            {current.ai_score && parseFloat(String(current.ai_score)) > 0 && (
              <View style={[styles.scoreBadge, {
                backgroundColor: (parseFloat(String(current.ai_score)) >= 70 ? colors.success : parseFloat(String(current.ai_score)) >= 40 ? colors.warning : colors.error) + '20',
              }]}>
                <Text style={[styles.scoreText, {
                  color: parseFloat(String(current.ai_score)) >= 70 ? colors.success : parseFloat(String(current.ai_score)) >= 40 ? colors.warning : colors.error,
                }]}>
                  {Math.round(parseFloat(String(current.ai_score)))}
                </Text>
              </View>
            )}

            {/* Name */}
            <Text style={styles.cardName}>{current.name || current.email || 'Unknown'}</Text>

            {/* Title + Company */}
            {(current.title || current.company) && (
              <Text style={styles.cardTitle}>
                {current.title}{current.title && current.company ? ' at ' : ''}{current.company}
              </Text>
            )}

            {/* Location */}
            {current.location && (
              <Text style={styles.cardLocation}>{current.location}</Text>
            )}

            {/* Type badge */}
            {current.attendee_type && (
              <View style={styles.typeBadge}>
                <Text style={styles.typeText}>
                  {current.attendee_type_detail || current.attendee_type}
                </Text>
              </View>
            )}

            {/* Current status */}
            <View style={[styles.statusBar, { backgroundColor: getStatusColor(current.status || 'pending') + '15' }]}>
              <Text style={[styles.statusBarText, { color: getStatusColor(current.status || 'pending') }]}>
                {(current.status || 'pending').toUpperCase()}
              </Text>
            </View>

            {/* AI Reasoning */}
            {current.ai_reasoning && (
              <View style={styles.reasoningBox}>
                <Text style={styles.reasoningLabel}>AI ASSESSMENT</Text>
                <Text style={styles.reasoningText}>{current.ai_reasoning}</Text>
              </View>
            )}

            {/* Email */}
            {current.email && (
              <Text style={styles.cardMeta}>{current.email}</Text>
            )}
          </View>
        </ScrollView>
      ) : (
        <View style={styles.doneContainer}>
          <Text style={styles.doneCheck}>{'\u2713'}</Text>
          <Text style={styles.doneText}>All reviewed!</Text>
          <Text style={styles.doneSubtext}>{applicants.length} applicants processed</Text>
          <TouchableOpacity style={styles.goldBtn} onPress={() => setCurrentIndex(0)}>
            <Text style={styles.goldBtnText}>Review Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.outlineBtn} onPress={handleResetAll}>
            <Text style={styles.outlineBtnText}>Reset All to Pending</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Decision Buttons */}
      {current && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.rejectBtn]}
            onPress={() => handleDecision('rejected')}
            disabled={saving}
            activeOpacity={0.7}
          >
            <Text style={styles.rejectIcon}>{'\u2715'}</Text>
            <Text style={[styles.actionLabel, { color: colors.error }]}>REJECT</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.waitlistBtn]}
            onPress={() => handleDecision('waitlisted')}
            disabled={saving}
            activeOpacity={0.7}
          >
            <Text style={styles.waitlistIcon}>{'\u2014'}</Text>
            <Text style={[styles.actionLabel, { color: colors.warning }]}>WAITLIST</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.acceptBtn]}
            onPress={() => handleDecision('accepted')}
            disabled={saving}
            activeOpacity={0.7}
          >
            <Text style={styles.acceptIcon}>{'\u2713'}</Text>
            <Text style={[styles.actionLabel, { color: colors.success }]}>ACCEPT</Text>
          </TouchableOpacity>

          {saving && (
            <View style={styles.savingOverlay}>
              <ActivityIndicator color={colors.gold} size="small" />
            </View>
          )}
        </View>
      )}

      {/* Skip button */}
      {current && (
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={() => setCurrentIndex(prev => prev + 1)}
        >
          <Text style={styles.skipText}>Skip {'\u203A'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: 32 },

  // Header
  header: { padding: 16, paddingBottom: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sessionName: { fontSize: 18, fontWeight: '700', color: colors.text, flex: 1 },
  resetLink: { paddingHorizontal: 12, paddingVertical: 6 },
  resetLinkText: { fontSize: 13, color: colors.error, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 6 },
  remainingText: { textAlign: 'center', color: colors.muted, fontSize: 12, marginTop: 8 },

  // Card
  cardScroll: { flex: 1 },
  cardScrollContent: { padding: 16, paddingBottom: 8 },
  card: {
    backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    padding: 24, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: colors.border,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.gold + '30',
    marginBottom: 16,
  },
  avatarText: { fontSize: 32, fontWeight: '700', color: colors.gold },
  scoreBadge: {
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 12,
  },
  scoreText: { fontSize: 16, fontWeight: '800' },
  cardName: { fontSize: 22, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 4 },
  cardLocation: { fontSize: 13, color: colors.muted, marginBottom: 8 },
  typeBadge: {
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12,
    backgroundColor: colors.gold + '15', borderWidth: 1, borderColor: colors.gold + '30',
    marginBottom: 12,
  },
  typeText: { fontSize: 12, fontWeight: '600', color: colors.gold, textTransform: 'capitalize' },
  statusBar: {
    width: '100%', paddingVertical: 6, borderRadius: 8, alignItems: 'center', marginBottom: 12,
  },
  statusBarText: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  reasoningBox: {
    width: '100%', padding: 12, borderRadius: 12,
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, marginBottom: 8,
  },
  reasoningLabel: { fontSize: 10, fontWeight: '700', color: colors.gold, letterSpacing: 0.5, marginBottom: 6 },
  reasoningText: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  cardMeta: { fontSize: 12, color: colors.muted, marginTop: 4 },

  // Actions
  actions: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 20, paddingVertical: 12, paddingHorizontal: 24,
  },
  actionBtn: {
    alignItems: 'center', justifyContent: 'center', width: 76, height: 76,
    borderRadius: 38, borderWidth: 2, gap: 4,
  },
  rejectBtn: { borderColor: colors.error + '50', backgroundColor: colors.error + '10' },
  rejectIcon: { fontSize: 24, fontWeight: '800', color: colors.error },
  waitlistBtn: { borderColor: colors.warning + '50', backgroundColor: colors.warning + '10', width: 64, height: 64, borderRadius: 32 },
  waitlistIcon: { fontSize: 24, fontWeight: '800', color: colors.warning },
  acceptBtn: { borderColor: colors.success + '50', backgroundColor: colors.success + '10' },
  acceptIcon: { fontSize: 28, fontWeight: '800', color: colors.success },
  actionLabel: { fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  savingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
  },

  // Skip
  skipBtn: { alignItems: 'center', paddingBottom: 100 },
  skipText: { fontSize: 14, color: colors.muted, fontWeight: '500' },

  // Done
  doneContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
  doneCheck: { fontSize: 48, fontWeight: '300', color: colors.gold },
  doneText: { fontSize: 24, fontWeight: '700', color: colors.text },
  doneSubtext: { fontSize: 14, color: colors.muted },

  // Buttons
  goldBtn: { backgroundColor: colors.gold, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 8 },
  goldBtnText: { color: colors.background, fontWeight: '700', fontSize: 15 },
  outlineBtn: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 4 },
  outlineBtnText: { color: colors.muted, fontWeight: '600', fontSize: 14 },

  errorText: { fontSize: 15, color: colors.error, textAlign: 'center', marginBottom: 16 },
});
