import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Badge, Card, TText } from '@/ui/Primitives';
import { AppHeader } from '@/ui/AppHeader';
import { colors, radius, spacing } from '@/theme/colors';
import { getDayDoses } from '@/services/doseApi';
import { formatLongDateIST, formatTimeIST } from '@/utils/datetime';
import type { DoseLogItem, DoseStatus } from '@/types/medicine';
import { ApiError } from '@/services/apiClient';

const STATUS_LABEL: Record<DoseStatus, string> = {
  taken: 'Taken',
  missed: 'Missed',
  skipped: 'Skipped',
  pending: 'Pending',
};

const STATUS_TONE: Record<DoseStatus, 'success' | 'danger' | 'warning' | 'neutral'> = {
  taken: 'success',
  missed: 'danger',
  skipped: 'warning',
  pending: 'neutral',
};

const STATUS_ICON: Record<DoseStatus, keyof typeof Ionicons.glyphMap> = {
  taken: 'checkmark-circle',
  missed: 'close-circle',
  skipped: 'remove-circle',
  pending: 'time-outline',
};

const STATUS_ICON_COLOR: Record<DoseStatus, string> = {
  taken: colors.status.taken,
  missed: colors.status.missed,
  skipped: colors.status.partial,
  pending: colors.status.pending,
};

// IST-pinned formatters; toLocale* is unreliable on Hermes.
const fmtTime = formatTimeIST;
const fmtDate = formatLongDateIST;

export default function HistoryDayScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const router = useRouter();

  const [items, setItems] = useState<DoseLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const list = await getDayDoses(date);
        // Sort earliest -> latest by scheduled time
        list.sort((a, b) =>
          a.scheduled_for < b.scheduled_for ? -1 : 1,
        );
        setItems(list);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Could not load doses');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [date],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    let taken = 0;
    let missed = 0;
    let skipped = 0;
    let pending = 0;
    for (const i of items) {
      if (i.status === 'taken') taken += 1;
      else if (i.status === 'missed') missed += 1;
      else if (i.status === 'skipped') skipped += 1;
      else pending += 1;
    }
    const total = items.length;
    const pct = total > 0 ? Math.round((taken / total) * 100) : 0;
    return { total, taken, missed, skipped, pending, pct };
  }, [items]);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <AppHeader
        title={fmtDate(date)}
        subtitle="Daily log"
        showBack
        onPressBack={() => router.back()}
        showLanguage={false}
        showProfile={false}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.brand.green}
            colors={[colors.brand.green]}
          />
        }
      >
        {loading && items.length === 0 ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={colors.brand.green} size="large" />
          </View>
        ) : null}

        {error ? (
          <Card
            style={{
              borderColor: colors.accent.danger,
              backgroundColor: colors.accent.dangerSoft,
            }}
          >
            <TText variant="bodyBold" color={colors.accent.danger}>
              Couldn&apos;t load history
            </TText>
            <TText variant="caption" color={colors.accent.danger}>
              {error}
            </TText>
          </Card>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons
              name="calendar-clear-outline"
              size={48}
              color={colors.brand.navy}
            />
            <TText variant="h2" style={{ marginTop: spacing.md }}>
              No doses on this day
            </TText>
            <TText
              variant="body"
              color={colors.text.secondary}
              style={{ textAlign: 'center', marginTop: spacing.sm }}
            >
              No prescriptions were active for this date.
            </TText>
          </Card>
        ) : null}

        {items.length > 0 ? (
          <Card>
            <TText variant="eyebrow" color={colors.text.secondary}>
              Day summary
            </TText>
            <View style={styles.summaryRow}>
              <TText
                variant="h1"
                color={colors.brand.green}
                style={{ fontSize: 36, lineHeight: 40 }}
              >
                {summary.pct}%
              </TText>
              <View style={{ marginLeft: spacing.lg }}>
                <TText variant="bodyBold">
                  {summary.taken} of {summary.total} taken
                </TText>
                <TText variant="caption" color={colors.text.secondary}>
                  {summary.missed} missed · {summary.skipped} skipped ·{' '}
                  {summary.pending} pending
                </TText>
              </View>
            </View>
          </Card>
        ) : null}

        {items.map((d) => (
          <Card key={d.dose_log_id} style={{ marginTop: spacing.md }}>
            <View style={styles.doseRow}>
              <View
                style={[
                  styles.doseIcon,
                  { backgroundColor: colors.surface.cardLight },
                ]}
              >
                <Ionicons
                  name={STATUS_ICON[d.status]}
                  size={22}
                  color={STATUS_ICON_COLOR[d.status]}
                />
              </View>
              <View style={{ flex: 1 }}>
                <TText variant="bodyBold" numberOfLines={1}>
                  {d.medicine_name}
                </TText>
                <TText
                  variant="caption"
                  color={colors.text.secondary}
                  style={{ marginTop: 2 }}
                >
                  Scheduled {fmtTime(d.scheduled_for)}
                  {d.taken_at ? ` · Taken ${fmtTime(d.taken_at)}` : ''}
                </TText>
              </View>
              <Badge
                label={STATUS_LABEL[d.status]}
                tone={STATUS_TONE[d.status]}
              />
            </View>
          </Card>
        ))}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  loadingBlock: { paddingVertical: spacing.xxl, alignItems: 'center' },

  emptyCard: { alignItems: 'center', paddingVertical: spacing.xxl },

  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },

  doseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  doseIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
