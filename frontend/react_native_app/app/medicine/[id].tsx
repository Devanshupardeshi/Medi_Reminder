import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  Stack,
  useLocalSearchParams,
  useRouter,
  useFocusEffect,
} from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Badge, Button, Card, Screen, TText } from '@/ui/Primitives';
import { AppHeader } from '@/ui/AppHeader';
import { AdvisoryCards } from '@/ui/AdvisoryCards';
import { colors, radius, spacing } from '@/theme/colors';
import { useMedicinesStore } from '@/state/medicinesStore';
import { useAiInsightsStore } from '@/state/aiInsightsStore';
import {
  speak,
  stopSpeaking,
  buildReminderLine,
  type VoiceLang,
} from '@/services/voiceService';
import { formatTimeIST } from '@/utils/datetime';
import type { DoseLogItem, DoseStatus } from '@/types/medicine';

// IST-pinned formatter — see src/utils/datetime.ts for why we don't
// rely on Hermes' partial Intl polyfill.
const formatTime = formatTimeIST;

function statusTone(s: DoseStatus): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (s) {
    case 'taken':
      return 'success';
    case 'skipped':
      return 'warning';
    case 'missed':
      return 'danger';
    default:
      return 'neutral';
  }
}

export default function MedicineDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = String(params.id ?? '');

  const todayDoses = useMedicinesStore((s) => s.todayDoses);
  const loading = useMedicinesStore((s) => s.loading);
  const refreshing = useMedicinesStore((s) => s.refreshing);
  const loadToday = useMedicinesStore((s) => s.loadToday);
  const setStatus = useMedicinesStore((s) => s.setStatus);

  const insights = useAiInsightsStore((s) => s.byMedicine[id]);
  const insightsLang = (insights?.language ?? 'en') as VoiceLang;
  const [voiceLang, setVoiceLang] = React.useState<VoiceLang>(
    insightsLang === 'mr' || insightsLang === 'hi' ? insightsLang : 'en',
  );

  React.useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadToday({ silent: todayDoses.length > 0 });
    }, [loadToday, todayDoses.length]),
  );

  const dosesForMed = useMemo(
    () =>
      todayDoses
        .filter((d) => d.medicine_id === id)
        .sort(
          (a, b) =>
            new Date(a.scheduled_for).getTime() -
            new Date(b.scheduled_for).getTime(),
        ),
    [todayDoses, id],
  );

  const medicineName = dosesForMed[0]?.medicine_name ?? 'Medicine';
  const stats = useMemo(() => {
    const t = dosesForMed.length;
    const taken = dosesForMed.filter((d) => d.status === 'taken').length;
    const pending = dosesForMed.filter((d) => d.status === 'pending').length;
    return { total: t, taken, pending };
  }, [dosesForMed]);

  function playReminderPreview() {
    const line = buildReminderLine(medicineName, null, voiceLang);
    void speak(line, voiceLang);
  }

  async function applyStatus(doseLogId: string, next: DoseStatus) {
    const res = await setStatus(doseLogId, next);
    if (!res.ok) {
      Alert.alert(
        'Could not update',
        res.message ?? 'Please check your connection and try again.',
      );
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <AppHeader
        title={medicineName}
        subtitle="Medicine Detail"
        showBack
        onPressBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadToday({ silent: true })}
            tintColor={colors.brand.green}
            colors={[colors.brand.green]}
          />
        }
      >
        {loading && dosesForMed.length === 0 ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={colors.brand.green} size="large" />
          </View>
        ) : dosesForMed.length === 0 ? (
          <Card style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
            <Ionicons
              name="information-circle-outline"
              size={36}
              color={colors.text.muted}
            />
            <TText
              variant="bodyBold"
              style={{ marginTop: spacing.sm, textAlign: 'center' }}
            >
              No doses scheduled today
            </TText>
            <TText
              variant="caption"
              color={colors.text.secondary}
              style={{ textAlign: 'center', marginTop: 4 }}
            >
              This medicine has no doses on today&apos;s plan.
            </TText>
          </Card>
        ) : (
          <>
            <Card>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                }}
              >
                <View style={styles.pillIcon}>
                  <MaterialCommunityIcons
                    name="pill"
                    size={28}
                    color={colors.brand.navy}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TText variant="h2" numberOfLines={2}>
                    {medicineName}
                  </TText>
                  <TText
                    variant="caption"
                    color={colors.text.secondary}
                    style={{ marginTop: 2 }}
                  >
                    {stats.taken} of {stats.total} taken today
                    {stats.pending > 0
                      ? ` · ${stats.pending} pending`
                      : ' · all done'}
                  </TText>
                </View>
              </View>
            </Card>

            <View style={styles.sectionHeader}>
              <TText variant="eyebrow" color={colors.text.secondary}>
                Today&apos;s Schedule
              </TText>
            </View>

            {dosesForMed.map((d) => (
              <DoseDetailRow
                key={d.dose_log_id}
                dose={d}
                onTaken={() => applyStatus(d.dose_log_id, 'taken')}
                onSkip={() => applyStatus(d.dose_log_id, 'skipped')}
                onUndo={
                  d.status !== 'pending'
                    ? () => applyStatus(d.dose_log_id, 'taken')
                    : undefined
                }
              />
            ))}

            <View style={styles.sectionHeader}>
              <TText variant="eyebrow" color={colors.text.secondary}>
                Voice reminder
              </TText>
            </View>
            <Card>
              <View style={styles.voiceRow}>
                <View style={styles.voiceIconWrap}>
                  <Ionicons
                    name="volume-high"
                    size={22}
                    color={colors.text.inverse}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TText variant="bodyBold">Play reminder voice</TText>
                  <TText variant="caption" color={colors.text.secondary}>
                    Preview how this medicine sounds in your chosen language.
                  </TText>
                </View>
              </View>
              <View style={styles.langRow}>
                {(['en', 'hi', 'mr'] as VoiceLang[]).map((l) => (
                  <Pressable
                    key={l}
                    onPress={() => setVoiceLang(l)}
                    style={[
                      styles.langPill,
                      voiceLang === l && styles.langPillActive,
                    ]}
                  >
                    <TText
                      variant="caption"
                      color={
                        voiceLang === l
                          ? colors.text.inverse
                          : colors.text.secondary
                      }
                    >
                      {l === 'en'
                        ? 'English'
                        : l === 'hi'
                          ? 'हिन्दी'
                          : 'मराठी'}
                    </TText>
                  </Pressable>
                ))}
              </View>
              <Button
                title="Play preview"
                onPress={playReminderPreview}
                fullWidth
                style={{ marginTop: spacing.md }}
              />
            </Card>

            <AdvisoryCards
              literacy={insights?.literacy}
              food={insights?.food}
            />
          </>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </Screen>
  );
}

