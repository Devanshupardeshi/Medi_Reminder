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
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Badge, Button, Card, TText } from '@/ui/Primitives';
import { AppHeader } from '@/ui/AppHeader';
import { colors, radius, spacing } from '@/theme/colors';
import { useAuthStore } from '@/state/authStore';
import { useMedicinesStore } from '@/state/medicinesStore';
import { formatTimeIST } from '@/utils/datetime';
import type { DoseLogItem, DoseStatus } from '@/types/medicine';

function getDisplayName(
  first: string | undefined,
  last: string | undefined,
  email: string,
): string {
  const f = (first ?? '').trim();
  const l = (last ?? '').trim();
  if (f || l) return `${f} ${l}`.trim();
  return email.split('@')[0];
}

// Always render IST — we never display device-local times for an
// India-first product. See src/utils/datetime.ts for the rationale.
const formatTimeLocal = formatTimeIST;

function relativeFromNow(iso: string): string {
  const target = new Date(iso).getTime();
  const diffMin = Math.round((target - Date.now()) / 60_000);
  if (diffMin < -60) {
    const h = Math.round(-diffMin / 60);
    return `${h}h ago`;
  }
  if (diffMin < 0) return `${-diffMin} min ago`;
  if (diffMin < 60) return `In ${diffMin} min`;
  const h = Math.round(diffMin / 60);
  return `In ${h}h`;
}

