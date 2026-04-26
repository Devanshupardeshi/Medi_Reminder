import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Button, Card, TText } from '@/ui/Primitives';
import { AppHeader } from '@/ui/AppHeader';
import { useCaregiversStore } from '@/state/caregiversStore';
import { getCaregiver } from '@/services/caregiverApi';
import { ApiError } from '@/services/apiClient';
import { colors, radius, spacing } from '@/theme/colors';

// Single dynamic route handles BOTH:
//   /caregivers/new   -> create
//   /caregivers/<id>  -> edit
// We branch on the literal "new" sentinel so the route table stays small.
export default function CaregiverFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === 'new';

  // IMPORTANT: select state slices individually. A multi-key selector that
  // returns a fresh object each call would re-render this screen on every
  // store update.
  const add = useCaregiversStore((s) => s.add);
  const patch = useCaregiversStore((s) => s.patch);
  const remove = useCaregiversStore((s) => s.remove);
  const cached = useCaregiversStore((s) =>
    isNew ? null : s.items.find((c) => c.caregiver_id === id) ?? null,
  );

  // Form fields — pre-fill instantly from the store cache (the family
  // screen has already loaded the list, so this is virtually always
  // populated). We then run a network refresh in the background.
  const [displayName, setDisplayName] = useState(cached?.display_name ?? '');
  const [email, setEmail] = useState(cached?.email ?? '');
  const [phone, setPhone] = useState(cached?.phone ?? '');
  const [relationship, setRelationship] = useState(
    cached?.relationship_label ?? '',
  );
  const [notifyMissed, setNotifyMissed] = useState(
    cached?.notify_on_missed_dose ?? true,
  );
  const [active, setActive] = useState(cached?.is_active ?? true);

  // Show the spinner only when we have NO cached copy to display. With
  // a cache, the form is interactive immediately and we silently refresh.
  const [loading, setLoading] = useState(!isNew && !cached);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    (async () => {
      // Network refresh — silent if we already painted from cache.
      try {
        const c = await getCaregiver(id);
        if (cancelled) return;
        setDisplayName(c.display_name);
        setEmail(c.email);
        setPhone(c.phone ?? '');
        setRelationship(c.relationship_label ?? '');
        setNotifyMissed(c.notify_on_missed_dose ?? true);
        setActive(c.is_active ?? true);
      } catch (e) {
        // Only surface a hard error when the user has nothing to look at.
        if (!cancelled && !cached) {
          const msg =
            e instanceof ApiError ? e.message : 'Could not load caregiver';
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew]);

  const validation = useMemo(() => {
    if (!displayName.trim()) return 'Display name is required';
    if (!email.trim()) return 'Email is required';
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email.trim())) return 'Enter a valid email';
    if (phone.trim() && !/^[+\d][\d\s\-()]{5,}$/.test(phone.trim())) {
      return 'Phone must be digits with optional leading +';
    }
    return null;
  }, [displayName, email, phone]);

  const onSubmit = async () => {
    if (validation) {
      setError(validation);
      return;
    }
    setSubmitting(true);
    setError(null);
    const payload = {
      display_name: displayName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() ? phone.trim() : null,
      relationship_label: relationship.trim() ? relationship.trim() : null,
      notify_on_missed_dose: notifyMissed,
      is_active: active,
    };
    const result = isNew ? await add(payload) : await patch(id, payload);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message ?? 'Could not save caregiver');
      return;
    }
    router.back();
  };

  const onDelete = async () => {
    if (isNew) return;
    setDeleting(true);
    setError(null);
    const r = await remove(id);
    setDeleting(false);
    if (!r.ok) {
      setError(r.message ?? 'Could not remove caregiver');
      return;
    }
    router.back();
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <AppHeader
        title={isNew ? 'Add caregiver' : 'Edit caregiver'}
        showBack
        onPressBack={() => router.back()}
        showLanguage={false}
        showProfile={false}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand.green} size="large" />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <Card>
              <TText variant="h3">Contact details</TText>
              <View style={{ height: spacing.md }} />

              <Field
                label="Display name"
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Pooja Sharma"
                autoCapitalize="words"
              />
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="pooja@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Field
                label="Phone (optional)"
                value={phone}
                onChangeText={setPhone}
                placeholder="+91 98765 43210"
                keyboardType="phone-pad"
              />
              <Field
                label="Relationship (optional)"
                value={relationship}
                onChangeText={setRelationship}
                placeholder="Daughter / Son / Spouse"
                autoCapitalize="words"
                last
              />
            </Card>

            <View style={{ height: spacing.md }} />

            <Card>
              <TText variant="h3">Alert settings</TText>
              <View style={{ height: spacing.sm }} />
              <ToggleRow
                icon="alert-circle-outline"
                label="Missed dose alerts"
                hint="Notify after two consecutive missed doses"
                value={notifyMissed}
                onValueChange={setNotifyMissed}
                disabled={!active}
              />
              <ToggleRow
                icon="checkmark-circle-outline"
                label="Active caregiver"
                hint="Disable to pause alerts without removing"
                value={active}
                onValueChange={setActive}
                last
              />
            </Card>

            {error ? (
              <View style={styles.errBanner}>
                <Ionicons
                  name="alert-circle"
                  size={18}
                  color={colors.text.inverse}
                />
                <TText
                  variant="caption"
                  color={colors.text.inverse}
                  style={{ marginLeft: 8, flex: 1 }}
                >
                  {error}
                </TText>
              </View>
            ) : null}

            <View style={{ height: spacing.lg }} />
            <Button
              title={
                submitting
                  ? 'Saving...'
                  : isNew
                  ? 'Add caregiver'
                  : 'Save changes'
              }
              onPress={onSubmit}
              disabled={submitting || deleting}
              size="lg"
              fullWidth
            />

            {!isNew ? (
              <>
                <View style={{ height: spacing.sm }} />
                <Button
                  title={deleting ? 'Removing...' : 'Remove caregiver'}
                  onPress={onDelete}
                  disabled={submitting || deleting}
                  variant="danger"
                  size="lg"
                  fullWidth
                />
              </>
            ) : null}

            <View style={{ height: spacing.xxl }} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

