import { create } from 'zustand';
import type {
  DraftMedicine,
  PrescriptionUploadResponse,
} from '@/types/medicine';

/**
 * Holds the in-flight prescription draft between Scan -> Review.
 * It is intentionally NOT persisted to disk — once the user confirms
 * (or backs out), we clear it.
 */
interface DraftState {
  draft: PrescriptionUploadResponse | null;
  // Editable copy of `draft.analysis.vision.medicines` so the user can
  // tweak fields without mutating the original response.
  editable: DraftMedicine[];
  setDraft: (d: PrescriptionUploadResponse) => void;
  updateMedicine: (index: number, patch: Partial<DraftMedicine>) => void;
  removeMedicine: (index: number) => void;
  reset: () => void;
}

export const usePrescriptionDraftStore = create<DraftState>((set) => ({
  draft: null,
  editable: [],
  setDraft: (d) =>
    set({
      draft: d,
      editable: d.analysis.vision.medicines.map((m) => ({
        ...m,
        // Make sure reminder_times_24h is always an array we can mutate.
        reminder_times_24h: [...(m.reminder_times_24h ?? [])],
      })),
    }),
  updateMedicine: (index, patch) =>
    set((s) => {
      const next = s.editable.slice();
      if (!next[index]) return { editable: s.editable };
      next[index] = { ...next[index], ...patch };
      return { editable: next };
    }),
  removeMedicine: (index) =>
    set((s) => ({ editable: s.editable.filter((_, i) => i !== index) })),
  reset: () => set({ draft: null, editable: [] }),
}));
