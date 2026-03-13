import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, Clipboard } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../stores/auth';
import { useChatStore } from '../../stores/chat';
import { getProfile } from '../../lib/api';

export default function ProfileScreen() {
  const signOut = useAuthStore((s) => s.signOut);
  const session = useAuthStore((s) => s.session);
  const resetChat = useChatStore((s) => s.reset);
  const [profile, setProfile] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      getProfile().then(setProfile).catch(() => {});
    }, [])
  );

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          resetChat();
          await signOut();
          router.replace('/(auth)/welcome');
        },
      },
    ]);
  };

  const copyToClipboard = (value: string) => {
    Clipboard.setString(value);
    Alert.alert('Copied', 'Copied to clipboard');
  };

  const initials = profile?.display_name?.[0]?.toUpperCase()
    ?? session?.user?.email?.[0]?.toUpperCase()
    ?? '?';

  return (
    <ScrollView style={styles.container}>
      {/* Avatar + name */}
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        {profile?.display_name && (
          <Text style={styles.displayName}>{profile.display_name}</Text>
        )}
        <Text style={styles.email}>{session?.user?.email ?? ''}</Text>
      </View>

      {/* Bank account */}
      {(profile?.sort_code || profile?.account_number) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bank Account</Text>
          <View style={styles.card}>
            {profile.sort_code && (
              <TouchableOpacity style={styles.row} onPress={() => copyToClipboard(profile.sort_code)}>
                <Text style={styles.rowLabel}>Sort Code</Text>
                <View style={styles.rowRight}>
                  <Text style={styles.rowValue}>
                    {profile.sort_code.replace(/(\d{2})(\d{2})(\d{2})/, '$1-$2-$3')}
                  </Text>
                  <Text style={styles.copyHint}>Copy</Text>
                </View>
              </TouchableOpacity>
            )}
            {profile.account_number && (
              <TouchableOpacity style={[styles.row, { borderBottomWidth: 0 }]} onPress={() => copyToClipboard(profile.account_number)}>
                <Text style={styles.rowLabel}>Account No.</Text>
                <View style={styles.rowRight}>
                  <Text style={styles.rowValue}>{profile.account_number}</Text>
                  <Text style={styles.copyHint}>Copy</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* App info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>App Version</Text>
            <Text style={styles.rowValue}>0.1.0</Text>
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.rowLabel}>Environment</Text>
            <Text style={styles.rowValue}>Sandbox</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23', padding: 16 },

  profileHeader: { alignItems: 'center', paddingVertical: 24 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#6c5ce7', justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '700' },
  displayName: { color: '#fff', fontSize: 20, fontWeight: '600', marginBottom: 4 },
  email: { color: '#8b8ba7', fontSize: 14 },

  section: { marginBottom: 24 },
  sectionTitle: {
    color: '#8b8ba7', fontSize: 12, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  card: { backgroundColor: '#1a1a2e', borderRadius: 12, borderWidth: 1, borderColor: '#2d2d44', overflow: 'hidden' },

  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#2d2d44',
  },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { color: '#8b8ba7', fontSize: 14 },
  rowValue: { color: '#fff', fontSize: 14, fontWeight: '500' },
  copyHint: { color: '#6c5ce7', fontSize: 12 },

  signOutButton: {
    backgroundColor: 'rgba(231, 76, 60, 0.1)', borderWidth: 1, borderColor: '#e74c3c',
    paddingVertical: 16, borderRadius: 12, alignItems: 'center',
  },
  signOutText: { color: '#e74c3c', fontSize: 16, fontWeight: '600' },
});
