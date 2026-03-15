import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { useSignIn, useSignUp, useOAuth, useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { colors } from '../lib/theme';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const { signIn, setActive: setSignInActive, isLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive } = useSignUp();
  const { isSignedIn } = useAuth();
  const { startOAuthFlow: startGoogleAuth } = useOAuth({ strategy: 'oauth_google' });
  const { startOAuthFlow: startAppleAuth } = useOAuth({ strategy: 'oauth_apple' });
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);

  if (isSignedIn) {
    router.replace('/(tabs)/events');
    return null;
  }

  const handleSocialSignIn = useCallback(async (provider: 'google' | 'apple') => {
    setSocialLoading(provider);
    setError('');
    try {
      const startFlow = provider === 'google' ? startGoogleAuth : startAppleAuth;
      const redirectUrl = Linking.createURL('/');

      const { createdSessionId, setActive } = await startFlow({ redirectUrl });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        // Don't navigate — the index.tsx redirect will handle it on next render
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `${provider} sign in failed.`;
      // Don't show error for user cancellation
      if (!msg.toLowerCase().includes('cancel')) {
        setError(msg);
      }
    } finally {
      setSocialLoading(null);
    }
  }, [startGoogleAuth, startAppleAuth, router]);

  const handleEmailSignIn = useCallback(async () => {
    if (!isLoaded) return;
    setError('');
    setLoading(true);
    try {
      const result = await signIn.create({ identifier: email.trim(), password });
      if (result.status === 'complete') {
        await setSignInActive({ session: result.createdSessionId });
        router.replace('/(tabs)/events');
      } else {
        setError('Sign in incomplete. Please try again.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  }, [isLoaded, email, password, signIn, setSignInActive, router]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.inner}>
          <Text style={styles.title}>Selecta</Text>
          <Text style={styles.subtitle}>Inception Studio</Text>

          <View style={styles.spacer} />

          {/* Apple Sign In */}
          <TouchableOpacity
            style={styles.appleButton}
            onPress={() => handleSocialSignIn('apple')}
            disabled={!!socialLoading}
            activeOpacity={0.8}
          >
            {socialLoading === 'apple' ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.appleButtonText}> Sign in with Apple</Text>
            )}
          </TouchableOpacity>

          {/* Google Sign In */}
          <TouchableOpacity
            style={styles.googleButton}
            onPress={() => handleSocialSignIn('google')}
            disabled={!!socialLoading}
            activeOpacity={0.8}
          >
            {socialLoading === 'google' ? (
              <ActivityIndicator color="#333" size="small" />
            ) : (
              <View style={styles.googleInner}>
                {/* Google "G" logo colors */}
                <View style={styles.googleLogoWrap}>
                  <Text style={styles.googleG}>G</Text>
                </View>
                <Text style={styles.googleButtonText}>Sign in with Google</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Or divider */}
          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>or</Text>
            <View style={styles.orLine} />
          </View>

          {/* Email / Password */}
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={colors.muted}
            secureTextEntry
            textContentType="password"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.emailButton, (loading || !email.trim() || !password) && styles.disabled]}
            onPress={handleEmailSignIn}
            disabled={loading || !email.trim() || !password}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={colors.background} size="small" />
            ) : (
              <Text style={styles.emailButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center' },
  inner: { paddingHorizontal: 28, paddingVertical: 40 },
  title: { fontSize: 44, fontWeight: '800', color: colors.gold, textAlign: 'center', letterSpacing: 1 },
  subtitle: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 6, letterSpacing: 1.5, textTransform: 'uppercase' },
  spacer: { height: 36 },

  // Apple — standard black pill
  appleButton: {
    backgroundColor: '#000', borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    borderWidth: 1, borderColor: '#333',
  },
  appleButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },

  // Google — white pill with colored G
  googleButton: {
    backgroundColor: '#fff', borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  googleInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  googleLogoWrap: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  googleG: { fontSize: 18, fontWeight: '800', color: '#4285F4' },
  googleButtonText: { color: '#333', fontSize: 18, fontWeight: '600' },

  // Or
  orRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, paddingHorizontal: 12 },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border },
  orText: { color: colors.muted, fontSize: 13, paddingHorizontal: 16 },

  // Email form
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 15,
    fontSize: 16, color: colors.text, marginBottom: 12,
  },
  error: { color: colors.error, fontSize: 13, textAlign: 'center', marginBottom: 8 },
  emailButton: {
    backgroundColor: colors.gold, borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', marginTop: 4,
  },
  disabled: { opacity: 0.4 },
  emailButtonText: { color: colors.background, fontSize: 17, fontWeight: '700' },
});
