import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  Animated, PanResponder, Dimensions, Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
// Icon helpers (no native SVG dependency)
const Icon = ({ emoji, size = 16 }: { emoji: string; size?: number }) => (
  <Text style={{ fontSize: size }}>{emoji}</Text>
);
import { getSession, getApplicants, updateApplicantStatus } from '../../../lib/api';
import { colors, getStatusColor } from '../../../lib/theme';
import type { Session, Applicant } from '../../../lib/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

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

function SwipeCard({
  applicant,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  isTop,
}: {
  applicant: Applicant;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSwipeUp: () => void;
  isTop: boolean;
}) {
  const pan = useRef(new Animated.ValueXY()).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isTop,
      onMoveShouldSetPanResponder: (_, g) => isTop && (Math.abs(g.dx) > 5 || Math.abs(g.dy) > 5),
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          // Swipe right = Accept
          Animated.parallel([
            Animated.timing(pan.x, { toValue: SCREEN_WIDTH + 100, duration: 250, useNativeDriver: false }),
            Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: false }),
          ]).start(onSwipeRight);
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          // Swipe left = Reject
          Animated.parallel([
            Animated.timing(pan.x, { toValue: -SCREEN_WIDTH - 100, duration: 250, useNativeDriver: false }),
            Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: false }),
          ]).start(onSwipeLeft);
        } else if (gesture.dy < -SWIPE_THRESHOLD) {
          // Swipe up = Waitlist
          Animated.parallel([
            Animated.timing(pan.y, { toValue: -800, duration: 250, useNativeDriver: false }),
            Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: false }),
          ]).start(onSwipeUp);
        } else {
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 5 }).start();
        }
      },
    })
  ).current;

  const rotate = pan.x.interpolate({ inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH], outputRange: ['-15deg', '0deg', '15deg'] });
  const acceptOpacity = pan.x.interpolate({ inputRange: [0, SWIPE_THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' });
  const rejectOpacity = pan.x.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' });
  const waitlistOpacity = pan.y.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  const score = applicant.ai_score ? parseFloat(String(applicant.ai_score)) : null;
  const scoreColor = score !== null ? (score >= 70 ? colors.success : score >= 40 ? colors.warning : colors.error) : colors.muted;
  const displayName = applicant.name || applicant.email || 'Unknown';

  return (
    <Animated.View
      {...(isTop ? panResponder.panHandlers : {})}
      style={[
        cardStyles.card,
        isTop && {
          transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }],
          opacity,
        },
        !isTop && { top: 8, transform: [{ scale: 0.96 }] },
      ]}
    >
      {/* Swipe indicators */}
      {isTop && (
        <>
          <Animated.View style={[cardStyles.indicator, cardStyles.acceptIndicator, { opacity: acceptOpacity }]}>
            <Text style={cardStyles.indicatorText}>ACCEPT</Text>
          </Animated.View>
          <Animated.View style={[cardStyles.indicator, cardStyles.rejectIndicator, { opacity: rejectOpacity }]}>
            <Text style={[cardStyles.indicatorText, { color: colors.error }]}>REJECT</Text>
          </Animated.View>
          <Animated.View style={[cardStyles.indicator, cardStyles.waitlistIndicator, { opacity: waitlistOpacity }]}>
            <Text style={[cardStyles.indicatorText, { color: colors.warning }]}>WAITLIST</Text>
          </Animated.View>
        </>
      )}

      {/* Avatar */}
      <View style={cardStyles.avatarContainer}>
        <View style={cardStyles.avatar}>
          <Text style={cardStyles.avatarText}>{displayName[0]?.toUpperCase() || '?'}</Text>
        </View>
        {score !== null && (
          <View style={[cardStyles.scoreBadge, { backgroundColor: scoreColor + '20', borderColor: scoreColor + '40' }]}>
            <Text style={[cardStyles.scoreText, { color: scoreColor }]}>{Math.round(score)}</Text>
          </View>
        )}
      </View>

      {/* Name & Info */}
      <Text style={cardStyles.name} numberOfLines={2}>{displayName}</Text>

      {applicant.title && (
        <Text style={cardStyles.title} numberOfLines={1}>{applicant.title}</Text>
      )}

      {applicant.company && (
        <View style={cardStyles.infoRow}>
          <Icon emoji="🏢" size={14} />
          <Text style={cardStyles.infoText} numberOfLines={1}>{applicant.company}</Text>
        </View>
      )}

      {applicant.location && (
        <View style={cardStyles.infoRow}>
          <Icon emoji="📍" size={14} />
          <Text style={cardStyles.infoText} numberOfLines={1}>{applicant.location}</Text>
        </View>
      )}

      {applicant.attendee_type && (
        <View style={cardStyles.typeBadge}>
          <Text style={cardStyles.typeText}>
            {applicant.attendee_type_detail || applicant.attendee_type}
          </Text>
        </View>
      )}

      {/* AI Reasoning */}
      {applicant.ai_reasoning && (
        <View style={cardStyles.reasoningBox}>
          <View style={cardStyles.reasoningHeader}>
            <Icon emoji="✨" size={14} />
            <Text style={cardStyles.reasoningLabel}>AI Assessment</Text>
          </View>
          <Text style={cardStyles.reasoningText} numberOfLines={6}>
            {applicant.ai_reasoning}
          </Text>
        </View>
      )}

      {/* Current status */}
      <View style={[cardStyles.statusBar, { backgroundColor: getStatusColor(applicant.status || 'pending') + '15' }]}>
        <Text style={[cardStyles.statusText, { color: getStatusColor(applicant.status || 'pending') }]}>
          {(applicant.status || 'pending').toUpperCase()}
        </Text>
      </View>
    </Animated.View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    position: 'absolute', width: SCREEN_WIDTH - 32, alignSelf: 'center',
    backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    padding: 24, paddingTop: 32, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  indicator: { position: 'absolute', top: 24, zIndex: 10, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 2 },
  acceptIndicator: { right: 24, borderColor: colors.success },
  rejectIndicator: { left: 24, borderColor: colors.error },
  waitlistIndicator: { alignSelf: 'center', top: 24, borderColor: colors.warning },
  indicatorText: { fontSize: 20, fontWeight: '800', color: colors.success, letterSpacing: 2 },
  avatarContainer: { alignItems: 'center', marginBottom: 16 },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: colors.border,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.gold + '30',
  },
  avatarText: { fontSize: 32, fontWeight: '700', color: colors.gold },
  scoreBadge: {
    position: 'absolute', bottom: -4, right: -4, paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 12, borderWidth: 1, minWidth: 32, alignItems: 'center',
  },
  scoreText: { fontSize: 13, fontWeight: '700' },
  name: { fontSize: 22, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 4 },
  title: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  infoText: { fontSize: 13, color: colors.muted },
  typeBadge: {
    marginTop: 8, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12,
    backgroundColor: colors.gold + '15', borderWidth: 1, borderColor: colors.gold + '30',
  },
  typeText: { fontSize: 12, fontWeight: '600', color: colors.gold, textTransform: 'capitalize' },
  reasoningBox: {
    marginTop: 16, width: '100%', padding: 12, borderRadius: 12,
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
  },
  reasoningHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  reasoningLabel: { fontSize: 11, fontWeight: '700', color: colors.gold, textTransform: 'uppercase', letterSpacing: 0.5 },
  reasoningText: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  statusBar: {
    marginTop: 16, width: '100%', paddingVertical: 6, borderRadius: 8, alignItems: 'center',
  },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
});

