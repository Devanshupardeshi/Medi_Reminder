import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  ConfirmedMedicine,
  FoodItem,
  LiteracyItem,
  PrescriptionAnalysis,
} from '@/types/medicine';

const STORAGE_KEY = 'mr.aiInsights.v1';

export interface MedicineInsights {
  literacy: LiteracyItem[];
  food: FoodItem[];
  source_prescription_id?: string;
  language?: string;
  saved_at: string;
}

/**
 * Map of medicine_id -> insights. The backend returns literacy/food
 * advisories ONLY in the `/prescriptions/upload` response and does NOT
 * persist them server-side. We stash them here keyed by the confirmed
 * medicine_id so detail screens and reminder screens can show them later.
 */
interface AiInsightsState {
  hydrated: boolean;
  byMedicine: Record<string, MedicineInsights>;
  hydrate: () => Promise<void>;
  /** Match advisories from a prescription analysis to confirmed medicines by name. */
  saveFromConfirm: (
    analysis: PrescriptionAnalysis,
    confirmed: ConfirmedMedicine[],
    opts: { prescriptionId: string; language: string },
  ) => Promise<void>;
  get: (medicineId: string) => MedicineInsights | undefined;
  clear: () => Promise<void>;
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function pickByName<T extends { name: string }>(
  items: T[],
  candidate: string,
): T[] {
  const target = normalizeName(candidate);
  if (!target) return [];
  // Exact match first, then partial.
  const exact = items.filter((it) => normalizeName(it.name) === target);
  if (exact.length) return exact;
  return items.filter((it) => {
    const n = normalizeName(it.name);
    return n.length >= 3 && (n.includes(target) || target.includes(n));
  });
}

export const useAiInsightsStore = create<AiInsightsState>((set, get) => ({
  hydrated: false,
  byMedicine: {},

  async hydrate() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, MedicineInsights>;
        set({ byMedicine: parsed, hydrated: true });
        return;
      }
    } catch {
      // Corrupted blob: ignore and start clean.
    }
    set({ hydrated: true });
  },

  async saveFromConfirm(analysis, confirmed, opts) {
    const next: Record<string, MedicineInsights> = { ...get().byMedicine };
    const literacyItems = analysis.literacy?.items ?? [];
    const foodItems = analysis.food?.items ?? [];
    const now = new Date().toISOString();

    for (const med of confirmed) {
      const literacy = pickByName(literacyItems, med.name);
      const food = pickByName(foodItems, med.name);
      if (literacy.length === 0 && food.length === 0) continue;
      next[med.medicine_id] = {
        literacy,
        food,
        source_prescription_id: opts.prescriptionId,
        language: opts.language,
        saved_at: now,
      };
    }

    set({ byMedicine: next });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage is best-effort; UI still has the in-memory copy.
    }
  },

  get(medicineId) {
    return get().byMedicine[medicineId];
  },

  async clear() {
    set({ byMedicine: {} });
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  },
}));
