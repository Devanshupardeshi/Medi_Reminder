import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { VoiceLang } from '@/services/voiceService';

const KEY = 'voiceLang.v1';

interface VoiceLanguageState {
  lang: VoiceLang;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setLang: (lang: VoiceLang) => Promise<void>;
}

/**
 * Global, persisted preference for the in-app voice language.
 *
 * Used by:
 *   - AppHeader's language icon (tapping opens a picker that writes here)
 *   - voiceService.speak() default language for reminders
 *   - reminder/[doseLogId] auto-play language
 *
 * Persisted in SecureStore under `voiceLang.v1`. Defaults to `en` until
 * the user picks Hindi/Marathi — we deliberately don't auto-detect the
 * device locale, because Indian users on Hindi/Marathi system languages
 * often still prefer English voice prompts and we'd rather respect the
 * explicit choice than guess wrong.
 */
export const useVoiceLanguageStore = create<VoiceLanguageState>((set) => ({
  lang: 'en',
  hydrated: false,
  async hydrate() {
    try {
      const stored = await SecureStore.getItemAsync(KEY);
      if (stored === 'en' || stored === 'hi' || stored === 'mr') {
        set({ lang: stored, hydrated: true });
        return;
      }
    } catch {
      // Ignore — fall through to default.
    }
    set({ hydrated: true });
  },
  async setLang(lang) {
    set({ lang });
    try {
      await SecureStore.setItemAsync(KEY, lang);
    } catch {
      // Best-effort; the in-memory value is already updated.
    }
  },
}));
