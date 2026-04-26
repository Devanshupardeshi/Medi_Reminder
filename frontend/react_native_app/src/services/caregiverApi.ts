import { apiRequest } from './apiClient';
import type { Caregiver } from '@/types/medicine';

export interface CaregiverInput {
  display_name: string;
  email: string;
  phone?: string | null;
  relationship_label?: string | null;
  is_active?: boolean;
  notify_on_missed_dose?: boolean;
}

export type CaregiverUpdate = Partial<CaregiverInput>;

interface ListResponse {
  success: boolean;
  items: Caregiver[];
}

interface ItemResponse {
  success: boolean;
  item: Caregiver;
}

interface DeleteResponse {
  success: boolean;
  message: string;
  caregiver_id: string;
}

export async function listCaregivers(
  includeInactive = false,
): Promise<Caregiver[]> {
  const res = await apiRequest<ListResponse>({
    path: '/caregivers',
    query: { include_inactive: includeInactive },
    auth: true,
  });
  return res.items ?? [];
}

export async function createCaregiver(
  input: CaregiverInput,
): Promise<Caregiver> {
  const res = await apiRequest<ItemResponse>({
    method: 'POST',
    path: '/caregivers',
    body: input,
    auth: true,
  });
  return res.item;
}

export async function updateCaregiver(
  caregiverId: string,
  patch: CaregiverUpdate,
): Promise<Caregiver> {
  const res = await apiRequest<ItemResponse>({
    method: 'PATCH',
    path: `/caregivers/${caregiverId}`,
    body: patch,
    auth: true,
  });
  return res.item;
}

export async function getCaregiver(caregiverId: string): Promise<Caregiver> {
  const res = await apiRequest<ItemResponse>({
    path: `/caregivers/${caregiverId}`,
    auth: true,
  });
  return res.item;
}

export async function deleteCaregiver(caregiverId: string): Promise<void> {
  await apiRequest<DeleteResponse>({
    method: 'DELETE',
    path: `/caregivers/${caregiverId}`,
    auth: true,
  });
}
