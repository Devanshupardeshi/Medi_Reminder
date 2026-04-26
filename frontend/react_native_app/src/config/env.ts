// Single source of truth for the backend base URL.
// Override at build time via EXPO_PUBLIC_BACKEND_URL in `.env`.
export const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ??
  'https://iit-pune-hackathon-backend.onrender.com';

export const APP_NAME = 'MediReminder India';
export const DEFAULT_TZ = 'Asia/Kolkata';