export default function SessionDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!sessionId) return;
    try {
      setError(null);
      const [sessionData, applicantData] = await Promise.all([
        getSession(sessionId), getApplicants(sessionId),
      ]);
      setSession(sessionData);
      // Show pending first, then by score descending
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

  const handleSwipe = useCallback(async (status: string) => {
    const applicant = applicants[currentIndex];
    if (!applicant) return;
    try {
      await updateApplicantStatus(applicant.applicant_id, status);
      setApplicants(prev => prev.map(a =>
        a.applicant_id === applicant.applicant_id ? { ...a, status } : a
      ));
    } catch {
      Alert.alert('Error', 'Failed to update status');
    }
    setCurrentIndex(prev => prev + 1);
  }, [applicants, currentIndex]);

  const stats = computeStats(applicants);
  const remaining = applicants.length - currentIndex;

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.gold} size="large" /></View>;
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {session && <Text style={styles.sessionName} numberOfLines={1}>{session.name}</Text>}
        <View style={styles.statsRow}>
          <StatBox label="Total" value={stats.total} color={colors.text} />
          <StatBox label="Accept" value={stats.accepted} color={colors.statusAccepted} />
          <StatBox label="Wait" value={stats.waitlisted} color={colors.statusWaitlisted} />
          <StatBox label="Reject" value={stats.rejected} color={colors.statusRejected} />
        </View>
      </View>

      {/* Card Stack */}
      <View style={styles.cardStack}>
        {remaining > 0 ? (
          <>
            {/* Next card (behind) */}
            {currentIndex + 1 < applicants.length && (
              <SwipeCard
                key={applicants[currentIndex + 1].applicant_id}
                applicant={applicants[currentIndex + 1]}
                onSwipeLeft={() => {}}
                onSwipeRight={() => {}}
                onSwipeUp={() => {}}
                isTop={false}
              />
            )}
            {/* Top card */}
            <SwipeCard
              key={applicants[currentIndex].applicant_id}
              applicant={applicants[currentIndex]}
              onSwipeLeft={() => handleSwipe('rejected')}
              onSwipeRight={() => handleSwipe('accepted')}
              onSwipeUp={() => handleSwipe('waitlisted')}
              isTop={true}
            />
          </>
        ) : (
          <View style={styles.doneContainer}>
            <Icon emoji="🎉" size={64} />
            <Text style={styles.doneText}>All reviewed!</Text>
            <Text style={styles.doneSubtext}>{applicants.length} applicants processed</Text>
            <TouchableOpacity style={styles.resetButton} onPress={() => setCurrentIndex(0)}>
              <Text style={styles.resetText}>Start Over</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Bottom action buttons */}
      {remaining > 0 && (
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => handleSwipe('rejected')}>
            <Icon emoji="👎" size={28} />
            <Text style={[styles.actionLabel, { color: colors.error }]}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.waitlistBtn]} onPress={() => handleSwipe('waitlisted')}>
            <Icon emoji="⏳" size={24} />
            <Text style={[styles.actionLabel, { color: colors.warning }]}>Waitlist</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.acceptBtn]} onPress={() => handleSwipe('accepted')}>
            <Icon emoji="👍" size={28} />
            <Text style={[styles.actionLabel, { color: colors.success }]}>Accept</Text>
          </TouchableOpacity>
        </View>
      )}

      {remaining > 0 && (
        <Text style={styles.remainingText}>{remaining} remaining</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: 32 },
  header: { padding: 16, paddingBottom: 8 },
  sessionName: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12 },
  statsRow: { flexDirection: 'row', gap: 6 },
  cardStack: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  actions: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 20, paddingVertical: 16, paddingHorizontal: 24,
  },
  actionBtn: {
    alignItems: 'center', justifyContent: 'center', width: 72, height: 72,
    borderRadius: 36, borderWidth: 2, gap: 4,
  },
  rejectBtn: { borderColor: colors.error + '40', backgroundColor: colors.error + '10' },
  waitlistBtn: { borderColor: colors.warning + '40', backgroundColor: colors.warning + '10', width: 60, height: 60, borderRadius: 30 },
  acceptBtn: { borderColor: colors.success + '40', backgroundColor: colors.success + '10' },
  actionLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  remainingText: { textAlign: 'center', color: colors.muted, fontSize: 12, paddingBottom: 12 },
  doneContainer: { alignItems: 'center', gap: 12 },
  doneText: { fontSize: 24, fontWeight: '700', color: colors.text },
  doneSubtext: { fontSize: 14, color: colors.muted },
  resetButton: { marginTop: 8, backgroundColor: colors.gold, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  resetText: { color: colors.background, fontWeight: '600', fontSize: 14 },
  errorText: { fontSize: 15, color: colors.error, textAlign: 'center', marginBottom: 16 },
  retryButton: { backgroundColor: colors.gold, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: colors.background, fontWeight: '600', fontSize: 14 },
});
