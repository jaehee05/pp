// 미입실 자동 스캔 & SMS 발송.
// Vercel Cron 이 주기적으로(권장: 10분) 이 엔드포인트를 호출.
// 각 학생의 weeklyPlan 오늘 요일 입실/재입실 슬롯을 훑어서,
// 슬롯 시각 + GRACE_MINUTES 지난 시점에 아직 입실 상태가 아닌 학생들에게 학부모 SMS 발송.
//
// 멱등: Firestore 컬렉션 `noShowNotified` 에 { YYYY-MM-DD }_{ studentId }_{ slotKey }
// 형태 문서를 남긴다. 이미 있으면 스킵 (재발송 방지).
//
// 인증: Vercel Cron 이 요청 헤더 Authorization: Bearer <CRON_SECRET> 을 보내면
// 비교. 미설정 시 인증 스킵 (개발/테스트용).
//
// 환경변수:
//   CRON_SECRET                   Vercel Cron 인증용 (권장)
//   FIREBASE_PROJECT_ID           Firebase Admin
//   GOOGLE_APPLICATION_CREDENTIALS_JSON
//   NOTIFY_BASE_URL               셀프 콜용 base (없으면 https://${VERCEL_URL})
//
// GET / POST 다 허용 (Vercel Cron 은 GET).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { loadFirebaseAdmin, lastFirebaseAdminError } from '../_lib/firebaseAdmin';

type WeekdayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
type NoShowSlotKey = 'initialEnter' | 'morningReenter' | 'afternoonReenter' | 'eveningReenter';

const ENTER_SLOTS: { key: NoShowSlotKey; field: string; label: string }[] = [
  { key: 'initialEnter', field: 'initialEnter', label: '아침 입실' },
  { key: 'morningReenter', field: 'morningReenter', label: '오전 후 재입실' },
  { key: 'afternoonReenter', field: 'afternoonReenter', label: '오후 후 재입실' },
  { key: 'eveningReenter', field: 'eveningReenter', label: '저녁 후 재입실' },
];

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const GRACE_MINUTES = 15;

