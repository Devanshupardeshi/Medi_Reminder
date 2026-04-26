import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Card, TText } from './Primitives';
import { colors, radius, spacing } from '@/theme/colors';
import type { FoodItem, LiteracyItem } from '@/types/medicine';

interface Props {
  literacy?: LiteracyItem[];
  food?: FoodItem[];
  /** Hide the section header (used in tight contexts like the reminder modal). */
  compact?: boolean;
}

/**
 * Renders the "AI Agent" cards: medicine literacy explanations + food
 * conflict advisories. Returns null if both lists are empty.
 */
export function AdvisoryCards({ literacy, food, compact = false }: Props) {
  const lit = literacy ?? [];
  const fd = food ?? [];
  if (lit.length === 0 && fd.length === 0) return null;

  return (
    <View>
      {!compact ? (
        <View style={styles.headerRow}>
          <View style={styles.headerIcon}>
            <Ionicons name="sparkles" size={16} color={colors.brand.green} />
          </View>
          <TText variant="eyebrow" color={colors.text.secondary}>
            AI Agent insights
          </TText>
        </View>
      ) : null}

      {lit.length > 0 ? (
        <Card style={styles.literacyCard}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBubble, { backgroundColor: '#E8F5EE' }]}>
              <MaterialCommunityIcons
                name="book-open-variant"
                size={18}
                color={colors.brand.green}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TText variant="bodyBold">What this medicine does</TText>
              <TText variant="caption" color={colors.text.secondary}>
                Plain-language explanation
              </TText>
            </View>
          </View>
          {lit.map((item, i) => (
            <View key={`${item.name}-${i}`} style={styles.itemBlock}>
              <TText variant="bodyBold" style={{ marginBottom: 2 }}>
                {item.name}
              </TText>
              <TText variant="body" color={colors.text.secondary}>
                {item.explanation}
              </TText>
            </View>
          ))}
        </Card>
      ) : null}

      {fd.length > 0 ? (
        <Card style={styles.foodCard}>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconBubble,
                { backgroundColor: colors.accent.warningSoft },
              ]}
            >
              <MaterialCommunityIcons
                name="silverware-fork-knife"
                size={18}
                color={colors.accent.warning}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TText variant="bodyBold">Food & lifestyle advice</TText>
              <TText variant="caption" color={colors.text.secondary}>
                Watch out for these conflicts
              </TText>
            </View>
          </View>
          {fd.map((item, i) => (
            <View key={`${item.name}-${i}`} style={styles.itemBlock}>
              <TText variant="bodyBold" style={{ marginBottom: 2 }}>
                {item.name}
              </TText>
              <TText variant="body" color={colors.text.secondary}>
                {item.advice}
              </TText>
            </View>
          ))}
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  headerIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5EE',
  },
  literacyCard: {
    marginBottom: spacing.sm,
    borderRadius: radius.md,
  },
  foodCard: {
    borderRadius: radius.md,
    borderColor: colors.accent.warning,
    borderWidth: 1,
    backgroundColor: colors.accent.warningSoft,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBlock: {
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surface.border,
    marginTop: spacing.sm,
  },
});
