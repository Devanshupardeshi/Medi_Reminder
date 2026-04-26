import { Redirect } from 'expo-router';
import { useAuthStore } from '@/state/authStore';

export default function Index() {
  const signedIn = useAuthStore((s) => s.signedIn);
  return signedIn ? (
    <Redirect href="/(tabs)/home" />
  ) : (
    <Redirect href="/auth/welcome" />
  );
}