interface StudentLike {
  id: string;
  name?: string;
  phone?: string;
  parentPhone?: string;
  parentMsgReceive?: boolean;
  notify?: { parentLateMiss?: boolean };
  weeklyPlan?: Partial<Record<WeekdayKey, Record<string, string>>>;
  schedule?: Partial<Record<WeekdayKey, { start?: string; end?: string } | null>>;
}
interface AttStateLike { state: 'in' | 'out' | 'temp_out' }
interface AttendanceStateJson { state: Record<string, AttStateLike> }
interface StudentsStateJson { list: StudentLike[] }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const got = headerStr(req, 'authorization');
    if (got !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
  }

  const admin = await loadFirebaseAdmin();
  if (!admin) {
    return res.status(200).json({
      ok: true,
      mock: true,
      note: lastFirebaseAdminError ?? 'firebase-admin not configured',
      hint: 'Vercel Settings → Environment Variables 에서 GOOGLE_APPLICATION_CREDENTIALS_JSON + FIREBASE_PROJECT_ID 확인 후 Redeploy',
    });
  }
  const db = admin.firestore() as ReturnType<FirebaseAdminLike['firestore']>;

  const students = await readStore<StudentsStateJson>(db, 'pp.students.v1');
  const attendance = await readStore<AttendanceStateJson>(db, 'pp.attendance.v1');
  if (!students || !Array.isArray(students.list)) {
    return res.status(200).json({ ok: true, scanned: 0, note: 'no students state' });
  }
  const attState = attendance?.state ?? {};

  const nowMs = Date.now();
  const kstNow = new Date(nowMs + KST_OFFSET_MS);
  const weekdayMap: WeekdayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const today: WeekdayKey = weekdayMap[kstNow.getUTCDay()];
  const dateStr = `${kstNow.getUTCFullYear()}-${String(kstNow.getUTCMonth() + 1).padStart(2, '0')}-${String(kstNow.getUTCDate()).padStart(2, '0')}`;
  const nowMinutes = kstNow.getUTCHours() * 60 + kstNow.getUTCMinutes();

  const notifyBase = getSelfBaseUrl(req);
  let scanned = 0, sent = 0, deduped = 0, present = 0, missing = 0;
  const details: { studentId: string; slot: NoShowSlotKey; action: 'sent' | 'deduped' | 'present' | 'error'; error?: string }[] = [];

  for (const student of students.list) {
    if (!student?.id) continue;
    if (!student.parentPhone || student.parentMsgReceive === false) continue;
    if (student.notify?.parentLateMiss === false) continue;
    const day = student.weeklyPlan?.[today];
    // weeklyPlan 없으면 legacy schedule 로 fallback (initialEnter 하나만)
    const slots: { key: NoShowSlotKey; time: string; label: string }[] = [];
    if (day) {
      for (const s of ENTER_SLOTS) {
        const t = day[s.field];
        if (typeof t === 'string' && t.length > 0) {
          slots.push({ key: s.key, time: t, label: s.label });
        }
      }
    }
    if (slots.length === 0) {
      const legacy = student.schedule?.[today];
      if (legacy?.start) {
        slots.push({ key: 'initialEnter', time: legacy.start, label: '입실' });
      }
    }

    for (const slot of slots) {
      const [h, m] = slot.time.split(':').map(Number);
      const slotMinutes = (h || 0) * 60 + (m || 0);
      if (nowMinutes < slotMinutes + GRACE_MINUTES) continue; // 아직 grace 안 지남

      scanned += 1;
      const dedupeKey = `${dateStr}_${student.id}_${slot.key}`;
      const seenRef = db.collection('noShowNotified').doc(dedupeKey);
      const seen = await seenRef.get();
      if (seen.exists) {
        deduped += 1;
        details.push({ studentId: student.id, slot: slot.key, action: 'deduped' });
        continue;
      }

      const attS = attState[student.id];
      if (attS?.state === 'in' || attS?.state === 'temp_out') {
        // 이미 입실 or 외출중 — 알림 대상 아님. 다시 안 판정하도록 마킹.
        await seenRef.set({ status: 'present', at: Date.now(), slotTime: slot.time });
        present += 1;
        details.push({ studentId: student.id, slot: slot.key, action: 'present' });
        continue;
      }

      // 미입실 — SMS 발송
      const smsBody = `[합격공간] ${student.name ?? ''} 학생이 ${slot.time} ${slot.label} 예정이었으나 아직 미입실입니다.`;
      try {
        const resp = await fetch(`${notifyBase}/api/notify/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: student.parentPhone,
            name: student.name,
            channel: 'sms',
            template: 'no_show',
            message: smsBody,
          }),
        });
        const data = await resp.json().catch(() => ({}));
        await seenRef.set({
          status: data?.ok === false ? 'failed' : 'notified',
          at: Date.now(),
          slotTime: slot.time,
          remoteId: data?.id,
          error: data?.error,
        });
        if (data?.ok === false) {
          details.push({ studentId: student.id, slot: slot.key, action: 'error', error: String(data.error) });
        } else {
          sent += 1;
          missing += 1;
          details.push({ studentId: student.id, slot: slot.key, action: 'sent' });
        }
      } catch (e) {
        details.push({ studentId: student.id, slot: slot.key, action: 'error', error: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  return res.status(200).json({ ok: true, today, dateStr, scanned, sent, deduped, present, missing, details });
}

function headerStr(req: VercelRequest, name: string): string {
  const v = req.headers[name.toLowerCase()];
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

function getSelfBaseUrl(req: VercelRequest): string {
  if (process.env.NOTIFY_BASE_URL) return process.env.NOTIFY_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  const host = headerStr(req, 'host');
  const proto = headerStr(req, 'x-forwarded-proto') || 'https';
  return host ? `${proto}://${host}` : 'http://localhost:3000';
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

async function readStore<T>(db: ReturnType<FirebaseAdminLike['firestore']>, name: string): Promise<T | null> {
  const snap = await db.collection('appState').doc(name).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  const json = (data as { json?: string }).json;
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    const state = (parsed?.state ?? parsed) as T;
    return state;
  } catch {
    return null;
  }
}
