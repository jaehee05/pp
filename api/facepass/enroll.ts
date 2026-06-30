// 페이스패스(Toss FacePass) 등록 콜백 수신.
// 토스 Front 단말의 plugin webview 가 enroll 성공 후 이 엔드포인트로 POST.
// 학생의 faceId 를 appState/pp.students.v1 문서에 직접 갱신해 운영 화면에 자동 반영
// (Firestore onSnapshot 으로 클라이언트 rehydrate).
//
// 본 엔드포인트는 토스 Front Plugin SDK 의 실제 콜백 시그니처가 확정되기 전까지의
// 스텁이다. 운영 측에서 토스플레이스 가맹점 등록 + Front 단말 도입 + Plugin SDK 키 발급
// 후 시그니처 확인되면 (1) 인증 헤더 검증, (2) 페이로드 파싱, (3) 추가 메타(quality 등) 저장
// 을 채워 넣을 것.
//
// 요청 (현재 가정):
//   POST { studentId: string, faceId: string }
//   또는 GET ?studentId=...&faceId=... (단말이 단순 redirect 콜백을 보낼 때)
//
// 환경 (옵션):
//   FACEPASS_CALLBACK_SECRET   공유 시크릿 (헤더 x-facepass-secret 비교 — 토스 시그니처
//                              구조 공개되면 HMAC 검증으로 교체)
//   FIREBASE_PROJECT_ID, GOOGLE_APPLICATION_CREDENTIALS_JSON  Firebase Admin SDK 용

import type { VercelRequest, VercelResponse } from '@vercel/node';

const APP_STATE_DOC = 'pp.students.v1';

interface StudentLike {
  id: string;
  faceId?: string;
  [k: string]: unknown;
}
interface StudentsState {
  list: StudentLike[];
  [k: string]: unknown;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // POST + GET 모두 허용 (단말이 form / redirect 형태로 보낼 수 있음).
  const params = req.method === 'GET' ? (req.query as Record<string, string | string[]>) : await readBody(req);
  const studentId = strOf(params.studentId);
  const faceId = strOf(params.faceId);

  if (!studentId || !faceId) {
    return res.status(400).json({ ok: false, error: 'studentId, faceId required' });
  }

  // 임시 시크릿 검증 — 실제 SDK 시그니처 확정되면 교체.
  const expected = process.env.FACEPASS_CALLBACK_SECRET;
  if (expected) {
    const got = headerStr(req, 'x-facepass-secret');
    if (got !== expected) return res.status(401).json({ ok: false, error: 'invalid secret' });
  }

  const admin = await loadFirebaseAdmin();
  if (!admin) {
    return res.status(200).json({ ok: true, mock: true, note: 'firebase-admin not configured; enrollment accepted but not persisted' });
  }

  const db = admin.firestore();
  const matched = await applyFaceIdToStudent(db, studentId, faceId);
  if (!matched) return res.status(404).json({ ok: false, error: 'student not found' });

  return res.status(200).json({ ok: true, studentId, faceId });
}

function strOf(v: unknown): string {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}
function headerStr(req: VercelRequest, name: string): string {
  const v = req.headers[name.toLowerCase()];
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

async function readBody(req: VercelRequest): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  try {
    for await (const chunk of req as unknown as AsyncIterable<Buffer | string>) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
  } catch { /* ignore */ }
  if (chunks.length === 0) {
    const b = (req as VercelRequest & { body?: unknown }).body;
    if (b && typeof b === 'object') return b as Record<string, unknown>;
    if (typeof b === 'string') { try { return JSON.parse(b); } catch { return {}; } }
    return {};
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return JSON.parse(raw); }
  catch {
    // x-www-form-urlencoded fallback
    const params: Record<string, string> = {};
    for (const pair of raw.split('&')) {
      const [k, v = ''] = pair.split('=');
      if (k) params[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
    }
    return params;
  }
}

interface FirebaseAdminLike {
  firestore: () => {
    collection: (name: string) => {
      doc: (id: string) => {
        get: () => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
        set: (data: Record<string, unknown>) => Promise<unknown>;
      };
    };
  };
}

async function loadFirebaseAdmin(): Promise<FirebaseAdminLike | null> {
  try {
    const mod = await import('firebase-admin');
    const admin = (mod as { default?: unknown }).default ?? mod;
    const adminAny = admin as {
      apps: unknown[];
      initializeApp: (opts: Record<string, unknown>) => unknown;
      credential: { cert: (sa: Record<string, unknown>) => unknown; applicationDefault: () => unknown };
      firestore: () => unknown;
    };
    if (!adminAny.apps?.length) {
      const saJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ?? process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      let credential: unknown;
      if (saJson) {
        const decoded = saJson.trim().startsWith('{') ? saJson : Buffer.from(saJson, 'base64').toString('utf8');
        const sa = JSON.parse(decoded);
        credential = adminAny.credential.cert(sa);
      } else {
        credential = adminAny.credential.applicationDefault();
      }
      const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FB_PROJECT_ID ?? process.env.GCLOUD_PROJECT;
      adminAny.initializeApp({ credential, projectId });
    }
    return { firestore: () => adminAny.firestore() } as unknown as FirebaseAdminLike;
  } catch {
    return null;
  }
}

async function applyFaceIdToStudent(
  db: ReturnType<FirebaseAdminLike['firestore']>,
  studentId: string,
  faceId: string,
): Promise<boolean> {
  const docRef = db.collection('appState').doc(APP_STATE_DOC);
  const snap = await docRef.get();
  if (!snap.exists) return false;
  const data = snap.data() ?? {};
  const json = (data as { json?: string }).json;
  if (!json) return false;

  let parsed: { state?: StudentsState } | StudentsState;
  try { parsed = JSON.parse(json); } catch { return false; }
  const wrapped = (parsed as { state?: StudentsState }).state;
  const state: StudentsState = (wrapped ?? parsed) as StudentsState;
  const isWrapped = !!wrapped;

  if (!Array.isArray(state.list)) return false;
  let matched = false;
  const newList = state.list.map((s) => {
    if (s.id !== studentId) return s;
    matched = true;
    return { ...s, faceId };
  });
  if (!matched) return false;
  const newState: StudentsState = { ...state, list: newList };
  const newJson = JSON.stringify(isWrapped ? { ...(parsed as object), state: newState } : newState);
  await docRef.set({ json: newJson, updatedAt: Date.now() });
  return true;
}

export const config = { api: { bodyParser: false } };
