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
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/auth';
import { useTokens } from '../../theme/tokens';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const signIn = useAuthStore((s) => s.signIn);
  const t = useTokens();

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await signIn(email, password);
      router.replace('/(tabs)');
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
      <View className="flex-1 p-6 pt-20">
        <Text className="text-text-primary text-3xl font-bold mb-2">Welcome Back</Text>
        <Text className="text-text-tertiary text-base mb-8">Log in to your account</Text>

        <View style={styles.form}>
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
              placeholder="Your password"
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
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white text-base font-semibold">Log In</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
          <Text className="text-brand-default text-sm text-center">Don't have an account? Register</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  form: { gap: 20, marginBottom: 16 },
  inputGroup: { gap: 0 },
  input: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
  },
});
