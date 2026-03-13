import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/auth';
import { useTokens } from '../../theme/tokens';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const signUp = useAuthStore((s) => s.signUp);
  const t = useTokens();

  const handleRegister = async () => {
    if (!email || !password || !displayName) {
      setError('Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await signUp(email, password, displayName);
      router.replace('/(auth)/onboarding');
    } catch (err: any) {
      setError(err.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background-primary"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-text-primary text-3xl font-bold mb-2">Create Account</Text>
        <Text className="text-text-tertiary text-base mb-8">Start your banking journey</Text>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text className="text-text-tertiary text-sm font-medium mb-2">Full Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: t.surface.default, borderColor: t.border.default, color: t.text.primary }]}
              value={displayName}
              onChangeText={(v) => { setDisplayName(v); setError(''); }}
              placeholder="John Smith"
              placeholderTextColor={t.text.tertiary}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text className="text-text-tertiary text-sm font-medium mb-2">Email</Text>
            <TextInput
              style={[styles.input, { backgroundColor: t.surface.default, borderColor: t.border.default, color: t.text.primary }]}
              value={email}
              onChangeText={(v) => { setEmail(v); setError(''); }}
              placeholder="john@example.com"
              placeholderTextColor={t.text.tertiary}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text className="text-text-tertiary text-sm font-medium mb-2">Password</Text>
            <TextInput
              style={[styles.input, { backgroundColor: t.surface.default, borderColor: t.border.default, color: t.text.primary }]}
              value={password}
              onChangeText={(v) => { setPassword(v); setError(''); }}
              placeholder="Min. 6 characters"
              placeholderTextColor={t.text.tertiary}
              secureTextEntry
            />
          </View>
        </View>

        {error ? (
          <Text className="text-status-error text-sm text-center mb-3">{error}</Text>
        ) : null}

        <TouchableOpacity
          className={`py-4 rounded-2xl items-center mb-4 ${loading ? 'opacity-60' : ''}`}
          style={{ backgroundColor: t.brand.default }}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white text-base font-semibold">Create Account</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-brand-default text-sm text-center">Already have an account? Log in</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingTop: 80 },
  form: { gap: 20, marginBottom: 16 },
  inputGroup: { gap: 0 },
  input: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
  },
});