function statusBadge(s: DoseStatus): {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
} {
  switch (s) {
    case 'taken':
      return { label: 'Taken', tone: 'success' };
    case 'missed':
      return { label: 'Missed', tone: 'danger' };
    case 'skipped':
      return { label: 'Skipped', tone: 'warning' };
    default:
      return { label: 'Pending', tone: 'neutral' };
  }
}

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const todayDoses = useMedicinesStore((s) => s.todayDoses);
  const loading = useMedicinesStore((s) => s.loading);
  const refreshing = useMedicinesStore((s) => s.refreshing);
  const error = useMedicinesStore((s) => s.error);
  const loadToday = useMedicinesStore((s) => s.loadToday);
  const setStatus = useMedicinesStore((s) => s.setStatus);

  // Refresh whenever home gains focus (covers post-confirm and tab switches).
  useFocusEffect(
    useCallback(() => {
      void loadToday({ silent: todayDoses.length > 0 });
    }, [loadToday, todayDoses.length]),
  );

  const displayName = user
    ? getDisplayName(user.first_name, user.last_name, user.email)
    : 'Welcome';

  const stats = useMemo(() => {
    const total = todayDoses.length;
    const taken = todayDoses.filter((d) => d.status === 'taken').length;
    const missed = todayDoses.filter((d) => d.status === 'missed').length;
    const skipped = todayDoses.filter((d) => d.status === 'skipped').length;
    const pending = todayDoses.filter((d) => d.status === 'pending').length;
    const pct = total === 0 ? 0 : Math.round((taken / total) * 100);
    return { total, taken, missed, skipped, pending, pct };
  }, [todayDoses]);

  const nextDose = useMemo(() => {
    const pendings = todayDoses
      .filter((d) => d.status === 'pending')
      .sort(
        (a, b) =>
          new Date(a.scheduled_for).getTime() -
          new Date(b.scheduled_for).getTime(),
      );
    return pendings[0] ?? null;
  }, [todayDoses]);

  const sortedDoses = useMemo(
    () =>
      todayDoses
        .slice()
        .sort(
          (a, b) =>
            new Date(a.scheduled_for).getTime() -
            new Date(b.scheduled_for).getTime(),
        ),
    [todayDoses],
  );

  async function applyStatus(doseLogId: string, status: DoseStatus) {
    const res = await setStatus(doseLogId, status);
    if (!res.ok) {
      Alert.alert(
        'Could not update',
        res.message ?? 'Please check your connection and try again.',
      );
    }
  }

  const isEmpty = !loading && todayDoses.length === 0;

  return (
    <View style={styles.screen}>
      <AppHeader
        title="MediReminder India"
        subtitle={`Namaste, ${displayName}`}
        onPressProfile={() => router.push('/(tabs)/settings')}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadToday({ silent: true })}
            tintColor={colors.brand.green}
            colors={[colors.brand.green]}
          />
        }
      >
        {loading && todayDoses.length === 0 ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={colors.brand.green} size="large" />
            <TText variant="caption" color={colors.text.secondary}>
              Loading today&apos;s schedule…
            </TText>
          </View>
        ) : null}

        {error ? (
          <Card
            style={{
              borderColor: colors.accent.danger,
              backgroundColor: colors.accent.dangerSoft,
              marginTop: spacing.lg,
            }}
          >
            <TText variant="bodyBold" color={colors.accent.danger}>
              Couldn&apos;t load today
            </TText>
            <TText variant="caption" color={colors.accent.danger}>
              {error}
            </TText>
          </Card>
        ) : null}

        {isEmpty ? (
          <EmptyHome onScan={() => router.push('/scan')} />
        ) : (
          <>
            <ProgressCard
              taken={stats.taken}
              total={stats.total}
              pct={stats.pct}
              missed={stats.missed}
              skipped={stats.skipped}
              pending={stats.pending}
            />

            {nextDose ? (
              <NextDoseCard
                dose={nextDose}
                onTaken={() => applyStatus(nextDose.dose_log_id, 'taken')}
                onSkip={() => applyStatus(nextDose.dose_log_id, 'skipped')}
                onOpenReminder={() =>
                  router.push(`/reminder/${nextDose.dose_log_id}`)
                }
              />
            ) : (
              <Card style={{ marginTop: spacing.md, alignItems: 'center' }}>
                <Ionicons
                  name="checkmark-done"
                  size={32}
                  color={colors.brand.green}
                />
                <TText
                  variant="bodyBold"
                  style={{ marginTop: spacing.sm }}
                >
                  All done for today
                </TText>
                <TText variant="caption" color={colors.text.secondary}>
                  No pending doses remaining.
                </TText>
              </Card>
            )}

            <View style={styles.cardHeader}>
              <TText variant="eyebrow" color={colors.text.secondary}>
                Today&apos;s Medicines
              </TText>
              <TText variant="caption" color={colors.text.muted}>
                {stats.total} total
              </TText>
            </View>

            {sortedDoses.map((d) => (
              <DoseRow
                key={d.dose_log_id}
                dose={d}
                onTaken={() => applyStatus(d.dose_log_id, 'taken')}
                onSkip={() => applyStatus(d.dose_log_id, 'skipped')}
              />
            ))}
          </>
        )}

        <View style={{ height: 96 }} />
      </ScrollView>

      {/* Floating "Scan Prescription" FAB matches the mockup */}
      <Pressable
        accessibilityLabel="Scan prescription"
        onPress={() => router.push('/scan')}
        style={({ pressed }) => [
          styles.fab,
          { opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <MaterialCommunityIcons
          name="line-scan"
          size={20}
          color={colors.text.inverse}
        />
        <TText variant="bodyBold" color={colors.text.inverse}>
          Scan Prescription
        </TText>
        <View style={styles.fabPlus}>
          <Ionicons name="add" size={18} color={colors.brand.greenDark} />
        </View>
      </Pressable>
    </View>
  );
}

/* ---------- Empty state ---------- */

function EmptyHome({ onScan }: { onScan: () => void }) {
  return (
    <Card style={styles.gettingStarted}>
      <TText variant="eyebrow" color={colors.text.secondary}>
        Getting Started
      </TText>
      <View style={styles.illustrationWrap}>
        <MaterialCommunityIcons
          name="prescription"
          size={88}
          color={colors.brand.navy}
        />
      </View>
      <TText
        variant="h2"
        style={{ textAlign: 'center', marginTop: spacing.md }}
      >
        Welcome to your health journey
      </TText>
      <TText
        variant="body"
        color={colors.text.secondary}
        style={{ textAlign: 'center', marginTop: spacing.sm }}
      >
        Scan your first prescription to add your medicines and start getting
        bilingual reminders.
      </TText>
      <Button
        title="Add your first medicine"
        size="lg"
        fullWidth
        onPress={onScan}
        style={{ marginTop: spacing.lg }}
      />
    </Card>
  );
}

/* ---------- Progress card ---------- */

interface ProgressCardProps {
  taken: number;
  total: number;
  pct: number;
  missed: number;
  skipped: number;
  pending: number;
}

function ProgressCard({
  taken,
  total,
  pct,
  missed,
  skipped,
  pending,
}: ProgressCardProps) {
  return (
    <Card style={{ marginTop: spacing.lg }}>
      <View style={styles.cardHeader}>
        <TText variant="eyebrow" color={colors.text.secondary}>
          Today&apos;s Adherence
        </TText>
        <TText variant="caption" color={colors.text.muted}>
          {taken} of {total} taken
        </TText>
      </View>

      <View style={{ marginTop: spacing.md }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: 6,
          }}
        >
          <TText variant="h1" color={colors.brand.greenDark}>
            {pct}
          </TText>
          <TText variant="bodyBold" color={colors.text.secondary}>
            % done
          </TText>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>
      </View>

      <View style={styles.statsRow}>
        <Stat label="Pending" value={pending} tone="neutral" />
        <Stat label="Missed" value={missed} tone="danger" />
        <Stat label="Skipped" value={skipped} tone="warning" />
      </View>
    </Card>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'danger' | 'warning';
}) {
  const fg =
    tone === 'danger'
      ? colors.accent.danger
      : tone === 'warning'
        ? colors.accent.warning
        : colors.text.secondary;
  return (
    <View style={styles.statBox}>
      <TText variant="h3" color={fg}>
        {value}
      </TText>
      <TText variant="caption" color={colors.text.secondary}>
        {label}
      </TText>
    </View>
  );
}

/* ---------- Next dose card ---------- */