/* --------------------------------------------------------- */
/* Inline form helpers — kept here to avoid a parallel       */
/* primitives module just for two components.                */
/* --------------------------------------------------------- */

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  last?: boolean;
}

function Field({ last, label, ...rest }: FieldProps) {
  return (
    <View style={[fieldStyles.wrap, !last && { marginBottom: spacing.md }]}>
      <TText variant="caption" color={colors.text.secondary}>
        {label}
      </TText>
      <TextInput
        {...rest}
        style={fieldStyles.input}
        placeholderTextColor={colors.text.muted}
      />
    </View>
  );
}

interface ToggleProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  last?: boolean;
}

function ToggleRow({
  icon,
  label,
  hint,
  value,
  onValueChange,
  disabled,
  last,
}: ToggleProps) {
  return (
    <View
      style={[
        fieldStyles.toggleRow,
        !last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.surface.border,
        },
      ]}
    >
      <View style={fieldStyles.toggleIconWrap}>
        <Ionicons name={icon} size={18} color={colors.brand.navy} />
      </View>
      <View style={{ flex: 1 }}>
        <TText variant="bodyBold">{label}</TText>
        {hint ? (
          <TText variant="caption" color={colors.text.secondary}>
            {hint}
          </TText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{
          false: colors.surface.border,
          true: colors.brand.green,
        }}
        thumbColor={colors.text.inverse}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent.danger,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
});

const fieldStyles = StyleSheet.create({
  wrap: {},
  input: {
    marginTop: 4,
    backgroundColor: colors.surface.cardLight,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text.primary,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  toggleIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface.cardLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
