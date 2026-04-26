import React, { useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Badge, Button, Card, Screen, TText } from '@/ui/Primitives';
import { AppHeader } from '@/ui/AppHeader';
import { colors, radius, spacing } from '@/theme/colors';
import { usePrescriptionDraftStore } from '@/state/prescriptionDraftStore';
import { useAiInsightsStore } from '@/state/aiInsightsStore';
import { confirmPrescription } from '@/services/prescriptionApi';
import { ApiError } from '@/services/apiClient';
import { notificationService } from '@/services/notificationService';
import type { DraftMedicine } from '@/types/medicine';

const DOSE_LABELS = ['Morning', 'Afternoon', 'Evening', 'Night'] as const;

function defaultTimeForSlot(index: number): string {
  // 8:00, 13:00, 20:00, 22:00
  return ['08:00', '13:00', '20:00', '22:00'][index] ?? '08:00';
}

function formatTime12h(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr ?? 0);
  const m = Number(mStr ?? 0);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function isValidHHMM(s: string): boolean {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return false;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  return h >= 0 && h <= 23 && mm >= 0 && mm <= 59;
}

function normaliseHHMM(s: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return s;
  return `${String(m[1]).padStart(2, '0')}:${m[2]}`;
}

export default function ReviewScreen() {
  const router = useRouter();
  const draft = usePrescriptionDraftStore((s) => s.draft);
  const editable = usePrescriptionDraftStore((s) => s.editable);
  const updateMedicine = usePrescriptionDraftStore((s) => s.updateMedicine);
  const removeMedicine = usePrescriptionDraftStore((s) => s.removeMedicine);
  const reset = usePrescriptionDraftStore((s) => s.reset);
  const saveInsights = useAiInsightsStore((s) => s.saveFromConfirm);

  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    medIndex: number;
    timeIndex: number;
    value: string;
  } | null>(null);

  if (!draft) {
    return (
      <Screen>
        <AppHeader title="Review" subtitle="No draft loaded" />
        <View style={styles.emptyBlock}>
          <TText variant="body" color={colors.text.secondary}>
            Your prescription draft has expired. Please scan again.
          </TText>
          <Button
            title="Back to Scan"
            onPress={() => router.replace('/scan')}
            style={{ marginTop: spacing.lg }}
          />
        </View>
      </Screen>
    );
  }

  async function onConfirm() {
    if (!draft) return;
    if (editable.length === 0) {
      Alert.alert(
        'No medicines to confirm',
        'Add at least one medicine to continue.',
      );
      return;
    }
    // Validate times
    for (const med of editable) {
      for (const t of med.reminder_times_24h) {
        if (!isValidHHMM(t)) {
          Alert.alert(
            'Invalid reminder time',
            `"${t}" on ${med.name || 'a medicine'} is not in HH:MM format.`,
          );
          return;
        }
      }
      if (!med.name.trim()) {
        Alert.alert('Missing name', 'Every medicine needs a name.');
        return;
      }
    }

    setConfirming(true);
    setError(null);
    try {
      const res = await confirmPrescription({
        prescriptionId: draft.prescription_id,
        medicines: editable,
      });
      // Stash literacy + food advisories keyed by the new medicine_ids so
      // detail / reminder screens can show them later. Best-effort.
      try {
        await saveInsights(draft.analysis, res.medicines, {
          prescriptionId: res.prescription_id,
          language: draft.language,
        });
      } catch {
        // non-fatal
      }
      // CRITICAL: actually schedule the daily alarms. Without this the
      // backend has the medicine but the device never rings. This was
      // the root cause of "alarm not working" — confirm was wired up
      // but no local notifications were ever queued.
      try {
        // Make sure permissions/channel are in place before queuing.
        await notificationService.requestPermissions();
        await notificationService.scheduleAll(res.medicines);
        // Log everything we just queued so it's verifiable in Logcat.
        await notificationService.listScheduled();
      } catch (schedErr) {
        console.log('[v0] post-confirm schedule failed', String(schedErr));
        Alert.alert(
          'Reminders not set',
          'Your medicines were saved, but we could not schedule the alarms. Please open Settings and enable notifications for MediReminder, then re-confirm.',
        );
      }
      reset();
      router.replace('/(tabs)/home');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Could not save.';
      setError(msg);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <AppHeader
        title="Review Extracted Details"
        subtitle={`${editable.length} medicine${
          editable.length === 1 ? '' : 's'
        } detected`}
        showBack
        onPressBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Image preview */}
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <Image
            source={{ uri: draft.image_url }}
            style={styles.thumb}
            resizeMode="cover"
          />
        </Card>

        {/* Medicine cards */}
        {editable.map((med, idx) => (
          <MedicineCard
            key={idx}
            index={idx}
            medicine={med}
            onChange={(patch) => updateMedicine(idx, patch)}
            onRemove={() => {
              Alert.alert(
                'Remove this medicine?',
                `${med.name} will not be added to your reminders.`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () => removeMedicine(idx),
                  },
                ],
              );
            }}
            onEditTime={(timeIndex, value) =>
              setEditing({ medIndex: idx, timeIndex, value })
            }
          />
        ))}

        {error ? (
          <Card
            style={{
              borderColor: colors.accent.danger,
              backgroundColor: colors.accent.dangerSoft,
              marginTop: spacing.md,
            }}
          >
            <TText variant="bodyBold" color={colors.accent.danger}>
              Could not confirm
            </TText>
            <TText variant="caption" color={colors.accent.danger}>
              {error}
            </TText>
          </Card>
        ) : null}

        {/* Primary CTAs */}
        <Button
          title="Confirm medicines & schedule"
          size="lg"
          fullWidth
          loading={confirming}
          onPress={onConfirm}
          style={{ marginTop: spacing.lg }}
        />
        <Button
          title="Scan another"
          variant="ghost"
          size="lg"
          fullWidth
          onPress={() => {
            reset();
            router.replace('/scan');
          }}
          style={{ marginTop: spacing.md }}
        />

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      {/* Inline time editor */}
      <TimeEditModal
        visible={editing !== null}
        initialValue={editing?.value ?? ''}
        onCancel={() => setEditing(null)}
        onSave={(next) => {
          if (!editing) return;
          const med = editable[editing.medIndex];
          if (!med) return;
          const times = med.reminder_times_24h.slice();
          times[editing.timeIndex] = normaliseHHMM(next);
          updateMedicine(editing.medIndex, { reminder_times_24h: times });
          setEditing(null);
        }}
      />
    </Screen>
  );
}

