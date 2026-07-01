// 토스플레이스 (Toss Place) 웹훅 수신.
// 단말기에서 결제 승인/취소가 일어나면 토스플레이스 서버가 이 엔드포인트로 POST.
// payment.payment.approved.v1 수신 시 → appState/pp.plans.v1 문서의 pendingOrders 를
// 직접 갱신해 invoice.orderId 매칭된 건을 paid 처리한다.
//
// 헤더:
//   x-toss-signature   : 'v1=' + hex(HMAC_SHA256(secret, `${timestamp}.${rawBody}`))
//   x-toss-timestamp   : 전송 시각 (epoch ms, 문자열)
//   x-toss-webhook-id  : 이벤트별 고유 ID (멱등성 키)
//   x-toss-delivery-id : 재전송마다 새로 발급
//
// 멱등성: tossplaceWebhooks/{webhookId} 문서를 받아 두고 이미 있으면 200 즉시 응답.
//
// 환경:
//   TOSSPLACE_WEBHOOK_SECRET   웹훅 시크릿 (비어있으면 mock — 시그니처 검증 건너뜀)
//   FIREBASE_PROJECT_ID        Firestore admin SDK 용 (Vercel 환경에 별도 추가 필요)
//   GOOGLE_APPLICATION_CREDENTIALS_JSON   서비스 어카운트 JSON (base64 or raw)
//
// NOTE: 이 핸들러는 Firebase Admin SDK 를 동적 import 로 로드한다. admin SDK 미설정 시
//       시그니처 검증까지만 하고 200 으로 응답 (이벤트는 무시) — 개발 환경 보호용.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { loadFirebaseAdmin } from '../_lib/firebaseAdmin';

const APP_STATE_DOC = 'pp.plans.v1';

interface InvoicePart {
  invoiceId: string;
  orderId?: string;
  vendor: 'main' | 'sub';
  method?: 'invoice' | 'remote' | 'localpay' | 'card';
  amount: number;
  status: 'pending' | 'paid' | 'cancelled';
  paidAt?: number;
}
interface PendingOrder {
  id: string;
  invoices: InvoicePart[];
  status: 'pending' | 'paid' | 'cancelled';
  [k: string]: unknown;
}
interface PlansState {
  pendingOrders: PendingOrder[];
  [k: string]: unknown;
}

interface WebhookEvent {
  id: string;
  type: string;
  createdAt?: string;
  merchantId?: string;
  data?: {
    payment?: {
      id?: string;
      orderId?: string;
      state?: 'APPROVED' | 'CANCELLED' | string;
      amount?: number;
      approvedAt?: string;
      sourceType?: string;
      paymentMethod?: string;
    };
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  // 1) 원시 바디 확보 — 시그니처 검증에 필요. Vercel 은 기본으로 req.body 가 parsed JSON.
  //    그래서 직접 raw 를 얻으려면 stream 으로 읽어야 함.
  const rawBody = await readRawBody(req);

  // 2) 헤더 추출
  const sig = headerStr(req, 'x-toss-signature');
  const timestamp = headerStr(req, 'x-toss-timestamp');
  const webhookId = headerStr(req, 'x-toss-webhook-id');

  // 3) 시그니처 검증
  const secret = process.env.TOSSPLACE_WEBHOOK_SECRET ?? '';
  const mock = !secret;
  if (!mock) {
    if (!sig || !timestamp) return res.status(401).json({ ok: false, error: 'missing signature headers' });
    const ok = verifySignature(secret, timestamp, rawBody, sig);
    if (!ok) return res.status(401).json({ ok: false, error: 'invalid signature' });
    // 5분 윈도우 (replay 방어)
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 5 * 60 * 1000) {
      return res.status(401).json({ ok: false, error: 'stale timestamp' });
    }
  }

  // 4) 페이로드 파싱
  let event: WebhookEvent;
  try {
    event = JSON.parse(rawBody) as WebhookEvent;
  } catch {
    return res.status(400).json({ ok: false, error: 'invalid JSON' });
  }

  // 5) Firebase admin SDK 로드 — 실패하면 검증만 하고 종료 (mock).
  const admin = await loadFirebaseAdmin();
  if (!admin) {
    return res.status(200).json({ ok: true, mock: true, note: 'firebase-admin not configured; event accepted but not applied' });
  }
  const db = admin.firestore() as ReturnType<FirebaseAdminLike['firestore']>;

