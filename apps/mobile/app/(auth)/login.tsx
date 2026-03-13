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

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const signIn = useAuthStore((s) => s.signIn);

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
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Log in to your account</Text>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={(v) => { setEmail(v); setError(''); }}
              placeholder="john@example.com"
              placeholderTextColor="#555"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={(v) => { setPassword(v); setError(''); }}
              placeholder="Your password"
              placeholderTextColor="#555"
              secureTextEntry
            />
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Log In</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
          <Text style={styles.linkText}>Don't have an account? Register</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  content: { flex: 1, padding: 24, paddingTop: 80 },
  title: { fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#8b8ba7', marginBottom: 32 },
  form: { gap: 20, marginBottom: 16 },
  inputGroup: { gap: 8 },
  label: { fontSize: 14, color: '#8b8ba7', fontWeight: '500' },
  input: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#6c5ce7',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  linkText: { color: '#6c5ce7', textAlign: 'center', fontSize: 14 },
});
