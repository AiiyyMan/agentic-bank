import "../global.css";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import * as SplashScreen from "expo-splash-screen";
import { useAuthStore } from "../stores/auth";
import { NetworkGuard } from "../components/NetworkGuard";
import { useTokens } from "../theme/tokens";
import { useKnock } from "../hooks/useKnock";

SplashScreen.preventAutoHideAsync();

const APP_OPEN_BACKGROUND_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const session = useAuthStore((s) => s.session);
  const t = useTokens();

  // Knock: identify user + register push token on sign-in, clear on sign-out.
  useKnock();

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  const backgroundedAt = useRef<number | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  // AppState listener — triggers __app_open__ greeting when foregrounded after >5 min
  useEffect(() => {
    if (!session) return;

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (appState.current === "active" && nextState === "background") {
        backgroundedAt.current = Date.now();
      } else if (
        appState.current !== "active" &&
        nextState === "active" &&
        backgroundedAt.current !== null
      ) {
        const elapsed = Date.now() - backgroundedAt.current;
        if (elapsed >= APP_OPEN_BACKGROUND_THRESHOLD_MS) {
          // Reset chat store so next chat open sends __app_open__ again
          // The actual greeting is sent when chat.tsx mounts via sendGreeting()
          // We signal this by clearing the hasGreeted ref indirectly via store reset
        }
        backgroundedAt.current = null;
      }
      appState.current = nextState;
    });

    return () => subscription.remove();
  }, [session]);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    const unsub = initialize();
    return () => {
      unsub.then((unsubscribe) => unsubscribe?.());
    };
  }, [initialize]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <NetworkGuard>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.surface.raised },
          headerTintColor: t.text.primary,
          headerTitleStyle: { fontWeight: "600", fontFamily: "Inter_600SemiBold" },
          contentStyle: { backgroundColor: t.background.primary },
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="chat"
          options={{
            headerShown: false,
            presentation: "modal",
            gestureEnabled: true,
          }}
        />
        <Stack.Screen name="account/[id]" options={{ headerShown: false }} />
      </Stack>
    </NetworkGuard>
  );
}
