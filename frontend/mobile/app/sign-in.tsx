import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { useSignIn, useOAuth, useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { colors } from '../lib/theme';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
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
      const { createdSessionId, setActive: setActiveSession } = await startFlow({
        redirectUrl: 'selecta://oauth-callback',
      });
      if (createdSessionId && setActiveSession) {
        await setActiveSession({ session: createdSessionId });
        router.replace('/(tabs)/events');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `${provider} sign in failed.`;
      if (!msg.includes('cancelled') && !msg.includes('canceled')) {
        setError(msg);
      }
    } finally {
      setSocialLoading(null);
    }
  }, [startGoogleAuth, startAppleAuth, router]);

  const handleSignIn = useCallback(async () => {
    if (!isLoaded) return;
    setError('');
    setLoading(true);
    try {
      const result = await signIn.create({ identifier: email.trim(), password });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/(tabs)/events');
      } else {
        setError('Sign in incomplete. Please try again.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  }, [isLoaded, email, password, signIn, setActive, router]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.inner}>
          <Text style={styles.title}>Selecta</Text>
          <Text style={styles.subtitle}>Inception Studio</Text>

          <View style={styles.divider} />

          {/* Social Sign In */}
          <TouchableOpacity
            style={styles.appleButton}
            onPress={() => handleSocialSignIn('apple')}
            disabled={!!socialLoading}
            activeOpacity={0.7}
          >
            {socialLoading === 'apple' ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={styles.appleIcon}>{'\uF8FF'}</Text>
                <Text style={styles.appleText}>Continue with Apple</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.googleButton}
            onPress={() => handleSocialSignIn('google')}
            disabled={!!socialLoading}
            activeOpacity={0.7}
          >
            {socialLoading === 'google' ? (
              <ActivityIndicator color="#333" size="small" />
            ) : (
              <>
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.googleText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Or divider */}
          <View style={styles.orDivider}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>or sign in with email</Text>
            <View style={styles.orLine} />
          </View>

          {/* Email/Password */}
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email address"
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
              style={[styles.signInButton, loading && styles.buttonDisabled]}
              onPress={handleSignIn}
              disabled={loading || !email.trim() || !password}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator color={colors.background} size="small" />
              ) : (
                <Text style={styles.signInText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center' },
  inner: { paddingHorizontal: 28, paddingVertical: 40 },
  title: { fontSize: 42, fontWeight: '800', color: colors.gold, textAlign: 'center', letterSpacing: 2 },
  subtitle: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 6, letterSpacing: 1.5, textTransform: 'uppercase' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 32, marginHorizontal: 40 },

  // Apple button — black with white text (standard Apple style)
  appleButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#000', borderRadius: 12, paddingVertical: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#333',
  },
  appleIcon: { fontSize: 20, color: '#fff' },
  appleText: { fontSize: 17, fontWeight: '600', color: '#fff' },

  // Google button — white with dark text (standard Google style)
  googleButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 12, paddingVertical: 16,
  },
  googleIcon: { fontSize: 20, fontWeight: '700', color: '#4285F4' },
  googleText: { fontSize: 17, fontWeight: '600', color: '#333' },

  // Or
  orDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: 24, paddingHorizontal: 8 },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border },
  orText: { color: colors.muted, fontSize: 12, fontWeight: '500', paddingHorizontal: 14 },

  // Form
  form: { gap: 12 },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 15, fontSize: 16, color: colors.text,
  },
  error: { color: colors.error, fontSize: 13, textAlign: 'center' },
  signInButton: { backgroundColor: colors.gold, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.5 },
  signInText: { color: colors.background, fontSize: 17, fontWeight: '700' },
});
