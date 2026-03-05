import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface NetworkGuardProps {
  children: React.ReactNode;
  apiUrl?: string;
}

export function NetworkGuard({ children, apiUrl }: NetworkGuardProps) {
  const [offline, setOffline] = useState(false);
  const [checking, setChecking] = useState(true);

  const checkConnection = async () => {
    setChecking(true);
    try {
      const url = apiUrl || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      const res = await fetch(`${url}/api/health`, { method: 'GET' });
      setOffline(!res.ok && res.status >= 500);
    } catch {
      setOffline(true);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  if (checking) return null; // Don't flash anything while checking

  if (offline) {
    return (
      <View style={styles.container}>
        <Text style={styles.icon}>📡</Text>
        <Text style={styles.title}>Connection Issue</Text>
        <Text style={styles.message}>
          Unable to reach the banking server. Please check your internet connection and try again.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={checkConnection}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  icon: { fontSize: 56, marginBottom: 20 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 12 },
  message: { color: '#8b8ba7', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  retryButton: {
    backgroundColor: '#6c5ce7',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
  },
  retryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
