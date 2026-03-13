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
  const [copied, setCopied] = useState<string | null>(null);

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

  const copyToClipboard = (value: string, label: string) => {
    Clipboard.setString(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const initials = profile?.display_name?.[0]?.toUpperCase()
    ?? session?.user?.email?.[0]?.toUpperCase()
    ?? '?';

  return (
    <ScrollView className="flex-1 bg-background-primary p-4">
      {/* Avatar + name */}
      <View className="items-center py-6">
        <View className="w-18 h-18 rounded-full bg-brand-default justify-center items-center mb-3" style={styles.avatar}>
          <Text className="text-white text-3xl font-bold">{initials}</Text>
        </View>
        {profile?.display_name && (
          <Text className="text-text-primary text-xl font-semibold mb-1">{profile.display_name}</Text>
        )}
        <Text className="text-text-tertiary text-sm">{session?.user?.email ?? ''}</Text>
      </View>

      {/* Inline copy toast */}
      {copied && (
        <Text className="text-status-success text-xs text-center mb-2">{copied} copied!</Text>
      )}

      {/* Bank account */}
      {(profile?.sort_code || profile?.account_number) && (
        <View className="mb-6">
          <Text className="text-text-tertiary text-xs font-semibold uppercase tracking-wide mb-2.5">Bank Account</Text>
          <View className="bg-surface-primary border border-border-primary rounded-xl overflow-hidden">
            {profile.sort_code && (
              <TouchableOpacity
                className="flex-row justify-between items-center px-4 py-3.5 border-b border-border-primary"
                onPress={() => copyToClipboard(profile.sort_code, 'Sort code')}
              >
                <Text className="text-text-tertiary text-sm">Sort Code</Text>
                <View className="flex-row items-center gap-2">
                  <Text className="text-text-primary text-sm font-medium">
                    {profile.sort_code.replace(/(\d{2})(\d{2})(\d{2})/, '$1-$2-$3')}
                  </Text>
                  <Text className="text-brand-default text-xs">Copy</Text>
                </View>
              </TouchableOpacity>
            )}
            {profile.account_number && (
              <TouchableOpacity
                className="flex-row justify-between items-center px-4 py-3.5"
                onPress={() => copyToClipboard(profile.account_number, 'Account number')}
              >
                <Text className="text-text-tertiary text-sm">Account No.</Text>
                <View className="flex-row items-center gap-2">
                  <Text className="text-text-primary text-sm font-medium">{profile.account_number}</Text>
                  <Text className="text-brand-default text-xs">Copy</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* App info */}
      <View className="mb-6">
        <Text className="text-text-tertiary text-xs font-semibold uppercase tracking-wide mb-2.5">About</Text>
        <View className="bg-surface-primary border border-border-primary rounded-xl overflow-hidden">
          <View className="flex-row justify-between items-center px-4 py-3.5 border-b border-border-primary">
            <Text className="text-text-tertiary text-sm">App Version</Text>
            <Text className="text-text-primary text-sm font-medium">0.1.0</Text>
          </View>
          <View className="flex-row justify-between items-center px-4 py-3.5">
            <Text className="text-text-tertiary text-sm">Environment</Text>
            <Text className="text-text-primary text-sm font-medium">Sandbox</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        className="border border-status-error rounded-xl py-4 items-center"
        style={styles.signOutButton}
        onPress={handleSignOut}
      >
        <Text className="text-status-error text-base font-semibold">Sign Out</Text>
      </TouchableOpacity>

      <View className="h-24" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 72, height: 72 },
  signOutButton: { backgroundColor: 'rgba(244, 63, 94, 0.08)' },
});
