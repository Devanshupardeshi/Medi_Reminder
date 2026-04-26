import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';

// Module-level handle so we always have at most ONE alarm playing,
// even if the reminder screen mounts twice in quick succession.
let sound: Audio.Sound | null = null;
let starting = false;

/**
 * Configure the audio session so the alarm:
 *   - plays through the media stream at full volume,
 *   - is audible even when the iPhone ringer switch is on silent,
 *   - does not duck other audio (keeps full volume),
 *   - keeps playing if the screen turns off.
 */
async function configureAudioMode(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });
  } catch (e) {
    console.log('[v0] alarm setAudioModeAsync failed', String(e));
  }
}

/**
 * Start the looping alarm tone. Safe to call repeatedly — only one
 * sound instance is kept alive. Resolves once playback has started so
 * the caller can sequence other side-effects (vibration, TTS) after.
 */
export async function startAlarm(): Promise<void> {
  if (sound || starting) return;
  starting = true;
  try {
    await configureAudioMode();
    const { sound: s } = await Audio.Sound.createAsync(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../../assets/sounds/alarm.wav'),
      {
        isLooping: true,
        volume: 1.0,
        shouldPlay: true,
      },
    );
    sound = s;
    console.log('[v0] alarm started');
  } catch (e) {
    console.log('[v0] alarm start failed', String(e));
  } finally {
    starting = false;
  }
}

/** Stop the alarm and release native resources. Idempotent. */
export async function stopAlarm(): Promise<void> {
  const s = sound;
  sound = null;
  if (!s) return;
  try {
    await s.stopAsync();
  } catch {
    // ignore
  }
  try {
    await s.unloadAsync();
  } catch {
    // ignore
  }
  console.log('[v0] alarm stopped');
}
