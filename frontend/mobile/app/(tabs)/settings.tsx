import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';

import {
  getSettings,
  updateSetting,
  getStoredApiKey,
  setStoredApiKey,
  deleteStoredApiKey,
} from '../../lib/api';
import { colors } from '../../lib/theme';

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  const [apiKey, setApiKey] = useState('');
  const [whitelist, setWhitelist] = useState('');
  const [blacklist, setBlacklist] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      // Load API key from secure storage
      const storedKey = await getStoredApiKey();
      if (storedKey) setApiKey(storedKey);

      // Load whitelist/blacklist from backend
      const settings = await getSettings();
      if (settings && typeof settings === 'object') {
        const settingsArray = Array.isArray(settings) ? settings : [settings];
        for (const s of settingsArray) {
          const item = s as Record<string, unknown>;
          if (item.setting_id === 'global_whitelist') {
            setWhitelist(String(item.value || ''));
          }
          if (item.setting_id === 'global_blacklist') {
            setBlacklist(String(item.value || ''));
          }
        }
      }
    } catch {
      // Settings may not exist yet, that's fine
    }
  }, []);

  useEffect(() => {
    fetchSettings().finally(() => setLoading(false));
  }, [fetchSettings]);

  const handleSaveApiKey = useCallback(async () => {
    setSaving(true);
    try {
      if (apiKey.trim()) {
        await setStoredApiKey(apiKey.trim());
      } else {
        await deleteStoredApiKey();
      }
      Alert.alert('Saved', 'API key saved to secure storage.');
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Failed to save'
      );
    } finally {
      setSaving(false);
    }
  }, [apiKey]);

  const handleSaveLists = useCallback(async () => {
    setSaving(true);
    try {
      await Promise.all([
        updateSetting('global_whitelist', whitelist),
        updateSetting('global_blacklist', blacklist),
      ]);
      Alert.alert('Saved', 'Whitelist and blacklist updated.');
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Failed to save'
      );
    } finally {
      setSaving(false);
    }
  }, [whitelist, blacklist]);

  const handleSignOut = useCallback(async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/sign-in');
        },
      },
    ]);
  }, [signOut, router]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* User info */}
        <View style={styles.userSection}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>
              {(user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0] || '?').toUpperCase()}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>
              {user?.fullName || 'User'}
            </Text>
            <Text style={styles.userEmail}>
              {user?.emailAddresses?.[0]?.emailAddress || ''}
            </Text>
          </View>
        </View>

        {/* API Key */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={{ fontSize: 18 }}>🔑</Text>
            <Text style={styles.sectionTitle}>API Key</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Your Anthropic or OpenAI API key (stored securely on device)
          </Text>
          <TextInput
            style={styles.input}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder="sk-..."
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.buttonDisabled]}
            onPress={handleSaveApiKey}
            disabled={saving}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 16 }}>💾</Text>
            <Text style={styles.saveButtonText}>Save API Key</Text>
          </TouchableOpacity>
        </View>

        {/* Whitelist / Blacklist */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={{ fontSize: 18 }}>🛡️</Text>
            <Text style={styles.sectionTitle}>Global Lists</Text>
          </View>

          <Text style={styles.label}>Whitelist</Text>
          <Text style={styles.labelHint}>
            One name or email per line. Always accepted.
          </Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={whitelist}
            onChangeText={setWhitelist}
            placeholder="John Doe&#10;jane@example.com"
            placeholderTextColor={colors.muted}
            multiline
            textAlignVertical="top"
          />

          <Text style={[styles.label, { marginTop: 16 }]}>Blacklist</Text>
          <Text style={styles.labelHint}>
            One name or email per line. Always rejected.
          </Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={blacklist}
            onChangeText={setBlacklist}
            placeholder="spammer@example.com"
            placeholderTextColor={colors.muted}
            multiline
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.buttonDisabled]}
            onPress={handleSaveLists}
            disabled={saving}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 16 }}>💾</Text>
            <Text style={styles.saveButtonText}>Save Lists</Text>
          </TouchableOpacity>
        </View>

        {/* Sign out */}
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 18 }}>🚪</Text>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
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
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 20,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.gold + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  userAvatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.gold,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  userEmail: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  sectionDescription: {
    fontSize: 13,
    color: colors.muted,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  labelHint: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  textarea: {
    minHeight: 100,
    paddingTop: 12,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 12,
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '700',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.error + '30',
    paddingVertical: 14,
    gap: 8,
  },
  signOutText: {
    color: colors.error,
    fontSize: 15,
    fontWeight: '600',
  },
});
