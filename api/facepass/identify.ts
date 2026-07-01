// 페이스패스(Toss FacePass) 출입 인증 콜백.
// 키오스크/단말에서 학생이 얼굴 인증하면 토스 Front Plugin → 이 엔드포인트로 POST.
// faceId 로 학생 조회 → 현재 상태 토글 (out → in / in → out).
//
// 본 엔드포인트는 토스 Front Plugin SDK 의 실제 콜백 시그니처가 확정되기 전 스텁이다.
// 실제 SDK 페이로드 / HMAC 검증 / 멱등 키 (예: 동일 face_identify 가 5초 내 중복 들어옴)
// 처리는 SDK 공개 스펙 확인 후 보강.
//
// 요청 (현재 가정):
//   POST { faceId: string, at?: number }  // at = 단말 측 timestamp (ms). 누락 시 서버 시각.
//
// 환경 (옵션): FACEPASS_CALLBACK_SECRET (헤더 x-facepass-secret 비교)

import type { VercelRequest, VercelResponse } from '@vercel/node';

const STUDENTS_DOC = 'pp.students.v1';
const ATTENDANCE_DOC = 'pp.attendance.v1';

// 같은 faceId 가 짧은 간격으로 두 번 들어오면 한 번만 처리. (단말 재시도/중복 방지)
const DEDUPE_WINDOW_MS = 5000;

interface StudentLike { id: string; faceId?: string; name?: string; [k: string]: unknown }
interface StudentsState { list: StudentLike[]; [k: string]: unknown }

interface LogLike {
  id: string;
  studentId: string;
  type: 'enter' | 'exit' | 'leave_temp' | 'return';
  source: 'fingerprint' | 'manual' | 'qr' | 'face';
  at: number;
  seatId?: string;
}
interface AttStateLike {
  studentId: string;
  state: 'in' | 'out' | 'temp_out';
  lastEnterAt?: number;
  lastEventAt: number;
  seatId?: string;
}
interface AttendanceState {
  state: Record<string, AttStateLike>;
  logs: LogLike[];
  [k: string]: unknown;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const params = req.method === 'GET' ? (req.query as Record<string, string | string[]>) : await readBody(req);
  const faceId = strOf(params.faceId);
  const at = Number(strOf(params.at)) || Date.now();
  if (!faceId) return res.status(400).json({ ok: false, error: 'faceId required' });

  const expected = process.env.FACEPASS_CALLBACK_SECRET;
  if (expected) {
    const got = headerStr(req, 'x-facepass-secret');
    if (got !== expected) return res.status(401).json({ ok: false, error: 'invalid secret' });
  }

  const admin = await loadFirebaseAdmin();
  if (!admin) {
    return res.status(200).json({ ok: true, mock: true, note: 'firebase-admin not configured; identify accepted but not persisted' });
  }
  const db = admin.firestore() as ReturnType<FirebaseAdminLike['firestore']>;

  const studentId = await findStudentByFaceId(db, faceId);
  if (!studentId) return res.status(404).json({ ok: false, error: 'student not found for faceId' });

