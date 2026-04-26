import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, TText } from '@/ui/Primitives';
import { colors, radius, spacing } from '@/theme/colors';
import { authApi } from '@/services/authApi';
import { useAuthStore } from '@/state/authStore';
import { ApiError } from '@/services/apiClient';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailScreen() {
  const router = useRouter();
  const setPendingEmail = useAuthStore((s) => s.setPendingEmail);

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = EMAIL_RE.test(email.trim());

  const onSubmit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await authApi.requestOtp(email);
      setPendingEmail(email.trim().toLowerCase());
      router.push('/auth/otp');
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : 'Could not reach server. Please try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={styles.back}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={colors.text.primary}
            />
          </Pressable>

          <TText variant="h1" style={{ marginTop: spacing.lg }}>
            What&apos;s your email?
          </TText>
          <TText
            variant="body"
            color={colors.text.secondary}
            style={{ marginTop: spacing.sm }}
          >
            We&apos;ll send a 6-digit code to verify it. No password needed.
          </TText>

          <Card style={{ marginTop: spacing.xl, gap: spacing.sm }}>
            <TText variant="eyebrow" color={colors.text.secondary}>
              Email address
            </TText>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              inputMode="email"
              returnKeyType="send"
              placeholder="rajesh@example.com"
              placeholderTextColor={colors.text.muted}
              style={styles.input}
              onSubmitEditing={onSubmit}
            />
          </Card>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons
                name="alert-circle"
                size={18}
                color={colors.accent.danger}
              />
              <TText
                variant="caption"
                color={colors.accent.danger}
                style={{ flex: 1 }}
              >
                {error}
              </TText>
            </View>
          ) : null}

          <Button
            title="Send code"
            size="lg"
            fullWidth
            disabled={!valid}
            loading={submitting}
            onPress={onSubmit}
            style={{ marginTop: spacing.xl }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface.card,
    borderWidth: 1,
    borderColor: colors.surface.border,
  },
  input: {
    fontSize: 17,
    fontWeight: '500',
    color: colors.text.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.cardLight,
    borderRadius: radius.md,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accent.dangerSoft,
  },
});
