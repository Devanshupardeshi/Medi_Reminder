// MediReminder India palette — extracted from the official screen mockups.
// 5 color families, all referenced by semantic name.

export const colors = {
  brand: {
    navy: '#1E3A5F',
    navyDark: '#152D49',
    teal: '#0F766E',
    green: '#16A34A',
    greenDark: '#15803D',
  },
  status: {
    taken: '#16A34A',
    partial: '#F59E0B',
    missed: '#DC2626',
    pending: '#94A3B8',
  },
  surface: {
    background: '#F4F6F8',
    card: '#FFFFFF',
    cardLight: '#F8FAFC',
    border: '#E5E7EB',
    overlay: 'rgba(15, 23, 42, 0.45)',
  },
  text: {
    primary: '#1E293B',
    secondary: '#64748B',
    muted: '#94A3B8',
    inverse: '#FFFFFF',
  },
  accent: {
    warning: '#F97316',
    warningSoft: '#FFEDD5',
    info: '#2563EB',
    infoSoft: '#DBEAFE',
    danger: '#DC2626',
    dangerSoft: '#FEE2E2',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

export const shadows = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
} as const;
