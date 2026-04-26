import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '@/state/authStore';
import { useAiInsightsStore } from '@/state/aiInsightsStore';
import { useVoiceLanguageStore } from '@/state/voiceLanguageStore';
import { notificationService } from '@/services/notificationService';
import { colors } from '@/theme/colors';

export default function RootLayout() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const signedIn = useAuthStore((s) => s.signedIn);
  const hydrate = useAuthStore((s) => s.hydrate);
  const hydrateInsights = useAiInsightsStore((s) => s.hydrate);
  const hydrateVoiceLang = useVoiceLanguageStore((s) => s.hydrate);

  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    void hydrate();
    void hydrateInsights();
    void hydrateVoiceLang();
    // Ensure the high-importance Android notification channel exists
    // BEFORE the user grants permission — that way the very first
    // reminder lands in a properly configured channel and rings on
    // the lockscreen even when the app is killed.
    void notificationService.ensureReminderChannel();
    notificationService.requestPermissions().catch(() => null);
  }, [hydrate, hydrateInsights, hydrateVoiceLang]);

  // When the user taps a fired alarm notification, open the alarm-style
  // reminder screen so it rings (vibration + repeating TTS) until they
  // acknowledge it. For test alarms we route to the same screen but in
  // diagnostic mode so the user can verify ringing works without a
  // real dose record on the server.
  useEffect(() => {
    if (!signedIn) return;
    const route = (data: Record<string, unknown>) => {
      const doseLogId =
        typeof data.doseLogId === 'string' ? data.doseLogId : '';
      const test = data.test === true;
      const medicineName =
        typeof data.medicineName === 'string'
          ? data.medicineName
          : 'Test medicine';
      if (test) {
        router.push({
          pathname: '/reminder/[doseLogId]',
          params: { doseLogId: 'test', testMedicine: medicineName },
        });
        return;
      }
      if (doseLogId) {
        router.push({
          pathname: '/reminder/[doseLogId]',
          params: { doseLogId },
        });
      } else {
        router.push('/(tabs)/home');
      }
    };

    // Cold-launched from a tapped notification.
    void notificationService.getLaunchPayload().then((payload) => {
      if (payload) route(payload);
    });

    // Tap while app is running.
    const unsub = notificationService.addResponseListener(route);
    return unsub;
  }, [signedIn, router]);

  // Auth-aware redirect: if signed-out, force the auth stack;
  // if signed-in, push out of the auth stack into the tabs.
  useEffect(() => {
    if (!hydrated) return;
    const inAuth = segments[0] === 'auth';
    if (!signedIn && !inAuth) {
      router.replace('/auth/welcome');
    } else if (signedIn && inAuth) {
      router.replace('/(tabs)/home');
    }
  }, [hydrated, signedIn, segments, router]);

  if (!hydrated) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface.background,
        }}
      >
        <ActivityIndicator color={colors.brand.green} size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.surface.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="auth/welcome" />
          <Stack.Screen name="auth/email" />
          <Stack.Screen name="auth/otp" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="scan"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen name="review" />
          <Stack.Screen name="medicine/[id]" />
          <Stack.Screen name="caregivers/[id]" />
          <Stack.Screen name="history/[date]" />
          <Stack.Screen
            name="reminder/[doseLogId]"
            options={{
              presentation: 'fullScreenModal',
              animation: 'slide_from_bottom',
              gestureEnabled: false,
            }}
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
