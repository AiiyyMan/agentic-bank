import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { router } from 'expo-router';

const VALUE_PROPS = [
  { icon: '⚡', label: 'AI-powered banking' },
  { icon: '🔒', label: 'FSCS protected up to £85k' },
  { icon: '💬', label: 'Natural language control' },
  { icon: '📊', label: 'Smart spending insights' },
];

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.logoMark}>
          <Text style={styles.logoEmoji}>🏦</Text>
        </View>
        <Text style={styles.name}>Agentic Bank</Text>
        <Text style={styles.tagline}>Banking, reimagined with AI</Text>
      </View>

      {/* Value props */}
      <View style={styles.valueProps}>
        {VALUE_PROPS.map((vp) => (
          <View key={vp.label} style={styles.valueProp}>
            <Text style={styles.valuePropIcon}>{vp.icon}</Text>
            <Text style={styles.valuePropLabel}>{vp.label}</Text>
          </View>
        ))}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/(auth)/register')}
        >
          <Text style={styles.primaryButtonText}>Open a free account</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={styles.secondaryButtonText}>Sign in</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          By continuing you agree to our Terms of Service.{'\n'}
          Agentic Bank is a demo product. Not a real bank.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 80,
  },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#6c5ce7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoEmoji: { fontSize: 36 },
  name: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 17,
    color: '#8b8ba7',
    textAlign: 'center',
  },

  valueProps: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    paddingVertical: 24,
  },
  valueProp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1a1a2e',
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  valuePropIcon: { fontSize: 16 },
  valuePropLabel: { color: '#cbd5e1', fontSize: 13, fontWeight: '500' },

  actions: { gap: 12 },
  primaryButton: {
    backgroundColor: '#6c5ce7',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  secondaryButtonText: { color: '#8b8ba7', fontSize: 16 },
  disclaimer: {
    color: '#555',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 4,
  },
});