  // 6) 멱등성 — 이미 처리된 webhookId 면 스킵.
  if (webhookId) {
    const seenRef = db.collection('tossplaceWebhooks').doc(webhookId);
    const seen = await seenRef.get();
    if (seen.exists) return res.status(200).json({ ok: true, deduped: true });
    await seenRef.set({
      receivedAt: Date.now(),
      type: event.type,
      orderId: event.data?.payment?.orderId ?? null,
    });
  }

  // 7) 이벤트 처리 — payment.payment.approved.v1 만 paid 매칭. cancelled 는 표시만 (현재 환불 흐름 미정).
  if (event.type === 'payment.payment.approved.v1') {
    const payment = event.data?.payment;
    if (!payment?.orderId) {
      return res.status(200).json({ ok: true, skipped: 'no orderId in payload' });
    }
    const applied = await applyApprovedPayment(db, payment.orderId, payment);
    return res.status(200).json({ ok: true, applied });
  }

  // 그 외 이벤트는 일단 수신만.
  return res.status(200).json({ ok: true, ignored: event.type });
}

function headerStr(req: VercelRequest, name: string): string {
  const v = req.headers[name.toLowerCase()];
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

async function readRawBody(req: VercelRequest): Promise<string> {
  // Vercel 은 req.body 를 자동 파싱하지만 raw 를 위해 stream 직접 소비.
  // 이미 body 가 string/object 면 stringify 로 fallback (시그니처 검증이 실패할 수 있음).
  const chunks: Buffer[] = [];
  try {
    for await (const chunk of req as unknown as AsyncIterable<Buffer | string>) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
  } catch {
    // ignore — fallback to req.body
  }
  if (chunks.length > 0) return Buffer.concat(chunks).toString('utf8');
  const b = (req as VercelRequest & { body?: unknown }).body;
  if (typeof b === 'string') return b;
  if (b && typeof b === 'object') return JSON.stringify(b);
  return '';
}

function verifySignature(secret: string, timestamp: string, body: string, signatureHeader: string): boolean {
  // 'v1=hex' 형태. 다른 버전 prefix 가 들어올 수 있으니 v1= 만 추출.
  const m = /v1=([0-9a-f]+)/i.exec(signatureHeader);
  if (!m) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${body}`, 'utf8').digest('hex');
  const a = Buffer.from(m[1], 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  try { return timingSafeEqual(a, b); } catch { return false; }
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

async function applyApprovedPayment(
  db: ReturnType<FirebaseAdminLike['firestore']>,
  orderId: string,
  payment: NonNullable<WebhookEvent['data']>['payment'],
): Promise<{ matched: boolean; pendingOrderId?: string; invoiceId?: string }> {
  // appState/pp.plans.v1 문서 한 줄 읽고 JSON 파싱 → invoice 찾아서 paid 처리 → 저장.
  const docRef = db.collection('appState').doc(APP_STATE_DOC);
  const snap = await docRef.get();
  if (!snap.exists) return { matched: false };
  const data = snap.data() ?? {};
  const json = (data as { json?: string }).json;
  if (!json) return { matched: false };

  let state: { state?: PlansState; version?: number } | PlansState;
  try { state = JSON.parse(json); } catch { return { matched: false }; }

  // zustand persist 는 보통 { state, version } 모양으로 래핑됨.
  const wrapped = (state as { state?: PlansState }).state;
  const plans: PlansState = (wrapped ?? state) as PlansState;
  const isWrapped = !!wrapped;

  if (!Array.isArray(plans.pendingOrders)) return { matched: false };

  let matchedPoId: string | undefined;
  let matchedInvoiceId: string | undefined;
  const updated = plans.pendingOrders.map((po) => {
    const newInvoices = po.invoices.map((iv) => {
      if (iv.orderId !== orderId) return iv;
      if (iv.status === 'paid') return iv; // 이미 처리됨
      matchedPoId = po.id;
      matchedInvoiceId = iv.invoiceId;
      return { ...iv, status: 'paid' as const, paidAt: payment?.approvedAt ? Date.parse(payment.approvedAt) : Date.now() };
    });
    const allPaid = newInvoices.length > 0 && newInvoices.every((iv) => iv.status === 'paid');
    return { ...po, invoices: newInvoices, status: allPaid ? ('paid' as const) : po.status };
  });

  if (!matchedPoId) return { matched: false };

  const newPlans: PlansState = { ...plans, pendingOrders: updated };
  const newJson = JSON.stringify(isWrapped ? { ...(state as object), state: newPlans } : newPlans);
  await docRef.set({ json: newJson, updatedAt: Date.now() });
  return { matched: true, pendingOrderId: matchedPoId, invoiceId: matchedInvoiceId };
}

export const config = {
  // raw body 직접 읽어야 시그니처 검증 가능.
  api: { bodyParser: false },
};
