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

const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;
const DOB_REGEX = /^\d{2}\/\d{2}\/\d{4}$/;

function parseDob(display: string): string {
  // Convert DD/MM/YYYY → YYYY-MM-DD for API
  const [day, month, year] = display.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function formatDobInput(raw: string): string {
  // Auto-insert slashes: 01/01/1990
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export default function OnboardingScreen() {
  const [givenName, setGivenName] = useState('');
  const [surname, setSurname] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [postcodeError, setPostcodeError] = useState('');
  const [dobError, setDobError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePostcodeChange = (val: string) => {
    setPostalCode(val.toUpperCase());
    if (val.length > 3) {
      setPostcodeError(UK_POSTCODE_REGEX.test(val.trim()) ? '' : 'Enter a valid UK postcode (e.g. SW1A 2AA)');
    } else {
      setPostcodeError('');
    }
  };

  const handleDobChange = (val: string) => {
    const formatted = formatDobInput(val);
    setDateOfBirth(formatted);
    if (formatted.length === 10) {
      if (!DOB_REGEX.test(formatted)) {
        setDobError('Use DD/MM/YYYY format');
      } else {
        const apiDate = parseDob(formatted);
        const dob = new Date(apiDate);
        const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        setDobError(age < 18 ? 'You must be 18 or over to open an account' : '');
      }
    } else {
      setDobError('');
    }
  };

  const handleSubmit = async () => {
    if (!givenName || !surname || !dateOfBirth || !addressLine1 || !city || !postalCode) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (!DOB_REGEX.test(dateOfBirth)) {
      Alert.alert('Error', 'Please enter date of birth as DD/MM/YYYY');
      return;
    }
    if (!UK_POSTCODE_REGEX.test(postalCode.trim())) {
      Alert.alert('Error', 'Please enter a valid UK postcode');
      return;
    }
    if (dobError || postcodeError) return;

    setLoading(true);
    try {
      await startOnboarding({
        givenName,
        surname,
        dateOfBirth: parseDob(dateOfBirth),
        addressLine1,
        city,
        postalCode,
      });
      // Navigate to tabs then open chat to show welcome + account details
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
        {/* Progress indicator */}
        <View style={styles.progress}>
          {[1, 2, 3].map((step) => (
            <View key={step} style={[styles.progressStep, step === 2 && styles.progressStepActive]} />
          ))}
        </View>
        <Text style={styles.progressLabel}>Step 2 of 3 — Identity</Text>

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
              style={[styles.input, dobError ? styles.inputError : null]}
              value={dateOfBirth}
              onChangeText={handleDobChange}
              placeholder="DD/MM/YYYY"
              placeholderTextColor="#555"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
            {dobError ? <Text style={styles.errorText}>{dobError}</Text> : null}
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
                style={[styles.input, postcodeError ? styles.inputError : null]}
                value={postalCode}
                onChangeText={handlePostcodeChange}
                placeholder="SW1A 2AA"
                placeholderTextColor="#555"
                autoCapitalize="characters"
              />
              {postcodeError ? <Text style={styles.errorText}>{postcodeError}</Text> : null}
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
  inputError: { borderColor: '#e74c3c' },
  errorText: { color: '#e74c3c', fontSize: 12, marginTop: 4 },
  progress: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  progressStep: { flex: 1, height: 3, borderRadius: 2, backgroundColor: '#2d2d44' },
  progressStepActive: { backgroundColor: '#6c5ce7' },
  progressLabel: { color: '#555', fontSize: 12, marginBottom: 24 },
});
