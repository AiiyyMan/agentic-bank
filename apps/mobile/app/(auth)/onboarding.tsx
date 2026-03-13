import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { startOnboarding } from '../../lib/api';

export default function OnboardingScreen() {
  const [givenName, setGivenName] = useState('');
  const [surname, setSurname] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!givenName || !surname || !dateOfBirth || !addressLine1 || !city || !postalCode) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await startOnboarding({
        givenName,
        surname,
        dateOfBirth,
        addressLine1,
        city,
        postalCode,
      });
      // Navigate to tabs then open chat to show welcome + checklist
      router.replace('/(tabs)');
      setTimeout(() => router.push('/chat'), 400);
    } catch (err: any) {
      Alert.alert('Onboarding Failed', err.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Identity Verification</Text>
        <Text style={styles.subtitle}>We need a few details to open your account</Text>

        <View style={styles.form}>
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>First Name</Text>
              <TextInput
                style={styles.input}
                value={givenName}
                onChangeText={setGivenName}
                placeholder="John"
                placeholderTextColor="#555"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={styles.input}
                value={surname}
                onChangeText={setSurname}
                placeholder="Smith"
                placeholderTextColor="#555"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Date of Birth</Text>
            <TextInput
              style={styles.input}
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              placeholder="1990-01-15"
              placeholderTextColor="#555"
              keyboardType="numbers-and-punctuation"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address</Text>
            <TextInput
              style={styles.input}
              value={addressLine1}
              onChangeText={setAddressLine1}
              placeholder="10 Downing Street"
              placeholderTextColor="#555"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>City</Text>
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={setCity}
                placeholder="London"
                placeholderTextColor="#555"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Post Code</Text>
              <TextInput
                style={styles.input}
                value={postalCode}
                onChangeText={setPostalCode}
                placeholder="SW1A 2AA"
                placeholderTextColor="#555"
                autoCapitalize="characters"
              />
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <View>
              <ActivityIndicator color="#fff" />
              <Text style={[styles.buttonText, { marginTop: 4, fontSize: 12 }]}>
                Setting up your account...
              </Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>Open Account</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  scroll: { padding: 24, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#8b8ba7', marginBottom: 32 },
  form: { gap: 20, marginBottom: 32 },
  row: { flexDirection: 'row', gap: 12 },
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
  button: {
    backgroundColor: '#6c5ce7',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
