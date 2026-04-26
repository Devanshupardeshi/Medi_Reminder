import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, TText } from '@/ui/Primitives';
import { colors, radius, spacing } from '@/theme/colors';
import { APP_NAME } from '@/config/env';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <MaterialCommunityIcons
            name="pill"
            size={28}
            color={colors.brand.green}
          />
          <TText variant="h2" color={colors.text.inverse}>
            {APP_NAME}
          </TText>
        </View>

        <View style={styles.heroBlock}>
          <View style={styles.illustrationWrap}>
            <MaterialCommunityIcons
              name="prescription"
              size={120}
              color={colors.brand.navy}
            />
          </View>

          <TText
            variant="h1"
            color={colors.text.inverse}
            style={{ textAlign: 'center', marginTop: spacing.xl }}
          >
            Namaste, Welcome!
          </TText>
          <TText
            variant="body"
            color="rgba(255,255,255,0.85)"
            style={{
              textAlign: 'center',
              marginTop: spacing.sm,
              paddingHorizontal: spacing.lg,
            }}
          >
            Your daily medicine companion. Scan a prescription, get bilingual
            reminders, and keep family informed.
          </TText>
        </View>

        <View style={styles.cta}>
          <Button
            title="Sign in with email"
            size="lg"
            fullWidth
            onPress={() => router.push('/auth/email')}
          />
          <TText
            variant="caption"
            color="rgba(255,255,255,0.7)"
            style={{ textAlign: 'center', marginTop: spacing.md }}
          >
            We&apos;ll send a one-time code to your inbox.
          </TText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.brand.navy },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  illustrationWrap: {
    width: 200,
    height: 200,
    borderRadius: radius.xl,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: {
    paddingTop: spacing.xl,
  },
});
