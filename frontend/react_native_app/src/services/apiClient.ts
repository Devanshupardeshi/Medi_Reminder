import { BACKEND_URL } from '@/config/env';
import { secureStorage } from './secureStorage';

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(message: string, status: number, detail: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  formData?: FormData;
  auth?: boolean; // attach Authorization: Bearer <token>
  timeoutMs?: number;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const base = BACKEND_URL.replace(/\/+$/, '');
  const url = new URL(`${base}${path.startsWith('/') ? path : `/${path}`}`);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

// On-logout listener — cleared by caller (auth store) when a token is wiped.
type LogoutHandler = () => void;
let onUnauthorized: LogoutHandler | null = null;
export function setUnauthorizedHandler(fn: LogoutHandler | null): void {
  onUnauthorized = fn;
}

export async function apiRequest<T>(opts: RequestOptions): Promise<T> {
  const {
    method = 'GET',
    path,
    query,
    body,
    formData,
    auth = false,
    timeoutMs = 60_000,
    signal,
  } = opts;

  const headers: Record<string, string> = { Accept: 'application/json' };
  let payload: BodyInit | undefined;

  if (formData) {
    payload = formData as unknown as BodyInit;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  if (auth) {
    const token = await secureStorage.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: payload,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError('Request timed out. Check your internet.', 0, null);
    }
    throw new ApiError(
      'Network error. Is the backend reachable?',
      0,
      (err as Error).message,
    );
  }
  clearTimeout(timer);

  let json: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }

  if (!res.ok) {
    const detail =
      (json as { detail?: unknown })?.detail ?? `HTTP ${res.status}`;

    // Build a useful message. FastAPI 422 returns
    //   detail: [{ loc: ["body", "image"], msg: "...", type: "..." }, ...]
    // We surface the *field name* + *msg* so the user (and v0 in the logs)
    // can see exactly which field the backend rejected — vital for
    // diagnosing 422s during prescription upload.
    let message: string;
    if (typeof detail === 'string') {
      message = detail;
    } else if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as {
        loc?: unknown[];
        msg?: string;
        type?: string;
      };
      const field =
        Array.isArray(first.loc) && first.loc.length > 0
          ? String(first.loc[first.loc.length - 1])
          : '';
      const msg = first.msg ?? `HTTP ${res.status}`;
      message = field ? `${field}: ${msg}` : msg;
    } else {
      message = `HTTP ${res.status}`;
    }

    // Always log the raw response on non-2xx so we can debug exactly
    // what the backend is complaining about.
    console.log(
      '[v0] apiRequest error',
      JSON.stringify({
        path,
        method,
        status: res.status,
        detail,
      }),
    );

    if (res.status === 401 && auth && onUnauthorized) {
      onUnauthorized();
    }
    throw new ApiError(message, res.status, detail);
  }

  return json as T;
}
