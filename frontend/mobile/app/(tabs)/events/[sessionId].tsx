import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  Alert, ScrollView, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getSession, getApplicants, updateApplicantStatus,
  batchUpdateStatus, getLinkedInProfiles,
} from '../../../lib/api';
import { colors, getStatusColor } from '../../../lib/theme';
import type { Session, Applicant } from '../../../lib/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function scoreColor(score: number): string {
  if (score >= 70) return colors.success;
  if (score >= 40) return colors.warning;
  return colors.error;
}

// ---------------------------------------------------------------------------
// Stat Box
// ---------------------------------------------------------------------------

function StatBox({ label, value, color: c }: { label: string; value: number; color: string }) {
  return (
    <View style={[statStyles.box, { borderColor: c + '40' }]}>
      <Text style={[statStyles.value, { color: c }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  box: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: colors.card,
  },
  value: { fontSize: 20, fontWeight: '700' },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.muted,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});

// ---------------------------------------------------------------------------
// Applicant Card (horizontal "dollar bill" layout)
// ---------------------------------------------------------------------------

function ApplicantCard({
  applicant,
  photoUrl,
  onDecision,
  saving,
}: {
  applicant: Applicant;
  photoUrl: string | null;
  onDecision: (status: string) => void;
  saving: boolean;
}) {
  const score = applicant.ai_score ? parseFloat(String(applicant.ai_score)) : null;
  const hasScore = score !== null && score > 0;
  const displayName =
    (applicant.linkedin_name as string) || applicant.name || applicant.email || 'Unknown';
  const headline =
    (applicant.linkedin_headline as string) ||
    (applicant.title
      ? `${applicant.title}${applicant.company ? ` at ${applicant.company}` : ''}`
      : (applicant.company as string) || null);
  const location = (applicant.linkedin_location as string) || (applicant.location as string) || null;
  const panelVotes = applicant.panel_votes as string | undefined;
  const acceptingJudges = applicant.accepting_judges as string | undefined;

  return (
    <View style={cardStyles.wrapper}>
      {/* Gold left stripe */}
      <View style={cardStyles.goldStripe} />

      <View style={cardStyles.inner}>
        {/* Top row: Photo + Name/Headline + Score */}
        <View style={cardStyles.topRow}>
          {/* Photo */}
          <View style={cardStyles.photoContainer}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={cardStyles.photo} />
            ) : (
              <View style={cardStyles.photoFallback}>
                <Text style={cardStyles.photoInitial}>
                  {displayName[0]?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
          </View>

          {/* Name + Headline + Location */}
          <View style={cardStyles.infoCol}>
            <Text style={cardStyles.name} numberOfLines={1}>
              {displayName}
            </Text>
            {headline && (
              <Text style={cardStyles.headline} numberOfLines={2}>
                {headline}
              </Text>
            )}
            {location && (
              <Text style={cardStyles.location} numberOfLines={1}>
                {location}
              </Text>
            )}
          </View>

          {/* Score */}
          {hasScore && (
            <View
              style={[
                cardStyles.scoreBox,
                { backgroundColor: scoreColor(score!) + '18', borderColor: scoreColor(score!) + '40' },
              ]}
            >
              <Text style={[cardStyles.scoreNum, { color: scoreColor(score!) }]}>
                {Math.round(score!)}
              </Text>
              <Text style={[cardStyles.scoreLabel, { color: scoreColor(score!) + 'AA' }]}>
                score
              </Text>
            </View>
          )}
        </View>

        {/* Divider */}
        <View style={cardStyles.divider} />

        {/* Type + Status row */}
        <View style={cardStyles.badgeRow}>
          {applicant.attendee_type && (
            <View style={cardStyles.typeBadge}>
              <Text style={cardStyles.typeBadgeText}>
                {(applicant.attendee_type_detail as string) || applicant.attendee_type}
              </Text>
            </View>
          )}
          <View
            style={[
              cardStyles.statusBadge,
              { backgroundColor: getStatusColor(applicant.status || 'pending') + '15' },
            ]}
          >
            <Text
              style={[
                cardStyles.statusBadgeText,
                { color: getStatusColor(applicant.status || 'pending') },
              ]}
            >
              {(applicant.status || 'pending').toUpperCase()}
            </Text>
          </View>
        </View>

        {/* AI Reasoning */}
        {applicant.ai_reasoning && (
          <>
            <View style={cardStyles.divider} />
            <View style={cardStyles.section}>
              <Text style={cardStyles.sectionLabel}>AI ASSESSMENT</Text>
              <Text style={cardStyles.sectionText}>{applicant.ai_reasoning as string}</Text>
            </View>
          </>
        )}

        {/* Judge Votes */}
        {panelVotes && (
          <>
            <View style={cardStyles.divider} />
            <View style={cardStyles.section}>
              <Text style={cardStyles.sectionLabel}>PANEL VOTES</Text>
              <Text style={cardStyles.panelVotesText}>{panelVotes}</Text>
              {acceptingJudges ? (
                <Text style={cardStyles.judgeLine}>Accepted by: {acceptingJudges}</Text>
              ) : null}
            </View>
          </>
        )}

        {/* Contact */}
        {(applicant.email || applicant.linkedin_url) && (
          <>
            <View style={cardStyles.divider} />
            <View style={cardStyles.section}>
              {applicant.email && (
                <View style={cardStyles.contactRow}>
                  <Text style={cardStyles.contactLabel}>Email</Text>
                  <Text style={cardStyles.contactValue} numberOfLines={1}>
                    {applicant.email}
                  </Text>
                </View>
              )}
              {applicant.linkedin_url && (
                <View style={cardStyles.contactRow}>
                  <Text style={cardStyles.contactLabel}>LinkedIn</Text>
                  <Text style={cardStyles.contactValue} numberOfLines={1}>
                    {applicant.linkedin_url}
                  </Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* Decision buttons */}
        <View style={cardStyles.divider} />
        <View style={cardStyles.actions}>
          <TouchableOpacity
            style={[cardStyles.actionBtn, cardStyles.rejectBtn]}
            onPress={() => onDecision('rejected')}
            disabled={saving}
            activeOpacity={0.7}
          >
            <Text style={[cardStyles.actionBtnText, { color: colors.error }]}>REJECT</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[cardStyles.actionBtn, cardStyles.waitlistBtn]}
            onPress={() => onDecision('waitlisted')}
            disabled={saving}
            activeOpacity={0.7}
          >
            <Text style={[cardStyles.actionBtnText, { color: colors.warning }]}>WAITLIST</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[cardStyles.actionBtn, cardStyles.acceptBtn]}
            onPress={() => onDecision('accepted')}
            disabled={saving}
            activeOpacity={0.7}
          >
            <Text style={[cardStyles.actionBtnText, { color: colors.success }]}>ACCEPT</Text>
          </TouchableOpacity>
        </View>

        {saving && (
          <View style={cardStyles.savingOverlay}>
            <ActivityIndicator color={colors.gold} size="small" />
          </View>
        )}
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  goldStripe: {
    width: 4,
    backgroundColor: colors.gold,
  },
  inner: {
    flex: 1,
    padding: 14,
  },

  // Top row
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  photoContainer: {
    marginRight: 12,
  },
  photo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: colors.border,
  },
  photoFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  photoInitial: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.gold,
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 72,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  headline: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 2,
  },
  location: {
    fontSize: 12,
    color: colors.muted,
  },

  // Score
  scoreBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    marginLeft: 8,
  },
  scoreNum: {
    fontSize: 22,
    fontWeight: '800',
  },
  scoreLabel: {
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 10,
  },

  // Badge row
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.gold + '15',
    borderWidth: 1,
    borderColor: colors.gold + '25',
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.gold,
    textTransform: 'capitalize',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Sections
  section: {
    paddingVertical: 2,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gold,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  sectionText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  panelVotesText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  judgeLine: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  // Contact
  contactRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    gap: 8,
  },
  contactLabel: {
    fontSize: 12,
    color: colors.muted,
    width: 56,
    fontWeight: '600',
  },
  contactValue: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  rejectBtn: {
    borderColor: colors.error + '40',
    backgroundColor: colors.error + '10',
  },
  waitlistBtn: {
    borderColor: colors.warning + '40',
    backgroundColor: colors.warning + '10',
  },
  acceptBtn: {
    borderColor: colors.success + '40',
    backgroundColor: colors.success + '10',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.card + 'CC',
    borderRadius: 12,
  },
});

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

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

      // Build URL -> photo_url map from LinkedIn DB
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

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const handleDecision = useCallback(
    async (status: string) => {
      const applicant = applicants[currentIndex];
      if (!applicant || saving) return;
      setSaving(true);
      try {
        await updateApplicantStatus(applicant.applicant_id, status);
        setApplicants((prev) =>
          prev.map((a) =>
            a.applicant_id === applicant.applicant_id ? { ...a, status } : a,
          ),
        );
        setCurrentIndex((prev) => prev + 1);
      } catch (err) {
        Alert.alert('Failed to save', err instanceof Error ? err.message : 'Try again');
      } finally {
        setSaving(false);
      }
    },
    [applicants, currentIndex, saving],
  );

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
              const allIds = applicants.map((a) => a.applicant_id);
              await batchUpdateStatus(allIds, 'pending');
              await fetchData();
              Alert.alert('Done', 'All applicants reset to pending');
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to reset');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  }, [applicants, fetchData]);

  const stats = computeStats(applicants);
  const current = applicants[currentIndex];
  const remaining = applicants.length - currentIndex;

  // Resolve photo for current applicant
  const getPhotoUrl = (a: Applicant): string | null => {
    const url = a.linkedin_url ? a.linkedin_url.toLowerCase().replace(/\/$/, '') : '';
    return photoMap[url] || null;
  };

  // ---------- Loading / Error states ----------

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
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

  // ---------- Render ----------

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          {session && (
            <Text style={styles.sessionName} numberOfLines={1}>
              {session.name}
            </Text>
          )}
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.analyzeBtn}
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/events/analyze',
                  params: { sessionId: sessionId! },
                })
              }
            >
              <Text style={styles.analyzeBtnText}>Run Analysis</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleResetAll} style={styles.resetLink}>
              <Text style={styles.resetLinkText}>Reset All</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatBox label="Total" value={stats.total} color={colors.text} />
          <StatBox label="Accept" value={stats.accepted} color={colors.statusAccepted} />
          <StatBox label="Wait" value={stats.waitlisted} color={colors.statusWaitlisted} />
          <StatBox label="Reject" value={stats.rejected} color={colors.statusRejected} />
        </View>

        {remaining > 0 && (
          <Text style={styles.remainingText}>
            {remaining} of {applicants.length} remaining
          </Text>
        )}
      </View>

      {/* Card or Done State */}
      {current ? (
        <ScrollView
          style={styles.cardScroll}
          contentContainerStyle={styles.cardScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <ApplicantCard
            applicant={current}
            photoUrl={getPhotoUrl(current)}
            onDecision={handleDecision}
            saving={saving}
          />

          {/* Skip button */}
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => setCurrentIndex((prev) => prev + 1)}
          >
            <Text style={styles.skipText}>Skip {'\u203A'}</Text>
          </TouchableOpacity>
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
    </View>
  );
}

