import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TText } from './Primitives';
import { colors, radius, spacing } from '@/theme/colors';
import { useVoiceLanguageStore } from '@/state/voiceLanguageStore';
import { speak, type VoiceLang } from '@/services/voiceService';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const OPTIONS: { code: VoiceLang; native: string; label: string }[] = [
  { code: 'en', native: 'English', label: 'English (India)' },
  { code: 'hi', native: 'हिन्दी', label: 'Hindi · हिन्दी' },
  { code: 'mr', native: 'मराठी', label: 'Marathi · मराठी' },
];

const PREVIEW: Record<VoiceLang, string> = {
  en: 'Time for your medicine.',
  hi: 'दवा का समय है।',
  mr: 'औषध घेण्याची वेळ आली आहे.',
};

/**
 * Bottom-sheet style modal that lets the user pick the global voice
 * language used for reminders. Tapping a language plays a short
 * preview line so the user can hear the accent before committing.
 */
export function LanguagePickerModal({ visible, onClose }: Props) {
  const lang = useVoiceLanguageStore((s) => s.lang);
  const setLang = useVoiceLanguageStore((s) => s.setLang);

  async function pick(next: VoiceLang) {
    await setLang(next);
    void speak(PREVIEW[next], next);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <TText variant="h2">Voice language</TText>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityLabel="Close"
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={20} color={colors.text.secondary} />
            </Pressable>
          </View>
          <TText
            variant="caption"
            color={colors.text.secondary}
            style={{ marginTop: 4 }}
          >
            Tap to preview. Reminders will be spoken in this language.
          </TText>

          <View style={styles.optionList}>
            {OPTIONS.map((opt) => {
              const active = opt.code === lang;
              return (
                <Pressable
                  key={opt.code}
                  onPress={() => pick(opt.code)}
                  style={({ pressed }) => [
                    styles.optionRow,
                    active && styles.optionRowActive,
                    pressed && { opacity: 0.85 },
                  ]}
                  accessibilityLabel={`Set voice language to ${opt.label}`}
                  accessibilityState={{ selected: active }}
                >
                  <View style={styles.optionTextWrap}>
                    <TText
                      variant="bodyBold"
                      color={active ? colors.brand.greenDark : colors.text.primary}
                    >
                      {opt.native}
                    </TText>
                    <TText variant="caption" color={colors.text.secondary}>
                      {opt.label}
                    </TText>
                  </View>
                  {active ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={colors.brand.greenDark}
                    />
                  ) : (
                    <Ionicons
                      name="play-circle-outline"
                      size={22}
                      color={colors.text.muted}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(11, 31, 58, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surface.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface.cardLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionList: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.cardLight,
  },
  optionRowActive: {
    borderColor: colors.brand.green,
    backgroundColor: colors.surface.card,
  },
  optionTextWrap: { flex: 1, marginRight: spacing.md, gap: 2 },
});
