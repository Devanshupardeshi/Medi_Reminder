import { Alert } from 'react-native';
import { create } from 'zustand';
import { secureStorage } from '@/services/secureStorage';
import { setUnauthorizedHandler } from '@/services/apiClient';
import { authApi } from '@/services/authApi';
import { tFor } from '@/i18n';
import { useVoiceLanguageStore } from '@/state/voiceLanguageStore';
import type { AuthUser } from '@/types/auth';

interface AuthState {
  hydrated: boolean;
  signedIn: boolean;
  user: AuthUser | null;
  pendingEmail: string | null; // remembered between Email screen and OTP screen

  hydrate: () => Promise<void>;
  setPendingEmail: (email: string) => void;
  completeSignIn: (token: string, user: AuthUser) => Promise<void>;
  setUser: (user: AuthUser) => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  hydrated: false,
  signedIn: false,
  user: null,
  pendingEmail: null,

  async hydrate() {
    const token = await secureStorage.getAccessToken();
    const userJson = await secureStorage.getUserJson();

    let user: AuthUser | null = null;
    if (userJson) {
      try {
        user = JSON.parse(userJson) as AuthUser;
      } catch {
        user = null;
      }
    }

    set({
      hydrated: true,
      signedIn: Boolean(token && user),
      user,
    });

    setUnauthorizedHandler(() => {
      // Only show the alert if we *thought* we were signed in. Avoids
      // a spurious popup during initial sign-in attempts where 401 is
      // expected (e.g. wrong OTP).
      const wasSignedIn = get().signedIn;
      void get().signOut();
      if (wasSignedIn) {
        const lang = useVoiceLanguageStore.getState().lang;
        Alert.alert(
          tFor(lang, 'common.sessionExpiredTitle', 'Session expired'),
          tFor(
            lang,
            'common.sessionExpiredBody',
            'Please sign in again to continue.',
          ),
        );
      }
    });

    // Best-effort refresh in the background; ignore failures.
    if (token && user) {
      authApi
        .getProfile()
        .then((fresh) => {
          set({ user: fresh });
          void secureStorage.setUserJson(JSON.stringify(fresh));
        })
        .catch(() => {
          // network down or token expired — onUnauthorized will sign out
        });
    }
  },

  setPendingEmail(email) {
    set({ pendingEmail: email });
  },

  async completeSignIn(token, user) {
    await secureStorage.setAccessToken(token);
    await secureStorage.setUserJson(JSON.stringify(user));
    set({ signedIn: true, user, pendingEmail: null });
  },

  async setUser(user) {
    // Used after a profile PATCH so we don't pay for a second GET round-trip.
    set({ user });
    await secureStorage.setUserJson(JSON.stringify(user));
  },

  async refreshProfile() {
    try {
      const fresh = await authApi.getProfile();
      set({ user: fresh });
      await secureStorage.setUserJson(JSON.stringify(fresh));
    } catch {
      // ignore — handled by 401 path elsewhere
    }
  },

  async signOut() {
    await secureStorage.clearAll();
    set({ signedIn: false, user: null, pendingEmail: null });
  },
}));
