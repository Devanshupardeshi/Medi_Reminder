import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
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
import { useMedicinesStore } from '@/state/medicinesStore';
import { formatTimeIST } from '@/utils/datetime';
import type { DoseLogItem } from '@/types/medicine';

interface MedicineSummary {
  medicine_id: string;
  name: string;
  total: number;
  taken: number;
  pending: number;
  nextDose: DoseLogItem | null;
}

function summariseMedicines(doses: DoseLogItem[]): MedicineSummary[] {
  const map = new Map<string, MedicineSummary>();
  for (const d of doses) {
    const cur =
      map.get(d.medicine_id) ?? {
        medicine_id: d.medicine_id,
        name: d.medicine_name,
        total: 0,
        taken: 0,
        pending: 0,
        nextDose: null,
      };
    cur.total += 1;
    if (d.status === 'taken') cur.taken += 1;
    if (d.status === 'pending') {
      cur.pending += 1;
      const nextTime = cur.nextDose
        ? new Date(cur.nextDose.scheduled_for).getTime()
        : Number.POSITIVE_INFINITY;
      if (new Date(d.scheduled_for).getTime() < nextTime) {
        cur.nextDose = d;
      }
    }
    map.set(d.medicine_id, cur);
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export default function MedicinesScreen() {
  const router = useRouter();
  const todayDoses = useMedicinesStore((s) => s.todayDoses);
  const loading = useMedicinesStore((s) => s.loading);
  const refreshing = useMedicinesStore((s) => s.refreshing);
  const loadToday = useMedicinesStore((s) => s.loadToday);

  useFocusEffect(
    useCallback(() => {
      void loadToday({ silent: todayDoses.length > 0 });
    }, [loadToday, todayDoses.length]),
  );

  const items = useMemo(() => summariseMedicines(todayDoses), [todayDoses]);

  return (
    <View style={styles.screen}>
      <AppHeader title="MediReminder India" subtitle="My Medicines" />
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
        {loading && items.length === 0 ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={colors.brand.green} size="large" />
          </View>
        ) : items.length === 0 ? (
          <Card style={styles.empty}>
            <View style={styles.illoWrap}>
              <MaterialCommunityIcons
                name="pill"
                size={56}
                color={colors.brand.navy}
              />
            </View>
            <TText
              variant="h2"
              style={{ marginTop: spacing.md, textAlign: 'center' }}
            >
              No medicines yet
            </TText>
            <TText
              variant="body"
              color={colors.text.secondary}
              style={{ textAlign: 'center', marginTop: spacing.sm }}
            >
              Scan a prescription to add medicines and start receiving daily
              reminders.
            </TText>
            <Button
              title="Scan prescription"
              size="lg"
              fullWidth
              onPress={() => router.push('/scan')}
              style={{ marginTop: spacing.lg }}
            />
          </Card>
        ) : (
          <>
            <TText
              variant="caption"
              color={colors.text.secondary}
              style={{ marginBottom: spacing.sm }}
            >
              {items.length} medicine{items.length === 1 ? '' : 's'} on
              today&apos;s schedule. Tap one to see its doses.
            </TText>
            {items.map((m) => (
              <MedicineRow
                key={m.medicine_id}
                summary={m}
                onPress={() => router.push(`/medicine/${m.medicine_id}`)}
              />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function MedicineRow({
  summary,
  onPress,
}: {
  summary: MedicineSummary;
  onPress: () => void;
}) {
  const allDone = summary.pending === 0 && summary.total > 0;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={styles.pillIcon}>
        <MaterialCommunityIcons
          name="pill"
          size={22}
          color={colors.brand.navy}
        />
      </View>
      <View style={{ flex: 1 }}>
        <TText variant="bodyBold" numberOfLines={1}>
          {summary.name}
        </TText>
        <TText variant="caption" color={colors.text.secondary}>
          {summary.taken} of {summary.total} taken today
          {summary.nextDose
            ? ` · next ${formatTimeIST(summary.nextDose.scheduled_for)}`
            : ''}
        </TText>
      </View>
      {allDone ? (
        <Badge label="Done" tone="success" />
      ) : (
        <Badge
          label={`${summary.pending} pending`}
          tone={summary.pending > 0 ? 'info' : 'neutral'}
        />
      )}
      <Ionicons
        name="chevron-forward"
        size={18}
        color={colors.text.muted}
        style={{ marginLeft: spacing.sm }}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface.background },
  content: { padding: spacing.lg },
  loadingBlock: { paddingVertical: spacing.xxl, alignItems: 'center' },
  empty: { alignItems: 'stretch' },
  illoWrap: {
    alignSelf: 'center',
    width: 120,
    height: 120,
    borderRadius: radius.xl,
    backgroundColor: colors.surface.cardLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface.card,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  pillIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface.cardLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
