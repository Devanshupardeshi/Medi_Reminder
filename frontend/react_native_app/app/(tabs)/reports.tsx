import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  AdherenceSummary,
  buildMonthGrid,
  DayCell,
  DayStatus,
  loadHistoryWindow,
  monthLabel,
  shiftMonth,
  summariseWindow,
} from '@/services/reportHelpers';
import { generateAndSharePdf, shareViaWhatsApp } from '@/services/pdfReport';
import { monthInTz } from '@/services/doseApi';
import { useAuthStore } from '@/state/authStore';
import { useMedicinesStore } from '@/state/medicinesStore';
import { ApiError } from '@/services/apiClient';

type WindowOption = 7 | 30;
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const STATUS_COLOR: Record<DayStatus, string> = {
  allTaken: colors.status.taken,
  partial: colors.status.partial,
  missed: colors.status.missed,
  pending: colors.status.pending,
  none: colors.surface.cardLight,
};

export default function ReportsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [month, setMonth] = useState(monthInTz());
  const [windowDays, setWindowDays] = useState<WindowOption>(7);
  const [days, setDays] = useState<
    Awaited<ReturnType<typeof loadHistoryWindow>>['days']
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const refresh = useCallback(
    async (m: string, opts: { silent?: boolean } = {}) => {
      if (opts.silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const result = await loadHistoryWindow({ month: m });
        setDays(result.days);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Could not load history');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      void refresh(month, { silent: days.length > 0 });
    }, [month, refresh, days.length]),
  );

  const cells: DayCell[] = useMemo(
    () => buildMonthGrid(month, days),
    [month, days],
  );

  const summary: AdherenceSummary = useMemo(
    () => summariseWindow(days, windowDays),
    [days, windowDays],
  );

  const patientName = useMemo(() => {
    if (!user) return 'Patient';
    return [user.first_name, user.last_name].filter(Boolean).join(' ') ||
      user.email;
  }, [user]);

  // Active medicines derived from today's doses (the API has no /medicines
  // endpoint — counting today's scheduled doses gives daily frequency).
  const todayDoses = useMedicinesStore((s) => s.todayDoses);
  const loadToday = useMedicinesStore((s) => s.loadToday);
  useEffect(() => {
    void loadToday({ silent: true });
  }, [loadToday]);
  const activeMedicines = useMemo(() => {
    const map = new Map<string, { name: string; perDay: number }>();
    for (const d of todayDoses) {
      const cur = map.get(d.medicine_id) ?? {
        name: d.medicine_name,
        perDay: 0,
      };
      cur.perDay += 1;
      map.set(d.medicine_id, cur);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [todayDoses]);

  const onPdf = async () => {
    setExporting(true);
    try {
      await generateAndSharePdf({
        patientName,
        monthLabel: monthLabel(month),
        summary,
        cells,
      });
    } catch (e) {
      Alert.alert(
        'Could not share report',
        e instanceof Error ? e.message : 'Try again later.',
      );
    } finally {
      setExporting(false);
    }
  };

  const onWhatsApp = async () => {
    const ok = await shareViaWhatsApp({
      patientName,
      monthLabel: monthLabel(month),
      summary,
      cells,
    });
    if (!ok) {
      Alert.alert(
        'WhatsApp not available',
        'Install WhatsApp or use the share button above instead.',
      );
    }
  };

  const onPickDay = (cell: DayCell) => {
    if (!cell.inMonth || cell.total === 0) return;
    router.push(`/history/${cell.date}`);
  };

  return (
    <View style={styles.screen}>
      <AppHeader title="MediReminder India" subtitle="Report" />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => refresh(month, { silent: true })}
            tintColor={colors.brand.green}
            colors={[colors.brand.green]}
          />
        }
      >
        {/* Date range pills */}
        <Card style={styles.rangeCard}>
          <TText variant="eyebrow" color={colors.text.secondary}>
            Date range
          </TText>
          <View style={styles.pillRow}>
            <RangePill
              label="Last 7 days"
              active={windowDays === 7}
              onPress={() => setWindowDays(7)}
            />
            <RangePill
              label="Last 30 days"
              active={windowDays === 30}
              onPress={() => setWindowDays(30)}
            />
          </View>
        </Card>

        {/* Loading + error states */}
        {loading && days.length === 0 ? (
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
            <Button
              title="Retry"
              variant="ghost"
              size="md"
              onPress={() => refresh(month)}
              style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
            />
          </Card>
        ) : null}

        {/* Adherence overview */}
        <Card style={{ marginTop: spacing.md }}>
          <TText variant="eyebrow" color={colors.text.secondary}>
            Adherence overview
          </TText>
          <View style={styles.overviewRow}>
            <View style={{ flex: 1 }}>
              <TText
                variant="h1"
                color={colors.brand.green}
                style={{ fontSize: 36, lineHeight: 40 }}
              >
                {summary.adherencePct}%
              </TText>
              <TText variant="caption" color={colors.text.secondary}>
                {summary.windowDays}-day adherence
              </TText>
            </View>
            <View style={styles.statBlock}>
              <TText variant="h2" color={colors.brand.navy}>
                {summary.currentStreakDays}
              </TText>
              <TText variant="caption" color={colors.text.secondary}>
                Day streak
              </TText>
            </View>
          </View>

          <View style={styles.miniStatRow}>
            <MiniStat label="Taken" value={summary.takenDoses} tone="success" />
            <MiniStat label="Missed" value={summary.missedDoses} tone="danger" />
            <MiniStat
              label="Skipped"
              value={summary.skippedDoses}
              tone="warning"
            />
            <MiniStat
              label="Pending"
              value={summary.pendingDoses}
              tone="neutral"
            />
          </View>
        </Card>

        {/* Heatmap */}
        <Card style={{ marginTop: spacing.md }}>
          <View style={styles.monthHeader}>
            <Pressable
              onPress={() => setMonth(shiftMonth(month, -1))}
              hitSlop={8}
              style={({ pressed }) => [
                styles.iconBtn,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={colors.brand.navy}
              />
            </Pressable>
            <TText variant="h3">{monthLabel(month)}</TText>
            <Pressable
              onPress={() => {
                const next = shiftMonth(month, 1);
                if (next > monthInTz()) return;
                setMonth(next);
              }}
              disabled={month >= monthInTz()}
              hitSlop={8}
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  opacity: pressed
                    ? 0.6
                    : month >= monthInTz()
                    ? 0.3
                    : 1,
                },
              ]}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.brand.navy}
              />
            </Pressable>
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((w, idx) => (
              <View key={idx} style={styles.weekdayCell}>
                <TText variant="caption" color={colors.text.muted}>
                  {w}
                </TText>
              </View>
            ))}
          </View>

          <View style={styles.gridWrap}>
            {cells.map((cell, i) => (
              <Pressable
                key={`${cell.date}-${i}`}
                onPress={() => onPickDay(cell)}
                disabled={!cell.inMonth || cell.total === 0}
                style={({ pressed }) => [
                  styles.dayCell,
                  {
                    opacity: !cell.inMonth ? 0.35 : pressed ? 0.7 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.dayDot,
                    {
                      backgroundColor: STATUS_COLOR[cell.status],
                      borderColor:
                        cell.status === 'none'
                          ? colors.surface.border
                          : 'transparent',
                    },
                  ]}
                >
                  <TText
                    variant="caption"
                    color={
                      cell.status === 'none' || !cell.inMonth
                        ? colors.text.muted
                        : colors.text.inverse
                    }
                    style={{ fontWeight: '600', fontSize: 12 }}
                  >
                    {cell.inMonth ? cell.day : ''}
                  </TText>
                </View>
              </Pressable>
            ))}
          </View>

          <View style={styles.legendRow}>
            <LegendDot color={colors.status.taken} label="All taken" />
            <LegendDot color={colors.status.partial} label="Partial" />
            <LegendDot color={colors.status.missed} label="Missed" />
            <LegendDot color={colors.status.pending} label="Pending" />
          </View>
        </Card>

        {/* Best/worst day chips */}
        {summary.bestDay || summary.worstDay ? (
          <Card style={{ marginTop: spacing.md }}>
            <TText variant="eyebrow" color={colors.text.secondary}>
              Highlights
            </TText>
            <View style={{ height: spacing.sm }} />
            {summary.bestDay ? (
              <View style={styles.highlightRow}>
                <Ionicons
                  name="trophy"
                  size={18}
                  color={colors.status.taken}
                />
                <TText
                  variant="body"
                  style={{ marginLeft: spacing.sm, flex: 1 }}
                >
                  Best day
                </TText>
                <Badge label={summary.bestDay} tone="success" />
              </View>
            ) : null}
            {summary.worstDay && summary.worstDay !== summary.bestDay ? (
              <View style={styles.highlightRow}>
                <Ionicons
                  name="alert-circle"
                  size={18}
                  color={colors.accent.danger}
                />
                <TText
                  variant="body"
                  style={{ marginLeft: spacing.sm, flex: 1 }}
                >
                  Needs attention
                </TText>
                <Badge label={summary.worstDay} tone="danger" />
              </View>
            ) : null}
          </Card>
        ) : null}

        {/* Active medicine list */}
        {activeMedicines.length > 0 ? (
          <Card style={{ marginTop: spacing.md }}>
            <TText variant="eyebrow" color={colors.text.secondary}>
              Active medicines
            </TText>
            <View style={{ height: spacing.sm }} />
            {activeMedicines.map((m, i) => (
              <View
                key={`${m.name}-${i}`}
                style={[
                  styles.medRow,
                  i < activeMedicines.length - 1 && styles.medRowDivider,
                ]}
              >
                <View style={styles.medPillIcon}>
                  <MaterialCommunityIcons
                    name="pill"
                    size={18}
                    color={colors.brand.navy}
                  />
                </View>
                <TText variant="bodyBold" style={{ flex: 1 }} numberOfLines={1}>
                  {m.name}
                </TText>
                <TText variant="caption" color={colors.text.secondary}>
                  {m.perDay} time{m.perDay === 1 ? '' : 's'}/day
                </TText>
              </View>
            ))}
          </Card>
        ) : null}

        {/* Export actions */}
        <View style={{ height: spacing.md }} />
        <Button
          title={exporting ? 'Sharing...' : 'Share doctor report'}
          onPress={onPdf}
          loading={exporting}
          size="lg"
          fullWidth
          icon={
            <Ionicons
              name="share-social"
              size={18}
              color={colors.text.inverse}
            />
          }
        />
        <View style={{ height: spacing.sm }} />
        <Button
          title="Share via WhatsApp"
          variant="ghost"
          size="lg"
          fullWidth
          onPress={onWhatsApp}
          icon={
            <MaterialCommunityIcons
              name="whatsapp"
              size={20}
              color={colors.brand.navy}
            />
          }
        />

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

/* ---------- helpers ---------- */

function RangePill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.rangePill,
        active && {
          backgroundColor: colors.brand.navy,
          borderColor: colors.brand.navy,
        },
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <TText
        variant="bodyBold"
        color={active ? colors.text.inverse : colors.brand.navy}
      >
        {label}
      </TText>
    </Pressable>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'success' | 'danger' | 'warning' | 'neutral';
}) {
  const colorMap = {
    success: colors.status.taken,
    danger: colors.status.missed,
    warning: colors.status.partial,
    neutral: colors.text.secondary,
  } as const;
  return (
    <View style={styles.miniStat}>
      <TText variant="h3" color={colorMap[tone]}>
        {value}
      </TText>
      <TText variant="caption" color={colors.text.secondary}>
        {label}
      </TText>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 2,
          backgroundColor: color,
          marginRight: 6,
        }}
      />
      <TText variant="caption" color={colors.text.secondary}>
        {label}
      </TText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  loadingBlock: { paddingVertical: spacing.xxl, alignItems: 'center' },

  rangeCard: { paddingVertical: spacing.md },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  rangePill: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
  },

  overviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: spacing.sm,
  },
  statBlock: { alignItems: 'flex-end' },
  miniStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surface.border,
  },
  miniStat: { alignItems: 'center', flex: 1 },

  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.surface.cardLight,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  dayDot: {
    width: '88%',
    height: '88%',
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surface.border,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center' },

  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  medRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  medRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
  },
  medPillIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface.cardLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