  const result = await toggleAttendance(db, studentId, at);
  return res.status(200).json({ ok: true, studentId, ...result });
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
  } catch { /* */ }
  if (chunks.length === 0) {
    const b = (req as VercelRequest & { body?: unknown }).body;
    if (b && typeof b === 'object') return b as Record<string, unknown>;
    if (typeof b === 'string') { try { return JSON.parse(b); } catch { return {}; } }
    return {};
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return JSON.parse(raw); }
  catch {
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

let cachedFirebase: FirebaseAdminLike | null = null;
async function loadFirebaseAdmin(): Promise<FirebaseAdminLike | null> {
  if (cachedFirebase) return cachedFirebase;
  try {
    const appMod = await import('firebase-admin/app');
    const fsMod = await import('firebase-admin/firestore');
    const { initializeApp, getApps, cert } = appMod as unknown as {
      initializeApp: (opts: Record<string, unknown>) => unknown;
      getApps: () => unknown[];
      cert: (sa: Record<string, unknown>) => unknown;
    };
    const { getFirestore } = fsMod as unknown as { getFirestore: () => unknown };
    if (getApps().length === 0) {
      const saJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ?? process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      if (!saJson) return null;
      const decoded = saJson.trim().startsWith('{') ? saJson : Buffer.from(saJson, 'base64').toString('utf8');
      const sa = JSON.parse(decoded);
      const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FB_PROJECT_ID ?? process.env.GCLOUD_PROJECT ?? (sa.project_id as string | undefined);
      initializeApp({ credential: cert(sa), projectId });
    }
    cachedFirebase = { firestore: () => getFirestore() } as unknown as FirebaseAdminLike;
    return cachedFirebase;
  } catch (e) {
    console.error('[facepass/identify] firebase-admin load failed', e);
    return null;
  }
}

async function findStudentByFaceId(db: ReturnType<FirebaseAdminLike['firestore']>, faceId: string): Promise<string | null> {
  const snap = await db.collection('appState').doc(STUDENTS_DOC).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  const json = (data as { json?: string }).json;
  if (!json) return null;
  let parsed: { state?: StudentsState } | StudentsState;
  try { parsed = JSON.parse(json); } catch { return null; }
  const state = ((parsed as { state?: StudentsState }).state ?? parsed) as StudentsState;
  if (!Array.isArray(state.list)) return null;
  const hit = state.list.find((s) => s.faceId === faceId);
  return hit?.id ?? null;
}

async function toggleAttendance(
  db: ReturnType<FirebaseAdminLike['firestore']>,
  studentId: string,
  at: number,
): Promise<{ action: 'enter' | 'exit'; deduped?: boolean }> {
  const docRef = db.collection('appState').doc(ATTENDANCE_DOC);
  const snap = await docRef.get();
  const empty: AttendanceState = { state: {}, logs: [] };
  let parsed: { state?: AttendanceState } | AttendanceState = empty;
  let isWrapped = false;
  if (snap.exists) {
    const json = (snap.data() as { json?: string } | undefined)?.json;
    if (json) {
      try {
        const j = JSON.parse(json);
        if ((j as { state?: AttendanceState }).state) {
          parsed = j;
          isWrapped = true;
        } else {
          parsed = j;
        }
      } catch { /* keep empty */ }
    }
  }
  const state = ((parsed as { state?: AttendanceState }).state ?? parsed) as AttendanceState;
  if (!state.state) state.state = {};
  if (!Array.isArray(state.logs)) state.logs = [];

  // dedupe: 같은 학생의 같은 source 가 5초 이내 또 들어오면 무시.
  const lastFaceLog = state.logs.find((l) => l.studentId === studentId && l.source === 'face');
  if (lastFaceLog && at - lastFaceLog.at < DEDUPE_WINDOW_MS) {
    return { action: lastFaceLog.type === 'enter' ? 'enter' : 'exit', deduped: true };
  }

  const cur = state.state[studentId];
  const action: 'enter' | 'exit' = cur?.state === 'in' ? 'exit' : 'enter';
  const newLog: LogLike = {
    id: `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    studentId, type: action, source: 'face', at,
  };
  const newAttState: AttStateLike = action === 'enter'
    ? { studentId, state: 'in', lastEnterAt: at, lastEventAt: at }
    : { studentId, state: 'out', lastEnterAt: cur?.lastEnterAt, lastEventAt: at };
  const next: AttendanceState = {
    ...state,
    state: { ...state.state, [studentId]: newAttState },
    logs: [newLog, ...state.logs].slice(0, 500),
  };
  const newJson = JSON.stringify(isWrapped ? { ...(parsed as object), state: next } : next);
  await docRef.set({ json: newJson, updatedAt: Date.now() });
  return { action };
}

export const config = { api: { bodyParser: false } };
