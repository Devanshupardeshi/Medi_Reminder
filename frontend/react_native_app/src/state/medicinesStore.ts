import { create } from 'zustand';
import type { DoseLogItem, DoseStatus } from '@/types/medicine';
import { getDayDoses, logDose, todayInTz } from '@/services/doseApi';
import { ApiError } from '@/services/apiClient';

interface MedicinesState {
  /** Doses fetched for `currentDate`. */
  todayDoses: DoseLogItem[];
  /** YYYY-MM-DD currently loaded. */
  currentDate: string;
  loading: boolean;
  refreshing: boolean;
  /** Map of dose_log_id -> in-flight optimistic status update. */
  pending: Record<string, DoseStatus>;
  error: string | null;

  loadToday: (opts?: { silent?: boolean }) => Promise<void>;
  setStatus: (
    doseLogId: string,
    status: DoseStatus,
  ) => Promise<{ ok: boolean; message?: string }>;
}

export const useMedicinesStore = create<MedicinesState>((set, get) => ({
  todayDoses: [],
  currentDate: todayInTz(),
  loading: false,
  refreshing: false,
  pending: {},
  error: null,

  async loadToday(opts) {
    const silent = opts?.silent === true;
    set((s) => ({
      loading: !silent && s.todayDoses.length === 0,
      refreshing: silent || s.todayDoses.length > 0,
      error: null,
    }));
    try {
      const date = todayInTz();
      const items = await getDayDoses(date);
      set({
        todayDoses: items,
        currentDate: date,
        loading: false,
        refreshing: false,
        error: null,
      });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Could not load doses';
      set({ loading: false, refreshing: false, error: msg });
    }
  },

  async setStatus(doseLogId, status) {
    // Optimistic update — flip the row instantly.
    const prev = get().todayDoses;
    const prevPending = get().pending;
    const target = prev.find((d) => d.dose_log_id === doseLogId);
    if (!target) return { ok: false, message: 'Dose not found' };

    const optimistic = prev.map((d) =>
      d.dose_log_id === doseLogId
        ? {
            ...d,
            status,
            taken_at: status === 'taken' ? new Date().toISOString() : null,
          }
        : d,
    );
    set({
      todayDoses: optimistic,
      pending: { ...prevPending, [doseLogId]: status },
    });

    try {
      await logDose(
        doseLogId,
        status,
        status === 'taken' ? new Date().toISOString() : null,
      );
      // Drop pending flag.
      set((s) => {
        const next = { ...s.pending };
        delete next[doseLogId];
        return { pending: next };
      });
      return { ok: true };
    } catch (e) {
      // Roll back on failure.
      set({ todayDoses: prev, pending: prevPending });
      const msg = e instanceof ApiError ? e.message : 'Network error';
      return { ok: false, message: msg };
    }
  },
}));
