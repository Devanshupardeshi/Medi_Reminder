import * as Speech from 'expo-speech';

export type VoiceLang = 'en' | 'hi' | 'mr';

const LANG_TAG: Record<VoiceLang, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  mr: 'mr-IN',
};

const LANG_LABEL: Record<VoiceLang, string> = {
  en: 'English',
  hi: 'Hindi',
  mr: 'Marathi',
};

export function languageLabel(lang: VoiceLang): string {
  return LANG_LABEL[lang];
}

// Cache of the best voice identifier we've found for each language.
// We populate this lazily on the first speak() call so the UI doesn't
// have to wait at startup. Keys: lang code; values: voice identifier
// string (e.g. "hi-in-x-hia-network") or null if we already searched
// and found nothing better than the system default.
const bestVoiceCache: Partial<Record<VoiceLang, string | null>> = {};

/**
 * Pick the highest-quality voice the OS has for `lang`.
 *
 * Priority:
 *   1. Voices whose `quality` is "Enhanced" — these are the fully
 *      neural Google / Apple voices and sound far more natural than
 *      the default robotic ones.
 *   2. Voices whose identifier contains "network" — Google TTS network
 *      voices are also high-quality.
 *   3. Voices whose identifier contains "x-" — modern espeak/eSpeak-NG
 *      voices, better than the legacy compact voices.
 *   4. Any voice matching the language tag exactly.
 *   5. Any voice whose language starts with the same primary tag
 *      (e.g. `hi-` for `hi-IN`).
 *
 * Returns the voice identifier or null if no match was found.
 */
async function pickBestVoice(lang: VoiceLang): Promise<string | null> {
  if (lang in bestVoiceCache) return bestVoiceCache[lang] ?? null;

  let voices: Speech.Voice[] = [];
  try {
    voices = await Speech.getAvailableVoicesAsync();
  } catch {
    bestVoiceCache[lang] = null;
    return null;
  }

  const tag = LANG_TAG[lang]; // e.g. "hi-IN"
  const primary = tag.split('-')[0]; // e.g. "hi"

  const exactTag = (v: Speech.Voice) =>
    v.language?.toLowerCase() === tag.toLowerCase();
  const samePrimary = (v: Speech.Voice) =>
    v.language?.toLowerCase().startsWith(`${primary}-`);

  const enhanced = voices.find(
    (v) => exactTag(v) && v.quality === Speech.VoiceQuality.Enhanced,
  );
  if (enhanced) return cacheAndReturn(lang, enhanced.identifier);

  const network = voices.find(
    (v) => exactTag(v) && v.identifier.toLowerCase().includes('network'),
  );
  if (network) return cacheAndReturn(lang, network.identifier);

  const modern = voices.find(
    (v) => exactTag(v) && v.identifier.toLowerCase().includes('x-'),
  );
  if (modern) return cacheAndReturn(lang, modern.identifier);

  const exact = voices.find(exactTag);
  if (exact) return cacheAndReturn(lang, exact.identifier);

  const fallback = voices.find(samePrimary);
  return cacheAndReturn(lang, fallback?.identifier ?? null);
}

function cacheAndReturn(lang: VoiceLang, value: string | null): string | null {
  bestVoiceCache[lang] = value;
  return value;
}

/**
 * Some Android TTS engines clip Devanagari sentences over ~120 chars,
 * cutting the playback off mid-word. We split on punctuation and feed
 * the parts in sequence so each chunk plays cleanly.
 */
function chunkText(text: string): string[] {
  if (text.length <= 120) return [text];
  return text
    .split(/(?<=[\.\?!\u0964])\s+/)
    .filter((s) => s.trim().length > 0);
}

/**
 * Speak `text` in the requested language using the highest-quality
 * voice the device has. If the device lacks a voice for that locale,
 * expo-speech falls back to the system default automatically.
 *
 * Indian voices sound noticeably more natural at a slightly slower
 * rate (~0.88) and a marginally higher pitch — the defaults are tuned
 * for English and feel rushed in Devanagari.
 */
export async function speak(
  text: string,
  lang: VoiceLang = 'en',
): Promise<void> {
  if (!text.trim()) return;
  Speech.stop();

  const voiceId = await pickBestVoice(lang);
  const isIndic = lang === 'hi' || lang === 'mr';

  const options: Speech.SpeechOptions = {
    language: LANG_TAG[lang],
    rate: isIndic ? 0.88 : 0.95,
    pitch: isIndic ? 1.05 : 1.0,
    voice: voiceId ?? undefined,
  };

  const chunks = chunkText(text);
  for (let i = 0; i < chunks.length; i++) {
    const isLast = i === chunks.length - 1;
    Speech.speak(chunks[i], options);
    if (!isLast) {
      // Tiny gap so the engine has room to breathe between chunks.
      // We don't await it — speak() is fire-and-forget and the engine
      // queues the next utterance anyway. Just yield the JS thread.
      await new Promise<void>((res) => setTimeout(res, 50));
    }
  }
}

export function stopSpeaking(): void {
  Speech.stop();
}

export function isSpeaking(): Promise<boolean> {
  return Speech.isSpeakingAsync();
}

/**
 * Build a localized reminder line we can speak when a dose comes due.
 * We deliberately keep it short — older Android TTS engines can clip
 * sentences over ~120 chars in regional locales.
 */
export function buildReminderLine(
  medicineName: string,
  dosagePattern: string | null | undefined,
  lang: VoiceLang,
): string {
  switch (lang) {
    case 'hi':
      return `दवा का समय है। ${medicineName}${
        dosagePattern ? `, ${dosagePattern}` : ''
      }`;
    case 'mr':
      return `औषध घेण्याची वेळ आली आहे. ${medicineName}${
        dosagePattern ? `, ${dosagePattern}` : ''
      }`;
    default:
      return `Time for your medicine: ${medicineName}${
        dosagePattern ? `, ${dosagePattern}` : ''
      }.`;
  }
}
