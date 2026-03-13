/**
 * useKnock — manages Knock identity lifecycle.
 *
 * - Calls knockIdentify() when a session becomes available (sign-in / app restore).
 * - Attempts to register an Expo push token if expo-notifications is available at
 *   runtime (it is not listed in package.json, so the import is wrapped in a
 *   try/catch and fails gracefully).
 * - Cleans up (no-op for REST client) on sign-out.
 *
 * Mount this hook once near the root of the authenticated app (e.g. _layout.tsx).
 */

import { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/auth';
import { knockIdentify, registerPushToken } from '../lib/knock';

async function tryGetExpoPushToken(): Promise<string | null> {
  try {
    // expo-notifications is not in package.json; dynamic require will throw if
    // the native module is absent. We catch silently so the app keeps working.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Notifications = require('expo-notifications') as typeof import('expo-notifications');

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch {
    // expo-notifications not installed or permissions unavailable — ignore.
    return null;
  }
}

export function useKnock(): void {
  const session = useAuthStore((s) => s.session);
  const registeredUserId = useRef<string | null>(null);

  useEffect(() => {
    const userId = session?.user?.id ?? null;

    if (!userId) {
      // Signed out — clear the registered ref so we re-register on next sign-in.
      registeredUserId.current = null;
      return;
    }

    // Already registered this session — skip.
    if (registeredUserId.current === userId) {
      return;
    }

    registeredUserId.current = userId;

    // Fire-and-forget; errors are swallowed inside each function.
    (async () => {
      const displayName: string | undefined =
        (session?.user?.user_metadata?.display_name as string | undefined) ?? undefined;
      await knockIdentify(userId, displayName);

      const pushToken = await tryGetExpoPushToken();
      if (pushToken) {
        await registerPushToken(userId, pushToken);
      }
    })();
  }, [session]);
}