interface MedicineCardProps {
  index: number;
  medicine: DraftMedicine;
  onChange: (patch: Partial<DraftMedicine>) => void;
  onRemove: () => void;
  onEditTime: (timeIndex: number, value: string) => void;
}

function MedicineCard({
  index,
  medicine,
  onChange,
  onRemove,
  onEditTime,
}: MedicineCardProps) {
  const confidencePct = Math.round((medicine.confidence ?? 0) * 100);
  const confidenceTone =
    confidencePct >= 80 ? 'success' : confidencePct >= 50 ? 'warning' : 'danger';

  function toggleSlot(slotIndex: number) {
    const times = medicine.reminder_times_24h.slice();
    if (times[slotIndex]) {
      times.splice(slotIndex, 1);
    } else {
      times.splice(slotIndex, 0, defaultTimeForSlot(slotIndex));
    }
    onChange({ reminder_times_24h: times });
  }

  const slots = Array.from({ length: 4 }, (_, i) => ({
    index: i,
    label: DOSE_LABELS[i],
    time: medicine.reminder_times_24h[i] ?? null,
  }));

  return (
    <Card style={{ marginTop: spacing.md }}>
      <View style={styles.medHeader}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
          }}
        >
          <View style={styles.medChip}>
            <TText variant="bodyBold" color={colors.text.inverse}>
              {index + 1}
            </TText>
          </View>
          <Badge label={`${confidencePct}% confident`} tone={confidenceTone} />
        </View>
        <Pressable onPress={onRemove} hitSlop={10}>
          <Ionicons
            name="trash-outline"
            size={20}
            color={colors.text.secondary}
          />
        </Pressable>
      </View>

      <FieldRow
        label="Medicine name"
        value={medicine.name}
        placeholder="e.g. Amlodipine"
        onChangeText={(v) => onChange({ name: v })}
      />
      <FieldRow
        label="Dosage pattern"
        value={medicine.dosage_pattern}
        placeholder="e.g. 1-0-1 after food"
        onChangeText={(v) => onChange({ dosage_pattern: v })}
      />
      <FieldRow
        label="Duration (days)"
        value={
          medicine.duration_days != null ? String(medicine.duration_days) : ''
        }
        placeholder="e.g. 30"
        keyboardType="number-pad"
        onChangeText={(v) => {
          const n = Number(v);
          onChange({
            duration_days:
              v.trim() === '' || Number.isNaN(n) ? null : Math.max(0, n),
          });
        }}
      />

      <View style={styles.slotHeader}>
        <TText variant="eyebrow" color={colors.text.secondary}>
          Reminder times
        </TText>
        <TText variant="caption" color={colors.text.muted}>
          Tap a slot to toggle, pencil to edit
        </TText>
      </View>

      {slots.map((s) => {
        const enabled = s.time !== null;
        return (
          <View key={s.index} style={styles.slotRow}>
            <Pressable
              onPress={() => toggleSlot(s.index)}
              style={[styles.checkbox, enabled && styles.checkboxOn]}
            >
              {enabled ? (
                <Ionicons
                  name="checkmark"
                  size={16}
                  color={colors.text.inverse}
                />
              ) : null}
            </Pressable>
            <TText
              variant="bodyBold"
              color={enabled ? colors.text.primary : colors.text.muted}
              style={{ flex: 1 }}
            >
              {s.label}
            </TText>
            {enabled ? (
              <Pressable
                onPress={() => onEditTime(s.index, s.time ?? '')}
                style={styles.timePill}
                hitSlop={8}
              >
                <Ionicons
                  name="time-outline"
                  size={16}
                  color={colors.brand.navy}
                />
                <TText variant="bodyBold" color={colors.brand.navy}>
                  {formatTime12h(s.time ?? '00:00')}
                </TText>
                <Ionicons
                  name="pencil"
                  size={14}
                  color={colors.text.secondary}
                />
              </Pressable>
            ) : (
              <TText variant="caption" color={colors.text.muted}>
                Disabled
              </TText>
            )}
          </View>
        );
      })}
    </Card>
  );
}

