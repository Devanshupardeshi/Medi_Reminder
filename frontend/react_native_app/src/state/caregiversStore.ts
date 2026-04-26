import { create } from 'zustand';
import type { Caregiver } from '@/types/medicine';
import {
  CaregiverInput,
  CaregiverUpdate,
  createCaregiver,
  deleteCaregiver,
  listCaregivers,
  updateCaregiver,
} from '@/services/caregiverApi';
import { ApiError } from '@/services/apiClient';

interface CaregiversState {
  items: Caregiver[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;

  load: (opts?: { silent?: boolean }) => Promise<void>;
  add: (
    input: CaregiverInput,
  ) => Promise<{ ok: boolean; message?: string; item?: Caregiver }>;
  patch: (
    id: string,
    update: CaregiverUpdate,
  ) => Promise<{ ok: boolean; message?: string }>;
  remove: (id: string) => Promise<{ ok: boolean; message?: string }>;
}

export const useCaregiversStore = create<CaregiversState>((set, get) => ({
  items: [],
  loading: false,
  refreshing: false,
  error: null,

  async load(opts) {
    const silent = opts?.silent === true;
    set((s) => ({
      loading: !silent && s.items.length === 0,
      refreshing: silent || s.items.length > 0,
      error: null,
    }));
    try {
      const items = await listCaregivers(false);
      set({
        items,
        loading: false,
        refreshing: false,
        error: null,
      });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Could not load caregivers';
      set({ loading: false, refreshing: false, error: msg });
    }
  },

  async add(input) {
    try {
      const item = await createCaregiver(input);
      set((s) => ({ items: [...s.items, item] }));
      return { ok: true, item };
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Could not add caregiver';
      return { ok: false, message: msg };
    }
  },

  async patch(id, update) {
    // Optimistic for toggles and small edits.
    const prev = get().items;
    const target = prev.find((c) => c.caregiver_id === id);
    if (!target) return { ok: false, message: 'Caregiver missing' };
    const optimistic = prev.map((c) =>
      c.caregiver_id === id ? { ...c, ...update } : c,
    );
    set({ items: optimistic });

    try {
      const item = await updateCaregiver(id, update);
      set({
        items: get().items.map((c) =>
          c.caregiver_id === id ? item : c,
        ),
      });
      return { ok: true };
    } catch (e) {
      set({ items: prev });
      const msg =
        e instanceof ApiError ? e.message : 'Could not update caregiver';
      return { ok: false, message: msg };
    }
  },

  async remove(id) {
    const prev = get().items;
    set({ items: prev.filter((c) => c.caregiver_id !== id) });
    try {
      await deleteCaregiver(id);
      return { ok: true };
    } catch (e) {
      set({ items: prev });
      const msg =
        e instanceof ApiError ? e.message : 'Could not delete caregiver';
      return { ok: false, message: msg };
    }
  },
}));
