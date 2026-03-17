import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  analyzeAll, getPromptSettings, updatePromptSettings,
  getStats, getStoredApiKey, setStoredApiKey,
} from '../../../lib/api';
import { colors } from '../../../lib/theme';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROVIDERS = [
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'OpenAI', value: 'openai' },
] as const;

const MODELS: Record<string, { label: string; value: string }[]> = {
  anthropic: [
    { label: 'Sonnet 4', value: 'claude-sonnet-4-20250514' },
    { label: 'Opus 4', value: 'claude-opus-4-20250514' },
    { label: 'Haiku 4', value: 'claude-haiku-4-20250514' },
  ],
  openai: [
    { label: 'GPT-4o', value: 'gpt-4o' },
    { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
  ],
};

// ---------------------------------------------------------------------------
// Pill Picker
// ---------------------------------------------------------------------------

function PillPicker({
  options,
  selected,
  onSelect,
}: {
  options: { label: string; value: string }[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={pickerStyles.row}>
      {options.map((opt) => {
        const active = opt.value === selected;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[pickerStyles.pill, active && pickerStyles.pillActive]}
            onPress={() => onSelect(opt.value)}
            activeOpacity={0.7}
          >
            <Text style={[pickerStyles.pillText, active && pickerStyles.pillTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const pickerStyles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  pillActive: {
    borderColor: colors.gold,
    backgroundColor: colors.gold + '18',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  pillTextActive: {
    color: colors.gold,
  },
});

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function AnalyzeScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();

  // Form state
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState('anthropic');
  const [model, setModel] = useState('claude-sonnet-4-20250514');
  const [prompt, setPrompt] = useState('');
  const [criteria, setCriteria] = useState<string[]>([]);
  const [newCriterion, setNewCriterion] = useState('');

  // Loading/progress state
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load saved key + prompt settings on mount
  useEffect(() => {
    (async () => {
      try {
        const [storedKey, promptData] = await Promise.all([
          getStoredApiKey(),
          getPromptSettings().catch(() => null),
        ]);
        if (storedKey) setApiKey(storedKey);
        if (promptData) {
          setPrompt(promptData.default_prompt || '');
          setCriteria(promptData.criteria || []);
        }
      } catch {
        // ignore
      } finally {
        setLoadingSettings(false);
      }
    })();
  }, []);

  // When provider changes, pick first model of that provider
  useEffect(() => {
    const models = MODELS[provider] || [];
    if (models.length > 0) {
      setModel(models[0].value);
    }
  }, [provider]);

  // Cleanup poll on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Add criterion
  const addCriterion = useCallback(() => {
    const val = newCriterion.trim();
    if (!val) return;
    setCriteria((prev) => [...prev, val]);
    setNewCriterion('');
  }, [newCriterion]);

  // Remove criterion
  const removeCriterion = useCallback((index: number) => {
    setCriteria((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Save prompt settings
  const savePromptSettings = useCallback(async () => {
    try {
      await updatePromptSettings({ default_prompt: prompt, criteria });
    } catch {
      // silent save — not critical
    }
  }, [prompt, criteria]);

  // Start analysis
  const handleRun = useCallback(async () => {
    if (!apiKey.trim()) {
      Alert.alert('API Key Required', 'Enter your API key to run analysis.');
      return;
    }
    if (!sessionId) {
      Alert.alert('Error', 'No session selected.');
      return;
    }
    if (!prompt.trim()) {
      Alert.alert('Prompt Required', 'Enter a prompt for the AI analysis.');
      return;
    }

    // Persist API key
    await setStoredApiKey(apiKey.trim());

    // Save prompt settings
    await savePromptSettings();

    setRunning(true);
    setProgress(null);

    // Start polling stats
    pollRef.current = setInterval(async () => {
      try {
        const s = await getStats(sessionId);
        const done = s.total - s.pending;
        setProgress({ done, total: s.total });
        if (done >= s.total && s.total > 0) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch {
        // ignore poll errors
      }
    }, 2000);

    try {
      await analyzeAll({
        api_key: apiKey.trim(),
        model,
        provider,
        prompt: prompt.trim(),
        criteria,
        session_id: sessionId,
      });

      // Final stats check
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;

      try {
        const finalStats = await getStats(sessionId);
        setProgress({ done: finalStats.total - finalStats.pending, total: finalStats.total });
      } catch {
        // ignore
      }

      Alert.alert('Analysis Complete', 'All applicants have been analyzed.', [
        { text: 'View Results', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert('Analysis Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRunning(false);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
  }, [apiKey, sessionId, prompt, criteria, model, provider, savePromptSettings, router]);

  // Progress bar percentage
  const pct = progress ? (progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0) : 0;

  // ---------- Render ----------

  if (loadingSettings) {
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
      keyboardVerticalOffset={100}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* API Key */}
        <Text style={styles.fieldLabel}>API Key</Text>
        <TextInput
          style={styles.textInput}
          value={apiKey}
          onChangeText={setApiKey}
          placeholder="sk-..."
          placeholderTextColor={colors.muted}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          editable={!running}
        />

        {/* Provider */}
        <Text style={styles.fieldLabel}>Provider</Text>
        <PillPicker
          options={PROVIDERS.map((p) => ({ label: p.label, value: p.value }))}
          selected={provider}
          onSelect={(v) => setProvider(v)}
        />

        {/* Model */}
        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Model</Text>
        <PillPicker
          options={MODELS[provider] || []}
          selected={model}
          onSelect={(v) => setModel(v)}
        />

        {/* Prompt */}
        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Prompt</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Enter analysis prompt..."
          placeholderTextColor={colors.muted}
          multiline
          textAlignVertical="top"
          editable={!running}
        />

        {/* Criteria */}
        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Criteria</Text>
        <View style={styles.criteriaList}>
          {criteria.map((c, i) => (
            <View key={`${c}-${i}`} style={styles.criteriaItem}>
              <Text style={styles.criteriaText}>{c}</Text>
              <TouchableOpacity
                onPress={() => removeCriterion(i)}
                style={styles.criteriaRemove}
                disabled={running}
              >
                <Text style={styles.criteriaRemoveText}>{'\u00D7'}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
        <View style={styles.addCriteriaRow}>
          <TextInput
            style={[styles.textInput, styles.addCriteriaInput]}
            value={newCriterion}
            onChangeText={setNewCriterion}
            placeholder="Add criterion..."
            placeholderTextColor={colors.muted}
            onSubmitEditing={addCriterion}
            returnKeyType="done"
            editable={!running}
          />
          <TouchableOpacity
            style={styles.addCriteriaBtn}
            onPress={addCriterion}
            disabled={running}
          >
            <Text style={styles.addCriteriaBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Run button */}
        <TouchableOpacity
          style={[styles.runBtn, running && styles.runBtnDisabled]}
          onPress={handleRun}
          disabled={running}
          activeOpacity={0.7}
        >
          {running ? (
            <ActivityIndicator color={colors.background} size="small" />
          ) : (
            <Text style={styles.runBtnText}>Run Analysis</Text>
          )}
        </TouchableOpacity>

        {/* Progress */}
        {progress && (
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              Progress: {progress.done}/{progress.total}
            </Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.progressPct}>{pct}%</Text>
          </View>
        )}

        {running && (
          <Text style={styles.runningHint}>
            Analysis is running. This may take several minutes for large sessions.
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },

  // Fields
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  textInput: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    marginBottom: 16,
  },
  textArea: {
    minHeight: 100,
    maxHeight: 200,
  },

  // Criteria
  criteriaList: {
    gap: 6,
    marginBottom: 8,
  },
  criteriaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  criteriaText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  criteriaRemove: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.error + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  criteriaRemoveText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.error,
    lineHeight: 20,
  },
  addCriteriaRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  addCriteriaInput: {
    flex: 1,
    marginBottom: 0,
  },
  addCriteriaBtn: {
    width: 48,
    backgroundColor: colors.gold + '20',
    borderWidth: 1,
    borderColor: colors.gold + '40',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCriteriaBtnText: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.gold,
  },

  // Run button
  runBtn: {
    backgroundColor: colors.gold,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  runBtnDisabled: {
    opacity: 0.6,
  },
  runBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.background,
    letterSpacing: 0.3,
  },

  // Progress
  progressContainer: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 10,
  },
  progressBarBg: {
    height: 10,
    backgroundColor: colors.border,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: 10,
    backgroundColor: colors.gold,
    borderRadius: 5,
  },
  progressPct: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gold,
    textAlign: 'right',
  },
  runningHint: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
