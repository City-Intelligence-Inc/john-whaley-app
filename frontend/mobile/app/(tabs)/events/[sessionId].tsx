import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  Dimensions, Alert, ScrollView, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getSession, getApplicants, updateApplicantStatus, batchUpdateStatus, getLinkedInProfiles } from '../../../lib/api';
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
  const [photoMap, setPhotoMap] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!sessionId) return;
    try {
      setError(null);
      const [sessionData, applicantData, linkedInData] = await Promise.all([
        getSession(sessionId),
        getApplicants(sessionId),
        getLinkedInProfiles().catch(() => ({ items: [], count: 0 })),
      ]);
      setSession(sessionData);

      // Build URL → photo_url map from LinkedIn DB
      const photos: Record<string, string> = {};
      const liItems = (linkedInData as { items: { url?: string; photo_url?: string }[] }).items || [];
      for (const li of liItems) {
        if (li.url && li.photo_url && String(li.photo_url).startsWith('http')) {
          const normalized = li.url.toLowerCase().replace(/\/$/, '');
          photos[normalized] = li.photo_url as string;
        }
      }
      setPhotoMap(photos);
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
            {/* LinkedIn-style header with banner */}
            <View style={styles.cardBanner} />

            {/* Avatar overlapping banner */}
            <View style={styles.avatarWrap}>
              {(() => {
                const url = current.linkedin_url ? current.linkedin_url.toLowerCase().replace(/\/$/, '') : '';
                const photo = photoMap[url];
                if (photo) {
                  return <Image source={{ uri: photo }} style={styles.avatarImg} />;
                }
                return (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(current.name || current.linkedin_name as string || current.email || '?')[0]?.toUpperCase()}
                    </Text>
                  </View>
                );
              })()}
              {/* Score pill next to avatar */}
              {current.ai_score && parseFloat(String(current.ai_score)) > 0 && (() => {
                const score = parseFloat(String(current.ai_score));
                const sc = score >= 70 ? colors.success : score >= 40 ? colors.warning : colors.error;
                return (
                  <View style={[styles.scorePill, { backgroundColor: sc + '20', borderColor: sc + '40' }]}>
                    <Text style={[styles.scoreNum, { color: sc }]}>{Math.round(score)}</Text>
                  </View>
                );
              })()}
            </View>

            {/* Name */}
            <Text style={styles.cardName}>
              {current.linkedin_name as string || current.name || current.email || 'Unknown'}
            </Text>

            {/* Headline (LinkedIn-style) */}
            {(current.linkedin_headline || current.title || current.company) && (
              <Text style={styles.cardHeadline} numberOfLines={3}>
                {current.linkedin_headline as string ||
                  (current.title ? `${current.title}${current.company ? ` at ${current.company}` : ''}` : current.company as string)}
              </Text>
            )}

            {/* Location + Connections row */}
            <View style={styles.metaRow}>
              {(current.linkedin_location || current.location) && (
                <Text style={styles.metaText}>
                  {current.linkedin_location as string || current.location}
                </Text>
              )}
              {current.linkedin_url && (
                <View style={styles.linkedinBadge}>
                  <Text style={styles.linkedinBadgeText}>in</Text>
                </View>
              )}
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Status + Type row */}
            <View style={styles.badgeRow}>
              <View style={[styles.statusChip, { backgroundColor: getStatusColor(current.status || 'pending') + '15' }]}>
                <Text style={[styles.statusChipText, { color: getStatusColor(current.status || 'pending') }]}>
                  {(current.status || 'pending').toUpperCase()}
                </Text>
              </View>
              {current.attendee_type && (
                <View style={styles.typeChip}>
                  <Text style={styles.typeChipText}>
                    {current.attendee_type_detail as string || current.attendee_type}
                  </Text>
                </View>
              )}
            </View>

            {/* AI Assessment */}
            {current.ai_reasoning && (
              <View style={styles.assessmentCard}>
                <Text style={styles.assessmentLabel}>AI ASSESSMENT</Text>
                <Text style={styles.assessmentText}>{current.ai_reasoning as string}</Text>
              </View>
            )}

            {/* Contact info */}
            {current.email && (
              <View style={styles.contactRow}>
                <Text style={styles.contactLabel}>Email</Text>
                <Text style={styles.contactValue}>{current.email}</Text>
              </View>
            )}
            {current.linkedin_url && (
              <View style={styles.contactRow}>
                <Text style={styles.contactLabel}>LinkedIn</Text>
                <Text style={styles.contactValue} numberOfLines={1}>{current.linkedin_url}</Text>
              </View>
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

  // Card — LinkedIn style
  cardScroll: { flex: 1 },
  cardScrollContent: { padding: 16, paddingBottom: 8 },
  card: {
    backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 16,
  },
  cardBanner: {
    height: 72, backgroundColor: colors.gold + '12',
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  avatarWrap: {
    flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, marginTop: -36, marginBottom: 12, gap: 12,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.background,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: colors.card,
  },
  avatarImg: {
    width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: colors.card,
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: colors.gold },
  scorePill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, marginBottom: 8,
  },
  scoreNum: { fontSize: 15, fontWeight: '800' },
  cardName: { fontSize: 20, fontWeight: '700', color: colors.text, paddingHorizontal: 20, marginBottom: 2 },
  cardHeadline: { fontSize: 14, color: colors.textSecondary, paddingHorizontal: 20, lineHeight: 20, marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 8, marginBottom: 12 },
  metaText: { fontSize: 13, color: colors.muted },
  linkedinBadge: {
    width: 18, height: 18, borderRadius: 3, backgroundColor: '#0A66C2', justifyContent: 'center', alignItems: 'center',
  },
  linkedinBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 20 },
  badgeRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, gap: 8, flexWrap: 'wrap' },
  statusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusChipText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  typeChip: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
    backgroundColor: colors.gold + '15', borderWidth: 1, borderColor: colors.gold + '25',
  },
  typeChipText: { fontSize: 11, fontWeight: '600', color: colors.gold, textTransform: 'capitalize' },
  assessmentCard: {
    marginHorizontal: 20, marginBottom: 12, padding: 14, borderRadius: 12,
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
  },
  assessmentLabel: { fontSize: 10, fontWeight: '700', color: colors.gold, letterSpacing: 0.5, marginBottom: 6 },
  assessmentText: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  contactRow: {
    flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 6, gap: 8,
  },
  contactLabel: { fontSize: 12, color: colors.muted, width: 60, fontWeight: '600' },
  contactValue: { fontSize: 12, color: colors.textSecondary, flex: 1 },

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
