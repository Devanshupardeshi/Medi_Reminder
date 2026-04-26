import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme/colors';
import { TText } from './Primitives';
import { LanguagePickerModal } from './LanguagePickerModal';
import { useVoiceLanguageStore } from '@/state/voiceLanguageStore';
import type { VoiceLang } from '@/services/voiceService';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showProfile?: boolean;
  showLanguage?: boolean;
  showBack?: boolean;
  onPressProfile?: () => void;
  /** Optional override. If omitted, the header opens its own
   * language picker which writes to the global voice-language store. */
  onPressLanguage?: () => void;
  onPressBack?: () => void;
  rightAction?: React.ReactNode;
}

const SHORT: Record<VoiceLang, string> = {
  en: 'EN',
  hi: 'हि',
  mr: 'मर',
};

// Deep navy header that mirrors the mockups. No gradient lib required.
export function AppHeader({
  title,
  subtitle,
  showProfile = true,
  showLanguage = true,
  showBack = false,
  onPressProfile,
  onPressLanguage,
  onPressBack,
  rightAction,
}: AppHeaderProps) {
  const lang = useVoiceLanguageStore((s) => s.lang);
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleLanguagePress = onPressLanguage ?? (() => setPickerOpen(true));

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.titleCluster}>
          <View style={styles.brandRow}>
            {showBack ? (
              <Pressable
                onPress={onPressBack}
                hitSlop={8}
                accessibilityLabel="Back"
                style={[styles.iconBtn, { marginRight: spacing.sm }]}
              >
                <Ionicons
                  name="chevron-back"
                  size={20}
                  color={colors.text.inverse}
                />
              </Pressable>
            ) : (
              <MaterialCommunityIcons
                name="pill"
                size={22}
                color={colors.brand.green}
                style={{ marginRight: 8 }}
              />
            )}
            <TText variant="h3" color={colors.text.inverse}>
              {title}
            </TText>
          </View>
          {subtitle ? (
            <TText
              variant="h2"
              color={colors.text.inverse}
              style={{ marginTop: 4 }}
            >
              {subtitle}
            </TText>
          ) : null}
        </View>

        <View style={styles.actions}>
          {rightAction}
          {showLanguage ? (
            <Pressable
              onPress={handleLanguagePress}
              style={styles.langBtn}
              hitSlop={8}
              accessibilityLabel={`Voice language. Currently ${lang.toUpperCase()}`}
            >
              <Ionicons
                name="language"
                size={18}
                color={colors.text.inverse}
              />
              <TText
                variant="caption"
                color={colors.text.inverse}
                style={styles.langCode}
              >
                {SHORT[lang]}
              </TText>
            </Pressable>
          ) : null}
          {showProfile ? (
            <Pressable
              onPress={onPressProfile}
              style={[styles.iconBtn, styles.profileBtn]}
              hitSlop={8}
              accessibilityLabel="Profile"
            >
              <Ionicons name="person" size={18} color={colors.brand.navy} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <LanguagePickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 56,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.brand.navy,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  titleCluster: { flex: 1, paddingRight: spacing.md },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  langCode: {
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  profileBtn: { backgroundColor: '#FFFFFF' },
});
