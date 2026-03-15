import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';

import { getLinkedInProfiles } from '../../lib/api';
import { colors } from '../../lib/theme';

interface LinkedInProfile {
  url: string;
  name?: string;
  headline?: string;
  location?: string;
  photo_url?: string;
  [key: string]: unknown;
}

export default function LinkedInScreen() {
  const [profiles, setProfiles] = useState<LinkedInProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    try {
      setError(null);
      const data = (await getLinkedInProfiles()) as LinkedInProfile[];
      // Sort by name
      const sorted = [...data].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '')
      );
      setProfiles(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profiles');
    }
  }, []);

  useEffect(() => {
    fetchProfiles().finally(() => setLoading(false));
  }, [fetchProfiles]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProfiles();
    setRefreshing(false);
  }, [fetchProfiles]);

  const renderProfile = ({ item }: { item: LinkedInProfile }) => (
    <View style={styles.profileCard}>
      <View style={styles.profileIcon}>
        <Text style={{ fontSize: 18 }}>👤</Text>
      </View>
      <View style={styles.profileContent}>
        <Text style={styles.profileName} numberOfLines={1}>
          {item.name || 'Unknown'}
        </Text>
        {item.headline ? (
          <Text style={styles.profileHeadline} numberOfLines={2}>
            {item.headline}
          </Text>
        ) : null}
        {item.location ? (
          <Text style={styles.profileLocation} numberOfLines={1}>
            {item.location}
          </Text>
        ) : null}
      </View>
      <Text style={{ fontSize: 14 }}>🔗</Text>
    </View>
  );

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
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={profiles}
        keyExtractor={(item) => item.url}
        renderItem={renderProfile}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold}
            colors={[colors.gold]}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Text style={{ fontSize: 20 }}>🗄️</Text>
            </View>
            <View>
              <Text style={styles.headerTitle}>LinkedIn Database</Text>
              <Text style={styles.headerSubtitle}>
                {profiles.length} profile{profiles.length !== 1 ? 's' : ''} cached
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 48 }}>🔗</Text>
            <Text style={styles.emptyText}>No profiles yet</Text>
            <Text style={styles.emptySubtext}>
              Profiles scraped from the web dashboard will appear here
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 32,
  },
  list: {
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.gold + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 1,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  profileIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  profileContent: {
    flex: 1,
    marginRight: 8,
  },
  profileName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  profileHeadline: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  profileLocation: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 15,
    color: colors.error,
    textAlign: 'center',
  },
});