interface FieldRowProps {
  label: string;
  value: string;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad';
  onChangeText: (v: string) => void;
}

function FieldRow({
  label,
  value,
  placeholder,
  keyboardType = 'default',
  onChangeText,
}: FieldRowProps) {
  return (
    <View style={styles.fieldRow}>
      <TText
        variant="caption"
        color={colors.text.secondary}
        style={{ marginBottom: 4 }}
      >
        {label}
      </TText>
      <View style={styles.fieldInputWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.text.muted}
          keyboardType={keyboardType}
          style={styles.fieldInput}
        />
        <MaterialCommunityIcons
          name="pencil-outline"
          size={16}
          color={colors.text.muted}
        />
      </View>
    </View>
  );
}

interface TimeEditModalProps {
  visible: boolean;
  initialValue: string;
  onCancel: () => void;
  onSave: (next: string) => void;
}

function TimeEditModal({
  visible,
  initialValue,
  onCancel,
  onSave,
}: TimeEditModalProps) {
  const [val, setVal] = useState(initialValue);
  const [touched, setTouched] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setVal(initialValue);
      setTouched(false);
    }
  }, [visible, initialValue]);

  const valid = isValidHHMM(val);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.modalScrim} onPress={onCancel}>
        <Pressable style={styles.modalCard} onPress={() => null}>
          <TText variant="h3">Edit reminder time</TText>
          <TText
            variant="caption"
            color={colors.text.secondary}
            style={{ marginTop: 4 }}
          >
            Use 24-hour format (e.g. 08:00, 14:30, 21:00).
          </TText>
          <TextInput
            value={val}
            onChangeText={(v) => {
              setVal(v);
              setTouched(true);
            }}
            placeholder="HH:MM"
            placeholderTextColor={colors.text.muted}
            keyboardType="numbers-and-punctuation"
            autoFocus
            style={styles.modalInput}
          />
          {touched && !valid ? (
            <TText
              variant="caption"
              color={colors.accent.danger}
              style={{ marginTop: 4 }}
            >
              Enter a valid 24-hour time like 08:00 or 21:30.
            </TText>
          ) : (
            <TText
              variant="caption"
              color={colors.text.secondary}
              style={{ marginTop: 4 }}
            >
              {valid ? formatTime12h(normaliseHHMM(val)) : ''}
            </TText>
          )}

          <View style={{ flexDirection: 'row', marginTop: spacing.lg }}>
            <Button
              title="Cancel"
              variant="ghost"
              fullWidth
              onPress={onCancel}
              style={{ flex: 1, marginRight: spacing.sm }}
            />
            <Button
              title="Save"
              fullWidth
              disabled={!valid}
              onPress={() => onSave(val)}
              style={{ flex: 1, marginLeft: spacing.sm }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  thumb: { width: '100%', height: 160 },
  emptyBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },

  medHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  medChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.brand.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },

  fieldRow: { marginTop: spacing.md },
  fieldInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.cardLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.surface.border,
  },
  fieldInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text.primary,
  },

  slotHeader: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.surface.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.card,
  },
  checkboxOn: {
    backgroundColor: colors.brand.green,
    borderColor: colors.brand.green,
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface.cardLight,
    borderWidth: 1,
    borderColor: colors.surface.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },

  modalScrim: {
    flex: 1,
    backgroundColor: colors.surface.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  modalInput: {
    marginTop: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface.cardLight,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: radius.md,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
});
