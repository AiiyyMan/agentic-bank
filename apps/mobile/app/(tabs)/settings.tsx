import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../stores/auth';
import { getProfile } from '../../lib/api';

export default function SettingsScreen() {
  const signOut = useAuthStore((s) => s.signOut);
  const session = useAuthStore((s) => s.session);
  const [profile, setProfile] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      getProfile().then(setProfile).catch(() => {});
    }, [])
  );

  const handleLogout = async () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/welcome');
        },
      },
    ]);
  };

  const initials = profile?.display_name?.[0]?.toUpperCase()
    ?? session?.user?.email?.[0]?.toUpperCase()
    ?? '?';

  return (
    <ScrollView className="flex-1 bg-background-primary p-4">
      {/* Profile Section */}
      <View className="mb-6">
        <Text className="text-text-tertiary text-xs font-medium uppercase tracking-wide mb-2.5">Profile</Text>
        <View className="bg-surface-primary border border-border-primary rounded-xl p-4 items-center">
          <View className="w-14 h-14 rounded-full bg-brand-default justify-center items-center mb-3">
            <Text className="text-white text-2xl font-bold">{initials}</Text>
          </View>
          {profile?.display_name && (
            <Text className="text-text-primary text-lg font-semibold mb-1">{profile.display_name}</Text>
          )}
          <Text className="text-text-tertiary text-sm">{session?.user?.email ?? 'Not signed in'}</Text>
        </View>
      </View>

      {/* Account Section */}
      <View className="mb-6">
        <Text className="text-text-tertiary text-xs font-medium uppercase tracking-wide mb-2.5">Bank Account</Text>
        <View className="bg-surface-primary border border-border-primary rounded-xl overflow-hidden">
          {profile?.griffin_account_url ? (
            <>
              <View className="flex-row justify-between items-center px-4 py-3.5 border-b border-border-primary">
                <Text className="text-text-tertiary text-sm">Status</Text>
                <View className="bg-status-success-subtle px-2.5 py-1 rounded-full">
                  <Text className="text-status-success-text text-xs font-semibold">Active</Text>
                </View>
              </View>
              <View className="flex-row justify-between items-center px-4 py-3.5">
                <Text className="text-text-tertiary text-sm">Account</Text>
                <Text className="text-text-primary text-sm font-medium">
                  {profile.griffin_account_url.split('/').pop()?.slice(0, 8)}...
                </Text>
              </View>
            </>
          ) : (
            <View className="px-4 py-4">
              <Text className="text-text-tertiary text-sm leading-5">
                Account not yet set up. Complete onboarding to get started.
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* App Info */}
      <View className="mb-6">
        <Text className="text-text-tertiary text-xs font-medium uppercase tracking-wide mb-2.5">About</Text>
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

      {/* Log out */}
      <TouchableOpacity
        className="border border-status-error rounded-xl py-4 items-center"
        style={{ backgroundColor: 'rgba(244, 63, 94, 0.08)' }}
        onPress={handleLogout}
      >
        <Text className="text-status-error text-base font-semibold">Log Out</Text>
      </TouchableOpacity>

      <View className="h-10" />
    </ScrollView>
  );
}
