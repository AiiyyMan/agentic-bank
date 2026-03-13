import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { startOnboarding } from '../../lib/api';
import { useTokens } from '../../theme/tokens';

const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;
const DOB_REGEX = /^\d{2}\/\d{2}\/\d{4}$/;

const TOTAL_STEPS = 3;
const CURRENT_STEP = 2;

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
  const t = useTokens();

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
      // Route to tabs — the __app_open__ greeting in chat.tsx (triggered when messages.length === 0)
      // will show the welcome card + onboarding checklist automatically when the user opens the Chat tab.
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
      className="flex-1 bg-background-primary"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Progress indicator */}
        <View className="flex-row gap-1.5 mb-1">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              className={`flex-1 h-0.5 rounded-full ${i + 1 === CURRENT_STEP ? 'bg-brand-default' : 'bg-border-primary'}`}
            />
          ))}
        </View>
        <Text className="text-text-tertiary text-xs mb-6">
          Step {CURRENT_STEP} of {TOTAL_STEPS} — Your Details
        </Text>

        <Text className="text-text-primary text-3xl font-bold mb-2">Identity Verification</Text>
        <Text className="text-text-tertiary text-base mb-8">We need a few details to open your account</Text>

        <View style={styles.form}>
          <View className="flex-row gap-3">
            <View style={styles.inputGroup} className="flex-1">
              <Text className="text-text-tertiary text-sm font-medium mb-2">First Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: t.surface.default, borderColor: t.border.default, color: t.text.primary }]}
                value={givenName}
                onChangeText={setGivenName}
                placeholder="John"
                placeholderTextColor={t.text.tertiary}
              />
            </View>
            <View style={styles.inputGroup} className="flex-1">
              <Text className="text-text-tertiary text-sm font-medium mb-2">Last Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: t.surface.default, borderColor: t.border.default, color: t.text.primary }]}
                value={surname}
                onChangeText={setSurname}
                placeholder="Smith"
                placeholderTextColor={t.text.tertiary}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text className="text-text-tertiary text-sm font-medium mb-2">Date of Birth</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: t.surface.default, borderColor: dobError ? t.border.error : t.border.default, color: t.text.primary },
              ]}
              value={dateOfBirth}
              onChangeText={handleDobChange}
              placeholder="DD/MM/YYYY"
              placeholderTextColor={t.text.tertiary}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
            {dobError ? <Text className="text-status-error text-xs mt-1">{dobError}</Text> : null}
          </View>

          <View style={styles.inputGroup}>
            <Text className="text-text-tertiary text-sm font-medium mb-2">Address</Text>
            <TextInput
              style={[styles.input, { backgroundColor: t.surface.default, borderColor: t.border.default, color: t.text.primary }]}
              value={addressLine1}
              onChangeText={setAddressLine1}
              placeholder="10 Downing Street"
              placeholderTextColor={t.text.tertiary}
            />
          </View>

          <View className="flex-row gap-3">
            <View style={styles.inputGroup} className="flex-1">
              <Text className="text-text-tertiary text-sm font-medium mb-2">City</Text>
              <TextInput
                style={[styles.input, { backgroundColor: t.surface.default, borderColor: t.border.default, color: t.text.primary }]}
                value={city}
                onChangeText={setCity}
                placeholder="London"
                placeholderTextColor={t.text.tertiary}
              />
            </View>
            <View style={styles.inputGroup} className="flex-1">
              <Text className="text-text-tertiary text-sm font-medium mb-2">Post Code</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: t.surface.default, borderColor: postcodeError ? t.border.error : t.border.default, color: t.text.primary },
                ]}
                value={postalCode}
                onChangeText={handlePostcodeChange}
                placeholder="SW1A 2AA"
                placeholderTextColor={t.text.tertiary}
                autoCapitalize="characters"
              />
              {postcodeError ? <Text className="text-status-error text-xs mt-1">{postcodeError}</Text> : null}
            </View>
          </View>
        </View>

        <TouchableOpacity
          className={`py-4 rounded-2xl items-center mb-6 ${loading ? 'opacity-60' : ''}`}
          style={{ backgroundColor: t.brand.default }}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <View className="items-center gap-1">
              <ActivityIndicator color="#fff" />
              <Text className="text-white text-xs mt-1">Setting up your account...</Text>
            </View>
          ) : (
            <Text className="text-white text-base font-semibold">Open Account</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingTop: 60 },
  form: { gap: 20, marginBottom: 32 },
  inputGroup: { gap: 0 },
  input: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
  },
});