function DoseDetailRow({
  dose,
  onTaken,
  onSkip,
  onUndo,
}: {
  dose: DoseLogItem;
  onTaken: () => void;
  onSkip: () => void;
  onUndo?: () => void;
}) {
  const isPending = dose.status === 'pending';
  return (
    <View style={styles.detailRow}>
      <View style={{ flex: 1 }}>
        <TText variant="bodyBold">{formatTime(dose.scheduled_for)}</TText>
        <View style={{ marginTop: 4 }}>
          <Badge
            label={
              dose.status === 'taken'
                ? `Taken${dose.taken_at ? ` ${formatTime(dose.taken_at)}` : ''}`
                : dose.status === 'skipped'
                  ? 'Skipped'
                  : dose.status === 'missed'
                    ? 'Missed'
                    : 'Pending'
            }
            tone={statusTone(dose.status)}
          />
        </View>
      </View>

      {isPending ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button title="Taken" onPress={onTaken} />
          <Button title="Skip" variant="ghost" onPress={onSkip} />
        </View>
      ) : onUndo ? (
        <Pressable
          onPress={onUndo}
          hitSlop={6}
          style={({ pressed }) => ({
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <TText variant="bodyBold" color={colors.brand.navy}>
            Mark taken
          </TText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg },
  loadingBlock: { paddingVertical: spacing.xxl, alignItems: 'center' },
  pillIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface.cardLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.card,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  voiceIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand.navy,
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
    borderColor: colors.surface.border,
    alignItems: 'center',
  },
  langPillActive: {
    backgroundColor: colors.brand.navy,
    borderColor: colors.brand.navy,
  },
});