function NextDoseCard({
  dose,
  onTaken,
  onSkip,
  onOpenReminder,
}: {
  dose: DoseLogItem;
  onTaken: () => void;
  onSkip: () => void;
  onOpenReminder: () => void;
}) {
  return (
    <Card style={styles.nextDoseCard}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <TText variant="eyebrow" color={colors.text.inverse}>
          Next dose
        </TText>
        <TText variant="caption" color={colors.text.inverse}>
          {formatTimeLocal(dose.scheduled_for)} ·{' '}
          {relativeFromNow(dose.scheduled_for)}
        </TText>
      </View>
      <TText
        variant="h2"
        color={colors.text.inverse}
        style={{ marginTop: spacing.sm }}
      >
        {dose.medicine_name}
      </TText>
      <Pressable
        onPress={onOpenReminder}
        hitSlop={6}
        style={({ pressed }) => [
          {
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginTop: spacing.xs,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Ionicons
          name="volume-high"
          size={14}
          color={colors.text.inverse}
        />
        <TText variant="caption" color={colors.text.inverse}>
          Open voice reminder
        </TText>
      </Pressable>

      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
        <Button
          title="Taken"
          variant="success"
          fullWidth
          onPress={onTaken}
          style={{ flex: 1 }}
          icon={
            <Ionicons
              name="checkmark"
              size={18}
              color={colors.text.inverse}
            />
          }
        />
        <Button
          title="Skip"
          variant="ghost"
          fullWidth
          onPress={onSkip}
          style={{
            flex: 1,
            backgroundColor: 'rgba(255,255,255,0.12)',
            borderColor: 'rgba(255,255,255,0.4)',
          }}
        />
      </View>
    </Card>
  );
}

/* ---------- Dose row ---------- */

function DoseRow({
  dose,
  onTaken,
  onSkip,
}: {
  dose: DoseLogItem;
  onTaken: () => void;
  onSkip: () => void;
}) {
  const router = useRouter();
  const badge = statusBadge(dose.status);
  const isPending = dose.status === 'pending';

  return (
    <Pressable
      onPress={() => router.push(`/medicine/${dose.medicine_id}`)}
      onLongPress={() =>
        router.push(`/reminder/${dose.dose_log_id}`)
      }
      delayLongPress={350}
      style={({ pressed }) => [
        styles.doseRow,
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={styles.doseTimeCol}>
        <TText variant="bodyBold">{formatTimeLocal(dose.scheduled_for)}</TText>
        <Badge label={badge.label} tone={badge.tone} />
      </View>
      <View style={{ flex: 1 }}>
        <TText variant="bodyBold" numberOfLines={1}>
          {dose.medicine_name}
        </TText>
        {dose.taken_at ? (
          <TText variant="caption" color={colors.text.secondary}>
            Logged at {formatTimeLocal(dose.taken_at)}
          </TText>
        ) : (
          <TText variant="caption" color={colors.text.muted}>
            {relativeFromNow(dose.scheduled_for)}
          </TText>
        )}
      </View>
      {isPending ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Pressable
            accessibilityLabel="Mark taken"
            onPress={(e) => {
              e.stopPropagation();
              onTaken();
            }}
            style={[styles.iconAction, { backgroundColor: colors.brand.green }]}
            hitSlop={6}
          >
            <Ionicons
              name="checkmark"
              size={18}
              color={colors.text.inverse}
            />
          </Pressable>
          <Pressable
            accessibilityLabel="Skip"
            onPress={(e) => {
              e.stopPropagation();
              onSkip();
            }}
            style={[
              styles.iconAction,
              {
                backgroundColor: colors.surface.cardLight,
                borderWidth: 1,
                borderColor: colors.surface.border,
              },
            ]}
            hitSlop={6}
          >
            <Ionicons
              name="close"
              size={18}
              color={colors.text.secondary}
            />
          </Pressable>
        </View>
      ) : (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={colors.text.muted}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface.background },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 24,
  },
  loadingBlock: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  gettingStarted: {
    marginTop: spacing.lg,
    alignItems: 'stretch',
    gap: spacing.md,
  },
  illustrationWrap: {
    alignSelf: 'center',
    width: 160,
    height: 160,
    borderRadius: radius.xl,
    backgroundColor: colors.surface.cardLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },

  progressTrack: {
    height: 10,
    backgroundColor: colors.surface.cardLight,
    borderRadius: radius.pill,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.brand.green,
    borderRadius: radius.pill,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  statBox: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface.cardLight,
    borderRadius: radius.md,
    alignItems: 'center',
  },

  nextDoseCard: {
    marginTop: spacing.md,
    backgroundColor: colors.brand.navy,
    borderColor: colors.brand.navyDark,
  },

  doseRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface.card,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  doseTimeCol: {
    minWidth: 78,
    gap: 4,
  },
  iconAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  fab: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    backgroundColor: colors.brand.green,
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    shadowColor: '#0F172A',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fabPlus: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