// ---------------------------------------------------------------------------
// Page-level styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 32,
  },

  // Header
  header: { padding: 16, paddingBottom: 8 },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sessionName: { fontSize: 18, fontWeight: '700', color: colors.text, flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  analyzeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.gold + '20',
    borderWidth: 1,
    borderColor: colors.gold + '40',
  },
  analyzeBtnText: { fontSize: 12, fontWeight: '700', color: colors.gold },
  resetLink: { paddingHorizontal: 8, paddingVertical: 6 },
  resetLinkText: { fontSize: 13, color: colors.error, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 6 },
  remainingText: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 12,
    marginTop: 8,
  },

  // Card scroll
  cardScroll: { flex: 1 },
  cardScrollContent: { paddingTop: 8, paddingBottom: 100 },

  // Skip
  skipBtn: { alignItems: 'center', paddingVertical: 16 },
  skipText: { fontSize: 14, color: colors.muted, fontWeight: '500' },

  // Done
  doneContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 32,
  },
  doneCheck: { fontSize: 48, fontWeight: '300', color: colors.gold },
  doneText: { fontSize: 24, fontWeight: '700', color: colors.text },
  doneSubtext: { fontSize: 14, color: colors.muted },

  // Buttons
  goldBtn: {
    backgroundColor: colors.gold,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  goldBtnText: { color: colors.background, fontWeight: '700', fontSize: 15 },
  outlineBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 4,
  },
  outlineBtnText: { color: colors.muted, fontWeight: '600', fontSize: 14 },

  errorText: {
    fontSize: 15,
    color: colors.error,
    textAlign: 'center',
    marginBottom: 16,
  },
});
