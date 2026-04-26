import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, TText } from '@/ui/Primitives';
import { AppHeader } from '@/ui/AppHeader';
import { colors, radius, spacing } from '@/theme/colors';
import { useAuthStore } from '@/state/authStore';
import { authApi } from '@/services/authApi';
import { ApiError } from '@/services/apiClient';
import { notificationService } from '@/services/notificationService';
import { BACKEND_URL } from '@/config/env';

export default function SettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const signOut = useAuthStore((s) => s.signOut);

  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [savingName, setSavingName] = useState(false);

  const onSaveName = async () => {
    setSavingName(true);
    try {
      // PATCH returns the updated AuthUser fields directly, so we can
      // hydrate the store from this response and skip a second GET.
      const res = await authApi.updateProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });
      await setUser({
        user_id: res.user_id,
        email: res.email,
        first_name: res.first_name,
        last_name: res.last_name,
        last_login_at: res.last_login_at,
      });
      Alert.alert('Saved', 'Your profile is updated.');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Update failed.';
      Alert.alert('Could not save', msg);
    } finally {
      setSavingName(false);
    }
  };

  const onTestAlarm = async () => {
    try {
      const id = await notificationService.scheduleTestAlarm();
      if (id) {
        Alert.alert(
          'Test alarm queued',
          'Lock your phone now. The alarm will ring in about 5 seconds. If it does not ring, your device is blocking notifications for this app — check Settings → Apps → MediReminder → Notifications, and disable battery optimisation.',
        );
      }
    } catch (e) {
      Alert.alert(
        'Could not queue test alarm',
        e instanceof Error ? e.message : 'Unknown error',
      );
    }
  };

  const onSignOut = () => {
    Alert.alert('Sign out?', 'You will need your email to sign back in.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          void signOut();
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <AppHeader title="MediReminder India" subtitle="More" />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile */}
        <Card style={{ gap: spacing.md }}>
          <View style={styles.row}>
            <View style={styles.avatar}>
              <Ionicons
                name="person"
                size={28}
                color={colors.brand.navy}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TText variant="bodyBold">{user?.email ?? '—'}</TText>
              <TText variant="caption" color={colors.text.secondary}>
                Signed in via OTP
              </TText>
            </View>
          </View>

          <View style={{ gap: spacing.sm }}>
            <TText variant="eyebrow" color={colors.text.secondary}>
              First name
            </TText>
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Rajesh"
              placeholderTextColor={colors.text.muted}
              style={styles.input}
              autoCapitalize="words"
            />
          </View>

          <View style={{ gap: spacing.sm }}>
            <TText variant="eyebrow" color={colors.text.secondary}>
              Last name
            </TText>
            <TextInput
              value={lastName}
              onChangeText={setLastName}
              placeholder="Sharma"
              placeholderTextColor={colors.text.muted}
              style={styles.input}
              autoCapitalize="words"
            />
          </View>

          <Button
            title="Save profile"
            loading={savingName}
            onPress={onSaveName}
          />
        </Card>

        {/* Test alarm — diagnostic for the medication-reminder channel */}
        <Card style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <View style={styles.row}>
            <View style={styles.avatar}>
              <Ionicons
                name="alarm"
                size={24}
                color={colors.brand.navy}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TText variant="bodyBold">Reminder system check</TText>
              <TText variant="caption" color={colors.text.secondary}>
                Fire a test alarm in 5 seconds to verify your phone will
                ring when a dose is due.
              </TText>
            </View>
          </View>
          <Button
            title="Test alarm in 5 seconds"
            variant="secondary"
            onPress={onTestAlarm}
          />
        </Card>

        {/* About / backend */}
        <Card style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <TText variant="h3">About</TText>
          <TText variant="caption" color={colors.text.secondary}>
            MediReminder India v1.0
          </TText>
          <TText variant="caption" color={colors.text.muted}>
            Backend: {BACKEND_URL}
          </TText>
          <TText variant="caption" color={colors.text.muted}>
            Gemini OCR, food advisory, and literacy coaching all run on the
            server. No API keys live on this device.
          </TText>
        </Card>

        {/* Sign out */}
        <Button
          title="Sign out"
          variant="danger"
          fullWidth
          onPress={onSignOut}
          style={{ marginTop: spacing.lg }}
        />

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface.background },
  content: { padding: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface.cardLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    fontSize: 16,
    color: colors.text.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.cardLight,
    borderRadius: radius.md,
  },
});
