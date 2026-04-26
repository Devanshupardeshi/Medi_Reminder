import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  TextStyle,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import { colors, radius, shadows, spacing } from '@/theme/colors';

/* ---------- Screen ---------- */

export function Screen({ children, style, ...rest }: ViewProps) {
  return (
    <View
      {...rest}
      style={[
        { flex: 1, backgroundColor: colors.surface.background },
        style as StyleProp<ViewStyle>,
      ]}
    >
      {children}
    </View>
  );
}

/* ---------- Text ---------- */

type TextVariant =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'body'
  | 'bodyBold'
  | 'caption'
  | 'eyebrow'
  | 'mono';

interface TTextProps extends TextProps {
  variant?: TextVariant;
  color?: string;
}

const textStyles: Record<TextVariant, TextStyle> = {
  h1: { fontSize: 26, fontWeight: '700', lineHeight: 32 },
  h2: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  h3: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  bodyBold: { fontSize: 15, fontWeight: '600', lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  mono: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
};

export function TText({
  variant = 'body',
  color,
  style,
  ...rest
}: TTextProps) {
  return (
    <Text
      {...rest}
      style={[
        textStyles[variant],
        { color: color ?? colors.text.primary },
        style,
      ]}
    />
  );
}

/* ---------- Card ---------- */

interface CardProps extends ViewProps {
  padded?: boolean;
}

export function Card({ padded = true, style, children, ...rest }: CardProps) {
  return (
    <View
      {...rest}
      style={[
        styles.card,
        padded && { padding: spacing.lg },
        style as StyleProp<ViewStyle>,
      ]}
    >
      {children}
    </View>
  );
}

/* ---------- Button ---------- */

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger';

interface BtnProps extends Omit<PressableProps, 'children'> {
  title: string;
  variant?: BtnVariant;
  loading?: boolean;
  fullWidth?: boolean;
  size?: 'md' | 'lg';
  icon?: React.ReactNode;
}

export function Button({
  title,
  variant = 'primary',
  loading,
  fullWidth,
  size = 'md',
  icon,
  style,
  disabled,
  ...rest
}: BtnProps) {
  const palette: Record<
    BtnVariant,
    { bg: string; fg: string; border?: string }
  > = {
    primary: { bg: colors.brand.green, fg: colors.text.inverse },
    secondary: { bg: colors.brand.navy, fg: colors.text.inverse },
    ghost: {
      bg: colors.surface.card,
      fg: colors.brand.navy,
      border: colors.surface.border,
    },
    success: { bg: colors.status.taken, fg: colors.text.inverse },
    danger: { bg: colors.accent.danger, fg: colors.text.inverse },
  };
  const p = palette[variant];

  return (
    <Pressable
      {...rest}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        size === 'lg' && styles.btnLg,
        fullWidth && { alignSelf: 'stretch' },
        {
          backgroundColor: p.bg,
          opacity: pressed || disabled ? 0.75 : 1,
        },
        p.border ? { borderWidth: 1, borderColor: p.border } : null,
        style as StyleProp<ViewStyle>,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <>
          {icon ? <View style={{ marginRight: spacing.sm }}>{icon}</View> : null}
          <TText variant="bodyBold" color={p.fg}>
            {title}
          </TText>
        </>
      )}
    </Pressable>
  );
}

/* ---------- Pill / Badge ---------- */

interface BadgeProps {
  label: string;
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const map = {
    success: { bg: '#DCFCE7', fg: colors.brand.greenDark },
    warning: { bg: colors.accent.warningSoft, fg: colors.accent.warning },
    danger: { bg: colors.accent.dangerSoft, fg: colors.accent.danger },
    info: { bg: colors.accent.infoSoft, fg: colors.accent.info },
    neutral: { bg: colors.surface.cardLight, fg: colors.text.secondary },
  } as const;
  const t = map[tone];
  return (
    <View
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: 4,
        backgroundColor: t.bg,
        borderRadius: radius.pill,
        alignSelf: 'flex-start',
      }}
    >
      <TText variant="caption" color={t.fg} style={{ fontWeight: '600' }}>
        {label}
      </TText>
    </View>
  );
}

/* ---------- Divider ---------- */

export function Divider({ vertical }: { vertical?: boolean }) {
  return (
    <View
      style={{
        backgroundColor: colors.surface.border,
        ...(vertical
          ? { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' }
          : { height: StyleSheet.hairlineWidth, alignSelf: 'stretch' }),
      }}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    ...shadows.card,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    minHeight: 48,
  },
  btnLg: {
    minHeight: 56,
    paddingVertical: spacing.lg,
  },
});
