import React, { useEffect, useRef, useState } from 'react';
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
import { Button, TText } from '@/ui/Primitives';
import { colors, radius, spacing } from '@/theme/colors';
import { authApi } from '@/services/authApi';
import { useAuthStore } from '@/state/authStore';
import { ApiError } from '@/services/apiClient';

const OTP_LENGTH = 6;

export default function OtpScreen() {
  const router = useRouter();
  const pendingEmail = useAuthStore((s) => s.pendingEmail);
  const completeSignIn = useAuthStore((s) => s.completeSignIn);

  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(60);

  const inputRef = useRef<TextInput>(null);

  // Bounce back to email screen if user landed here without an email.
  useEffect(() => {
    if (!pendingEmail) router.replace('/auth/email');
  }, [pendingEmail, router]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Resend cooldown ticker.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const canSubmit = otp.length === OTP_LENGTH && /^\d{6}$/.test(otp);

  const onVerify = async () => {
    if (!canSubmit || !pendingEmail || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await authApi.verifyOtp(pendingEmail, otp);
      await completeSignIn(res.access_token, res.user);
      router.replace('/(tabs)/home');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Verification failed.');
      setOtp('');
    } finally {
      setSubmitting(false);
    }
  };

  const onResend = async () => {
    if (cooldown > 0 || !pendingEmail || resending) return;
    setResending(true);
    setError(null);
    setInfo(null);
    try {
      const r = await authApi.resendOtp(pendingEmail);
      setInfo('Code resent. Check your inbox.');
      setCooldown(r.resend_after_seconds || 60);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not resend code.');
    } finally {
      setResending(false);
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
            Enter the code
          </TText>
          <TText
            variant="body"
            color={colors.text.secondary}
            style={{ marginTop: spacing.sm }}
          >
            {pendingEmail
              ? `We sent a 6-digit code to ${pendingEmail}.`
              : 'We sent a 6-digit code to your email.'}
          </TText>

          <View style={styles.codeRow}>
            {Array.from({ length: OTP_LENGTH }).map((_, i) => {
              const ch = otp[i];
              const focused = otp.length === i;
              return (
                <View
                  key={i}
                  style={[
                    styles.codeBox,
                    focused && {
                      borderColor: colors.brand.green,
                      backgroundColor: '#FFFFFF',
                    },
                    ch && { borderColor: colors.text.primary },
                  ]}
                >
                  <TText variant="h1">{ch ?? ''}</TText>
                </View>
              );
            })}
            {/* Hidden actual input that drives the boxes above */}
            <TextInput
              ref={inputRef}
              value={otp}
              onChangeText={(v) =>
                setOtp(v.replace(/\D/g, '').slice(0, OTP_LENGTH))
              }
              keyboardType="number-pad"
              inputMode="numeric"
              autoComplete="sms-otp"
              textContentType="oneTimeCode"
              maxLength={OTP_LENGTH}
              style={styles.hiddenInput}
              caretHidden
            />
          </View>

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

          {info ? (
            <View style={styles.infoBox}>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={colors.brand.greenDark}
              />
              <TText
                variant="caption"
                color={colors.brand.greenDark}
                style={{ flex: 1 }}
              >
                {info}
              </TText>
            </View>
          ) : null}

          <Button
            title="Verify"
            size="lg"
            fullWidth
            disabled={!canSubmit}
            loading={submitting}
            onPress={onVerify}
            style={{ marginTop: spacing.xl }}
          />

          <View style={styles.resendRow}>
            <TText variant="caption" color={colors.text.secondary}>
              Didn&apos;t get the code?
            </TText>
            <Pressable
              onPress={onResend}
              disabled={cooldown > 0 || resending}
              hitSlop={6}
            >
              <TText
                variant="bodyBold"
                color={
                  cooldown > 0 ? colors.text.muted : colors.brand.greenDark
                }
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend'}
              </TText>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  content: { flexGrow: 1, padding: spacing.lg },
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
  codeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
    justifyContent: 'space-between',
    position: 'relative',
  },
  codeBox: {
    flex: 1,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.cardLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    color: 'transparent',
    backgroundColor: 'transparent',
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
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#DCFCE7',
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
});
