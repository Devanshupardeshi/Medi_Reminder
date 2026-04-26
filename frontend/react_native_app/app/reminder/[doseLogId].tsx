import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Vibration,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Card, TText } from '@/ui/Primitives';
import { colors, radius, spacing } from '@/theme/colors';
import { useMedicinesStore } from '@/state/medicinesStore';
import { useAiInsightsStore } from '@/state/aiInsightsStore';
import { useVoiceLanguageStore } from '@/state/voiceLanguageStore';
import {
  speak,
  stopSpeaking,
  buildReminderLine,
  type VoiceLang,
} from '@/services/voiceService';
import { startAlarm, stopAlarm } from '@/services/alarmSound';
import { notificationService } from '@/services/notificationService';
import type { DoseStatus } from '@/types/medicine';

const SNOOZE_MIN = 10;

function formatClock(iso: string): { time: string; ampm: string } {
  const d = new Date(iso);
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return {
    time: `${displayHours}:${minutes.toString().padStart(2, '0')}`,
    ampm,
  };
}

export default function ReminderActionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    doseLogId: string;
    testMedicine?: string;
  }>();
  const doseLogId = String(params.doseLogId ?? '');
  const isTest = doseLogId === 'test';

  const todayDoses = useMedicinesStore((s) => s.todayDoses);
  const setStatus = useMedicinesStore((s) => s.setStatus);
  const insightsByMed = useAiInsightsStore((s) => s.byMedicine);

  // For the diagnostic test alarm we synthesise a fake dose record so
  // the screen renders and rings exactly like a real reminder, without
  // needing a backend dose log.
  const dose = useMemo(() => {
    if (isTest) {
      const name =
        typeof params.testMedicine === 'string'
          ? params.testMedicine
          : 'Test medicine';
      return {
        dose_log_id: 'test',
        medicine_id: 'test',
        medicine_name: name,
        scheduled_for: new Date().toISOString(),
        status: 'pending' as DoseStatus,
      };
    }
    return todayDoses.find((d) => d.dose_log_id === doseLogId);
  }, [todayDoses, doseLogId, isTest, params.testMedicine]);

  const insights = dose ? insightsByMed[dose.medicine_id] : undefined;
  // Prefer the user's globally-chosen voice language; fall back to the
  // medicine's own insight language if the user hasn't picked one yet.
  const globalLang = useVoiceLanguageStore((s) => s.lang);
  const setGlobalLang = useVoiceLanguageStore((s) => s.setLang);
  const insightLang: VoiceLang =
    insights?.language === 'hi' || insights?.language === 'mr'
      ? insights.language
      : 'en';
  const [voiceLang, setVoiceLang] = useState<VoiceLang>(
    globalLang ?? insightLang,
  );

  // Keep the local pill in sync if the user picks a language elsewhere
  // (e.g. via the app header) while this screen is mounted.
  useEffect(() => {
    setVoiceLang(globalLang);
  }, [globalLang]);
  const [busy, setBusy] = useState<DoseStatus | 'snooze' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Continuous "alarm clock" ringing.
  //
  // The Android notification sound only plays once for ~2 s on the
  // notification stream and is silenced by the device's ringer profile.
  // Real alarm apps loop a real audio file at full volume — that's what
  // we do here. While the reminder screen is mounted we run THREE
  // concurrent loops, all stopped the moment the user taps Taken /
  // Snooze / Skip:
  //   1. `alarm.wav` (a two-tone beep, bundled in /assets/sounds) is
  //      played on infinite loop via expo-av at volume 1.0 with
  //      `playsInSilentModeIOS` and `DoNotMix` interruption mode so it
  //      survives the iOS ringer switch and Android Do Not Disturb.
  //   2. Heavy vibration pattern repeats forever via RN's Vibration
  //      API — the haptic complement to the audio.
  //   3. The localized TTS reminder line ("Time to take Amotil…") is
  //      spoken every 7 s so the user hears WHAT to take in their
  //      preferred language.
  const ringRef = useRef<{ ttsTimer: ReturnType<typeof setInterval> | null }>({
    ttsTimer: null,
  });
  useEffect(() => {
    if (!dose) return;

    // Real alarm tone first — this is the loud, looping sound.
    void startAlarm();

    const line = buildReminderLine(dose.medicine_name, null, voiceLang);
    // Speak immediately, then every 7 s. TTS rides on top of the alarm.
    void speak(line, voiceLang);
    ringRef.current.ttsTimer = setInterval(() => {
      void speak(line, voiceLang);
    }, 7000);

    // Heavy looping vibration pattern.
    Vibration.vibrate([0, 700, 500, 700, 500, 700], true);

    return () => {
      if (ringRef.current.ttsTimer) {
        clearInterval(ringRef.current.ttsTimer);
        ringRef.current.ttsTimer = null;
      }
      Vibration.cancel();
      stopSpeaking();
      void stopAlarm();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dose?.dose_log_id, voiceLang]);

  if (!dose) {
    return (
      <View style={[styles.fill, styles.center]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={colors.brand.green} size="large" />
        <TText
          variant="caption"
          color={colors.text.muted}
          style={{ marginTop: spacing.md }}
        >
          Loading dose…
        </TText>
        <Button
          title="Close"
          variant="ghost"
          onPress={() => router.back()}
          style={{ marginTop: spacing.lg }}
        />
      </View>
    );
  }

  const clock = formatClock(dose.scheduled_for);

  function replay() {
    if (!dose) return;
    const line = buildReminderLine(dose.medicine_name, null, voiceLang);
    void speak(line, voiceLang);
  }

  async function handle(status: DoseStatus | 'snooze') {
    if (!dose || busy) return;
    setBusy(status);
    setErrorMsg(null);
    // Silence everything the moment the user taps an action.
    stopSpeaking();
    Vibration.cancel();
    void stopAlarm();
    if (ringRef.current.ttsTimer) {
      clearInterval(ringRef.current.ttsTimer);
      ringRef.current.ttsTimer = null;
    }

    // Diagnostic alarm — no backend, just close.
    if (isTest) {
      router.back();
      return;
    }

    if (status === 'snooze') {
      try {
        await notificationService.snoozeDose({
          medicineId: dose.medicine_id,
          medicineName: dose.medicine_name,
          minutes: SNOOZE_MIN,
        });
        router.back();
      } catch (e) {
        setErrorMsg(
          e instanceof Error ? e.message : 'Could not schedule snooze.',
        );
        setBusy(null);
      }
      return;
    }

    const res = await setStatus(dose.dose_log_id, status);
    if (res.ok) {
      router.back();
    } else {
      setErrorMsg(res.message ?? 'Could not update dose.');
      setBusy(null);
    }
  }

  return (
    <View style={styles.fill}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor={colors.brand.navy} />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={styles.closeBtn}
            accessibilityLabel="Close reminder"
          >
            <Ionicons
              name="close"
              size={22}
              color={colors.text.inverse}
            />
          </Pressable>
          <TText variant="caption" color={colors.text.inverse}>
            TIME FOR MEDICINE
          </TText>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.clockBlock}>
          <TText
            variant="h1"
            color={colors.text.inverse}
            style={styles.clockTime}
          >
            {clock.time}
          </TText>
          <TText
            variant="h2"
            color={colors.text.inverse}
            style={styles.clockAmpm}
          >
            {clock.ampm}
          </TText>
        </View>

        <Card style={styles.medCard}>
          <View style={styles.pillIcon}>
            <MaterialCommunityIcons
              name="pill"
              size={36}
              color={colors.brand.navy}
            />
          </View>
          <TText
            variant="h2"
            style={{ textAlign: 'center', marginTop: spacing.md }}
          >
            {dose.medicine_name}
          </TText>
          <TText
            variant="caption"
            color={colors.text.secondary}
            style={{ textAlign: 'center', marginTop: 4 }}
          >
            Scheduled for {formatClock(dose.scheduled_for).time}{' '}
            {formatClock(dose.scheduled_for).ampm}
          </TText>
        </Card>

        <View style={styles.voiceCard}>
          <View style={styles.voiceHeader}>
            <View style={styles.voiceIconWrap}>
              <Ionicons
                name="volume-high"
                size={20}
                color={colors.text.inverse}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TText variant="bodyBold" color={colors.text.inverse}>
                Voice reminder
              </TText>
              <TText variant="caption" color="rgba(255,255,255,0.7)">
                Tap a language, then play.
              </TText>
            </View>
          </View>
          <View style={styles.langRow}>
            {(['en', 'hi', 'mr'] as VoiceLang[]).map((l) => (
              <Pressable
                key={l}
                onPress={() => {
                  setVoiceLang(l);
                  // Persist the pick globally so the rest of the app
                  // (and the next reminder) inherits it.
                  void setGlobalLang(l);
                }}
                style={[
                  styles.langPill,
                  voiceLang === l && styles.langPillActive,
                ]}
              >
                <TText
                  variant="caption"
                  color={
                    voiceLang === l
                      ? colors.brand.navy
                      : colors.text.inverse
                  }
                >
                  {l === 'en' ? 'English' : l === 'hi' ? 'हिन्दी' : 'मराठी'}
                </TText>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={replay}
            style={({ pressed }) => [
              styles.replayBtn,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Ionicons name="play" size={18} color={colors.brand.navy} />
            <TText variant="bodyBold" color={colors.brand.navy}>
              Play reminder
            </TText>
          </Pressable>
        </View>

        {errorMsg ? (
          <View style={styles.errorPill}>
            <Ionicons
              name="alert-circle"
              size={18}
              color={colors.text.inverse}
            />
            <TText variant="caption" color={colors.text.inverse}>
              {errorMsg}
            </TText>
          </View>
        ) : null}

        <View style={styles.actionsBlock}>
          <Pressable
            onPress={() => handle('taken')}
            disabled={!!busy}
            style={({ pressed }) => [
              styles.actionBtn,
              styles.takenBtn,
              busy && busy !== 'taken' && { opacity: 0.5 },
              pressed && { opacity: 0.85 },
            ]}
          >
            {busy === 'taken' ? (
              <ActivityIndicator color={colors.text.inverse} />
            ) : (
              <Ionicons
                name="checkmark-circle"
                size={26}
                color={colors.text.inverse}
              />
            )}
            <View style={{ flex: 1 }}>
              <TText variant="h3" color={colors.text.inverse}>
                TAKEN
              </TText>
              <TText variant="caption" color="rgba(255,255,255,0.85)">
                Logs the dose now
              </TText>
            </View>
          </Pressable>

          <Pressable
            onPress={() => handle('snooze')}
            disabled={!!busy}
            style={({ pressed }) => [
              styles.actionBtn,
              styles.snoozeBtn,
              busy && busy !== 'snooze' && { opacity: 0.5 },
              pressed && { opacity: 0.85 },
            ]}
          >
            {busy === 'snooze' ? (
              <ActivityIndicator color={colors.text.inverse} />
            ) : (
              <Ionicons
                name="time"
                size={26}
                color={colors.text.inverse}
              />
            )}
            <View style={{ flex: 1 }}>
              <TText variant="h3" color={colors.text.inverse}>
                SNOOZE ({SNOOZE_MIN} MIN)
              </TText>
              <TText variant="caption" color="rgba(255,255,255,0.85)">
                Reminds again shortly
              </TText>
            </View>
          </Pressable>

          <Pressable
            onPress={() => handle('skipped')}
            disabled={!!busy}
            style={({ pressed }) => [
              styles.actionBtn,
              styles.skipBtn,
              busy && busy !== 'skipped' && { opacity: 0.5 },
              pressed && { opacity: 0.85 },
            ]}
          >
            {busy === 'skipped' ? (
              <ActivityIndicator color={colors.text.inverse} />
            ) : (
              <Ionicons
                name="close-circle"
                size={26}
                color={colors.text.inverse}
              />
            )}
            <View style={{ flex: 1 }}>
              <TText variant="h3" color={colors.text.inverse}>
                SKIP
              </TText>
              <TText variant="caption" color="rgba(255,255,255,0.85)">
                Marks this dose as skipped
              </TText>
            </View>
          </Pressable>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.brand.navy },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: {
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  clockBlock: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  clockTime: {
    fontSize: 72,
    lineHeight: 80,
    fontWeight: '800',
    letterSpacing: -2,
  },
  clockAmpm: {
    marginTop: -4,
    opacity: 0.85,
  },
  medCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.lg,
  },
  pillIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surface.cardLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  voiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  voiceIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  langPill: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
  },
  langPillActive: {
    backgroundColor: colors.text.inverse,
    borderColor: colors.text.inverse,
  },
  replayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.text.inverse,
    marginTop: spacing.md,
  },
  errorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent.danger,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  actionsBlock: {
    gap: spacing.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  takenBtn: {
    backgroundColor: colors.brand.green,
  },
  snoozeBtn: {
    backgroundColor: colors.brand.navy,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  skipBtn: {
    backgroundColor: colors.accent.danger,
  },
});
