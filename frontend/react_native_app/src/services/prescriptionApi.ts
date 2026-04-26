import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { apiRequest, ApiError } from './apiClient';
import type {
  ConfirmedMedicine,
  DraftMedicine,
  PrescriptionUploadResponse,
} from '@/types/medicine';

interface UploadArgs {
  uri: string;
  language?: string; // 2..8 chars; defaults to 'en'
  signal?: AbortSignal;
}

/**
 * Resize the picked image to a max-2400px long edge at JPEG quality 0.92.
 *
 * Why a moderate resize instead of full sensor resolution:
 *   Modern Android phones (50-108 MP) produce 6-15 MB JPEGs at full
 *   resolution. Uploading that over a dev tunnel takes 30-90s on its
 *   own, and the proxy times out at ~100s before the backend even
 *   starts OCR. 2400 px on the long edge is more than enough resolution
 *   for any printed or handwritten prescription text — Google Vision and
 *   the backend OCR pipeline both downscale to ~2000 px internally
 *   anyway. Quality 0.92 is visually lossless for text. Result: a
 *   400 KB - 1 MB JPEG that uploads in 2-5s and gives Vision exactly
 *   the same answer as the 8 MB original.
 */
async function preprocessImage(
  uri: string,
): Promise<{ uri: string; sizeBytes: number | null }> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 2400 } }],
      {
        compress: 0.92,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );
    let sizeBytes: number | null = null;
    try {
      const info = await FileSystem.getInfoAsync(result.uri);
      if (info.exists && 'size' in info && typeof info.size === 'number') {
        sizeBytes = info.size;
      }
    } catch {
      // Non-fatal — size is for logging only.
    }
    return { uri: result.uri, sizeBytes };
  } catch (e) {
    console.log(
      '[v0] preprocessImage failed, falling back to original',
      String(e),
    );
    return { uri, sizeBytes: null };
  }
}

/**
 * POST /prescriptions/upload (multipart).
 * Backend runs Vision -> Literacy -> Food in the same request and returns
 * the draft analysis. NO medicines are persisted until /confirm runs.
 */
export async function uploadPrescription({
  uri,
  language = 'en',
  signal,
}: UploadArgs): Promise<PrescriptionUploadResponse> {
  const t0 = Date.now();
  const { uri: finalUri, sizeBytes } = await preprocessImage(uri);
  const tPrep = Date.now();
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const name = `prescription-${stamp}.jpg`;

  console.log(
    '[v0] uploadPrescription preparing',
    JSON.stringify({
      originalUri: uri,
      preparedUri: finalUri,
      sizeBytes,
      sizeKB: sizeBytes ? Math.round(sizeBytes / 1024) : null,
      prepMs: tPrep - t0,
    }),
  );

  const form = new FormData();
  form.append('language', language);
  form.append(
    'image',
    // React Native's FormData accepts the { uri, name, type } shape.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { uri: finalUri, name, type: 'image/jpeg' } as any,
  );

  // Prove the file part is actually in the multipart body. RN's
  // FormData exposes a non-standard `_parts` array; logging its shape
  // is the fastest way to confirm the upload contains the image.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts = (form as any)._parts as Array<[string, unknown]> | undefined;
  console.log(
    '[v0] uploadPrescription FormData parts',
    JSON.stringify(
      parts?.map(([key, value]) => {
        if (value && typeof value === 'object' && 'uri' in (value as object)) {
          const v = value as { uri: string; name: string; type: string };
          return { key, fileName: v.name, mime: v.type, hasUri: !!v.uri };
        }
        return { key, value: String(value).slice(0, 40) };
      }) ?? [],
    ),
  );

  try {
    const result = await apiRequest<PrescriptionUploadResponse>({
      method: 'POST',
      path: '/prescriptions/upload',
      formData: form,
      auth: true,
      // Vision + Literacy + Food run inline. The 2400 px image plus
      // backend processing should comfortably finish in under 60 s.
      timeoutMs: 120_000,
      signal,
    });
    console.log(
      '[v0] uploadPrescription success',
      JSON.stringify({
        uploadMs: Date.now() - tPrep,
        totalMs: Date.now() - t0,
        status: result.status,
      }),
    );
    return result;
  } catch (e) {
    console.log(
      '[v0] uploadPrescription failed',
      JSON.stringify({
        uploadMs: Date.now() - tPrep,
        totalMs: Date.now() - t0,
        error: e instanceof Error ? e.message : String(e),
      }),
    );
    throw e;
  }
}

/**
 * Translates raw upload errors into clear, actionable user messages.
 * Returns the message PLUS a `retryable` flag so the UI can decide
 * whether to show a "Try again" button or force the user to retake.
 */
export function describeUploadError(err: unknown): {
  message: string;
  retryable: boolean;
} {
  if (err instanceof ApiError) {
    const detail = String(err.message ?? '').toLowerCase();

    // Network/timeout family.
    if (
      err.status === 0 ||
      err.status === 504 ||
      err.status === 408 ||
      err.status === 502 ||
      err.status === 503
    ) {
      return {
        message:
          'The server took too long to analyse this prescription. Tap Try again — the photo is already optimised.',
        retryable: true,
      };
    }

    // Duplicate detection from backend.
    if (
      err.status === 409 ||
      detail.includes('duplicate') ||
      detail.includes('already uploaded')
    ) {
      return {
        message:
          'This exact prescription was already uploaded. Take a fresh photo or pick a different page.',
        retryable: false,
      };
    }

    // Vision found nothing.
    if (
      detail.includes('no medicine') ||
      detail.includes('not detected') ||
      detail.includes('vision')
    ) {
      return {
        message:
          'No medicines were detected. Lay the paper flat, fill the frame, and avoid shadows or glare.',
        retryable: false,
      };
    }

    if (err.status === 401) {
      return {
        message: 'Your session expired. Please sign in again.',
        retryable: false,
      };
    }

    if (err.status === 413) {
      return {
        message:
          'The image is too large. Retake at a closer distance — we will compress it automatically.',
        retryable: false,
      };
    }

    return { message: err.message || 'Upload failed.', retryable: true };
  }

  return {
    message:
      'Could not reach the server. Check your connection and try again.',
    retryable: true,
  };
}

interface ConfirmArgs {
  prescriptionId: string;
  /**
   * Optional edited medicines list. Omit to let the server reuse the
   * draft saved during upload. Each item may include `reminder_times_24h`.
   */
  medicines?: DraftMedicine[];
}

interface ConfirmResponse {
  success: boolean;
  prescription_id: string;
  status: 'confirmed';
  medicines: ConfirmedMedicine[];
  idempotent: boolean;
}

/**
 * POST /prescriptions/{id}/confirm — persists medicines and generates
 * dose schedules. 409 if not in `awaiting_confirmation`.
 */
export async function confirmPrescription({
  prescriptionId,
  medicines,
}: ConfirmArgs): Promise<ConfirmResponse> {
  return apiRequest<ConfirmResponse>({
    method: 'POST',
    path: `/prescriptions/${prescriptionId}/confirm`,
    body: medicines ? { medicines } : {},
    auth: true,
    timeoutMs: 30_000,
  });
}
