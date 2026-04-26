// Schemas mirror the FastAPI backend response shapes.

export type DoseStatus = 'pending' | 'taken' | 'missed' | 'skipped';

export interface DraftMedicine {
  name: string;
  dosage_pattern: string;
  duration_days: number | null;
  instructions: string | null;
  confidence: number;
  name_legible?: boolean;
  reminder_times_24h: string[];
}

export interface LiteracyItem {
  name: string;
  explanation: string;
}

export interface FoodItem {
  name: string;
  advice: string;
}

export interface PrescriptionAnalysis {
  vision: { status: string; medicines: DraftMedicine[]; confidence: number };
  literacy: {
    status: string;
    items: LiteracyItem[];
    confidence: number;
    error?: string;
  };
  food: {
    status: string;
    items: FoodItem[];
    confidence: number;
    error?: string;
  };
  draft_ready_at?: string;
}

export interface PrescriptionUploadResponse {
  success: boolean;
  prescription_id: string;
  event_id: string;
  status: 'awaiting_confirmation' | 'failed' | 'processing' | 'confirmed';
  user_id: string;
  language: string;
  image_url: string;
  created_at: string;
  updated_at: string;
  analysis: PrescriptionAnalysis;
}

export interface ConfirmedMedicine {
  medicine_id: string;
  name: string;
  dosage_pattern: string;
  frequency: number;
  duration_days: number | null;
  instructions: string | null;
  confidence: number;
  reminder_times_24h: string[];
}

export interface DoseLogItem {
  dose_log_id: string;
  medicine_id: string;
  medicine_name: string;
  scheduled_for: string;
  status: DoseStatus;
  taken_at: string | null;
}

export interface CalendarDay {
  date: string;
  total: number;
  taken: number;
  missed: number;
  skipped: number;
  pending: number;
}

export interface Caregiver {
  caregiver_id: string;
  user_id: string;
  display_name: string;
  email: string;
  phone: string | null;
  relationship_label: string | null;
  is_active: boolean;
  notify_on_missed_dose: boolean;
  created_at: string;
  updated_at: string;
}
