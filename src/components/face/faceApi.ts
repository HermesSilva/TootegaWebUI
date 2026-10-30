/**
 * Face recognition API — self-enroll from the profile + 1:N face login.
 *
 * Multipart upload via native fetch + FormData. ServerOnnx by default:
 * the browser uploads captured frames and the server computes the embedding.
 */

import { api, getAccessToken } from '@core/lib/api';
import type { LoginResponse } from '@core/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const FaceCaptureSource = {
  Unknown: 0, BrowserWebcam: 1, DesktopCamera: 2, MobileCamera: 3, Upload: 4,
} as const;

export interface FaceConfig {
  engine: string;
  serverEnabled: boolean;
  allowClientEmbeddings: boolean;
  requiredFrames: number;
  inputSize: number;
  minQualityScore: number;
  embedderModelUrl: string;
  /** TEMP/DEV-ONLY: when true, the camera UI records the session video and uploads it for validation. */
  debugCapture: boolean;
}

export interface FaceSelfStatus {
  enrolled: boolean;
  enrollmentCount: number;
  model: string | null;
  lastEnrolledAtUtc: string | null;
}

export interface FaceEnrollResponse {
  subjectID: string;
  enrollmentID: string;
  enrollmentCount: number;
  engine: number;
  model: string | null;
  qualityScore: number | null;
}

function multipartHeaders(): HeadersInit {
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function postMultipart<T>(pUrl: string, pForm: FormData): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${pUrl}`, {
    method: 'POST',
    headers: multipartHeaders(),
    body: pForm,
  });
  const body = await response.json().catch(() => null);
  const inner = body?.data ?? body;
  if (!response.ok) {
    const msg = inner?.message ?? inner?.code ?? body?.message;
    const err = new Error(msg || '__FACE_REQUEST_FAILED__') as Error & { status?: number };
    err.status = response.status;
    throw err;
  }
  return inner as T;
}

function framesForm(
  pFrames: Blob[], pThumbnail: Blob | null, pSource: number, pQuality: number | null,
  pDebugVideo?: Blob | null,
): FormData {
  const form = new FormData();
  pFrames.forEach((f, i) => form.append('frames', f, `frame-${i}.jpg`));
  form.append('metadata', JSON.stringify({ captureSource: pSource, qualityScore: pQuality }));
  if (pThumbnail) form.append('thumbnail', pThumbnail, 'thumb.jpg');
  // TEMP/DEV-ONLY: session video for recognition validation (ignored by the server unless capture is on).
  if (pDebugVideo) form.append('debugVideo', pDebugVideo, 'session.webm');
  return form;
}

// ---- Config (anonymous-readable; login page reads it) ----
// Reconhecimento facial é fator do Tootega.ID; o front acessa por Front → SYS → ID (D47),
// sob "/sys/identity/faces/*" (o SYS relaia ao ID). As leituras são SILENCIOSAS: se o endpoint
// não responder, a falha não estoura o modal global de erro — o recurso apenas some.
export function getFaceConfig(signal?: AbortSignal): Promise<FaceConfig> {
  return api.get<FaceConfig>('/sys/identity/faces/config', signal, true);
}

// ---- Self-service (profile) ----
export function getFaceSelfStatus(signal?: AbortSignal): Promise<FaceSelfStatus> {
  return api.get<FaceSelfStatus>('/sys/identity/faces/self', signal, true);
}

export function selfEnrollFace(
  pFrames: Blob[], pThumbnail: Blob | null, pSource: number,
  pPassword: string, pTwoFactorCode?: string, pDebugVideo?: Blob | null,
): Promise<FaceEnrollResponse> {
  const form = framesForm(pFrames, pThumbnail, pSource, null, pDebugVideo);
  // Step-up re-auth: enrolling a login factor requires the account password (+ 2FA when enabled).
  form.append('password', pPassword);
  if (pTwoFactorCode) form.append('twoFactorCode', pTwoFactorCode);
  return postMultipart<FaceEnrollResponse>('/sys/identity/faces/self/enroll', form);
}

export function deleteSelfFace(): Promise<void> {
  return api.delete<void>('/sys/identity/faces/self');
}

// ---- Face login (anonymous, 1:N) → same login envelope as password login ----
export function faceLogin(pFrames: Blob[], pSource: number, pDebugVideo?: Blob | null): Promise<LoginResponse> {
  return postMultipart<LoginResponse>('/sys/identity/faces/login', framesForm(pFrames, null, pSource, null, pDebugVideo));
}
