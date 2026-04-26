import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, TText } from '@/ui/Primitives';
import { AppHeader } from '@/ui/AppHeader';
import { colors, radius, spacing } from '@/theme/colors';
import { useCaregiversStore } from '@/state/caregiversStore';
import type { Caregiver } from '@/types/medicine';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
}

export default function FamilyScreen() {
  const router = useRouter();
  const items = useCaregiversStore((s) => s.items);
  const loading = useCaregiversStore((s) => s.loading);
  const refreshing = useCaregiversStore((s) => s.refreshing);
  const error = useCaregiversStore((s) => s.error);
  const load = useCaregiversStore((s) => s.load);
  const patch = useCaregiversStore((s) => s.patch);
  const remove = useCaregiversStore((s) => s.remove);

  useFocusEffect(
    useCallback(() => {
      void load({ silent: items.length > 0 });
    }, [load, items.length]),
  );

  async function toggle(c: Caregiver, key: 'is_active' | 'notify_on_missed_dose') {
    const next = !c[key];
    const res = await patch(c.caregiver_id, { [key]: next });
    if (!res.ok) {
      Alert.alert('Could not update', res.message ?? 'Try again later.');
    }
  }

  function confirmDelete(c: Caregiver) {
    Alert.alert(
      'Remove caregiver?',
      `${c.display_name} will no longer receive alerts.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const res = await remove(c.caregiver_id);
            if (!res.ok) {
              Alert.alert(
                'Could not remove',
                res.message ?? 'Try again later.',
              );
            }
          },
        },
      ],
    );
  }

  return (
    <View style={styles.screen}>
      <AppHeader title="MediReminder India" subtitle="Family Caregivers" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load({ silent: true })}
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
              Couldn&apos;t load caregivers
            </TText>
            <TText variant="caption" color={colors.accent.danger}>
              {error}
            </TText>
          </Card>
        ) : null}

        {!loading && items.length === 0 ? (
          <Card style={{ alignItems: 'stretch' }}>
            <View style={styles.illoWrap}>
              <Ionicons name="people" size={56} color={colors.brand.navy} />
            </View>
            <TText
              variant="h2"
              style={{ marginTop: spacing.md, textAlign: 'center' }}
            >
              No caregivers yet
            </TText>
            <TText
              variant="body"
              color={colors.text.secondary}
              style={{ textAlign: 'center', marginTop: spacing.sm }}
            >
              Add a family member or caregiver to receive alerts when doses
              are missed or stock runs low.
            </TText>
            <Button
              title="Add caregiver"
              size="lg"
              fullWidth
              onPress={() => router.push('/caregivers/new')}
              style={{ marginTop: spacing.lg }}
            />
          </Card>
        ) : null}

        {items.map((c) => (
          <CaregiverCard
            key={c.caregiver_id}
            c={c}
            onToggleActive={() => toggle(c, 'is_active')}
            onToggleNotify={() => toggle(c, 'notify_on_missed_dose')}
            onEdit={() => router.push(`/caregivers/${c.caregiver_id}`)}
            onDelete={() => confirmDelete(c)}
          />
        ))}

        {items.length > 0 ? (
          <Button
            title="Add another caregiver"
            variant="ghost"
            size="lg"
            fullWidth
            onPress={() => router.push('/caregivers/new')}
            style={{ marginTop: spacing.md }}
            icon={
              <Ionicons name="add" size={18} color={colors.brand.navy} />
            }
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

interface CardProps {
  c: Caregiver;
  onToggleActive: () => void;
  onToggleNotify: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function CaregiverCard({
  c,
  onToggleActive,
  onToggleNotify,
  onEdit,
  onDelete,
}: CardProps) {
  return (
    <Card style={{ marginBottom: spacing.md }}>
      <View style={styles.headerRow}>
        <View style={styles.avatar}>
          <TText variant="h3" color={colors.text.inverse}>
            {initials(c.display_name)}
          </TText>
        </View>
        <View style={{ flex: 1 }}>
          <TText variant="bodyBold" numberOfLines={1}>
            {c.display_name}
          </TText>
          <TText
            variant="caption"
            color={colors.text.secondary}
            numberOfLines={1}
          >
            {c.relationship_label || 'Caregiver'} · {c.email}
          </TText>
          {c.phone ? (
            <TText
              variant="caption"
              color={colors.text.muted}
              numberOfLines={1}
            >
              {c.phone}
            </TText>
          ) : null}
        </View>
        {!c.is_active ? <Badge label="Paused" tone="neutral" /> : null}
      </View>

      <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
          <TText variant="bodyBold">Active caregiver</TText>
          <TText variant="caption" color={colors.text.secondary}>
            Disable to pause this caregiver without deleting them.
          </TText>
        </View>
        <Switch
          value={c.is_active}
          onValueChange={onToggleActive}
          trackColor={{ false: colors.surface.border, true: colors.brand.green }}
          thumbColor={colors.text.inverse}
        />
      </View>

      <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
          <TText variant="bodyBold">Missed-dose alerts</TText>
          <TText variant="caption" color={colors.text.secondary}>
            Notify after two consecutive missed doses.
          </TText>
        </View>
        <Switch
          value={c.notify_on_missed_dose}
          onValueChange={onToggleNotify}
          disabled={!c.is_active}
          trackColor={{ false: colors.surface.border, true: colors.brand.green }}
          thumbColor={colors.text.inverse}
        />
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onEdit}
          style={({ pressed }) => [
            styles.linkBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          hitSlop={6}
        >
          <Ionicons
            name="create-outline"
            size={16}
            color={colors.brand.navy}
          />
          <TText variant="bodyBold" color={colors.brand.navy}>
            Edit
          </TText>
        </Pressable>
        <Pressable
          onPress={onDelete}
          style={({ pressed }) => [
            styles.linkBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          hitSlop={6}
        >
          <Ionicons
            name="trash-outline"
            size={16}
            color={colors.accent.danger}
          />
          <TText variant="bodyBold" color={colors.accent.danger}>
            Remove
          </TText>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  loadingBlock: { paddingVertical: spacing.xxl, alignItems: 'center' },
  illoWrap: {
    alignSelf: 'center',
    width: 120,
    height: 120,
    borderRadius: radius.xl,
    backgroundColor: colors.surface.cardLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },

  toggleRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.lg,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surface.border,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
