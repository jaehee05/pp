// 토스페이먼츠 결제 승인 (Confirm) 프록시.
// SDK 결제창 인증 완료 후 success URL 콜백에서 호출.
// paymentKey + orderId + amount → POST /v1/payments/confirm → Payment 객체.
//
// 환경변수:
//   TOSS_SECRET_KEY_MAIN  메인 가맹점 시크릿 키 (기본)
//   TOSS_SECRET_KEY_SUB   서브 가맹점 시크릿 키
//   TOSS_SECRET_KEY       단일 키 fallback
//   TOSS_BASE_URL         기본: https://api.tosspayments.com

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ConfirmRequest {
  paymentKey: string;
  orderId: string;
  amount: number;
  merchant?: 'main' | 'sub'; // 어느 가맹점 시크릿 키를 쓸지
}

interface ConfirmResult {
  ok: boolean;
  mock?: boolean;
  paymentKey?: string;
  orderId?: string;
  status?: string;
  approvedAt?: string;
  totalAmount?: number;
  card?: { issuerCode?: string; number?: string; approveNo?: string; installmentPlanMonths?: number };
  method?: string;
  receiptUrl?: string;
  error?: string;
  code?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  let body: ConfirmRequest;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid JSON' });
  }
  if (!body.orderId) return res.status(400).json({ ok: false, error: 'orderId required' });
  if (!body.amount || body.amount <= 0) return res.status(400).json({ ok: false, error: 'amount > 0 required' });

  const env = process.env;
  const secretMain = env.TOSS_SECRET_KEY_MAIN ?? env.TOSS_SECRET_KEY ?? '';
  const secretSub = env.TOSS_SECRET_KEY_SUB ?? env.TOSS_SECRET_KEY ?? '';
  const baseUrl = env.TOSS_BASE_URL ?? 'https://api.tosspayments.com';
  const secret = body.merchant === 'sub' ? secretSub : secretMain;
  const useMock = !secret || secret.startsWith('dummy');

  // --- Mock 모드 ---
  // SDK 결제창 인증을 거치지 않은 단순 카드 호출도 허용 (paymentKey 없으면 가짜 생성).
  if (useMock) {
    await sleep(800 + Math.random() * 600);
    const fakeKey = body.paymentKey ?? `tk_mock_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    return res.status(200).json({
      ok: true, mock: true,
      paymentKey: fakeKey,
      orderId: body.orderId,
      status: 'DONE',
      approvedAt: new Date().toISOString(),
      totalAmount: body.amount,
      method: '카드',
      // 기존 클라이언트 호환용 평탄 필드
      approvalNo: String(Math.floor(10000000 + Math.random() * 89999999)),
      issuer: pickRandom(['11', '12', '21', '24', '31']),
      cardNo: `5***-****-****-${String(Math.floor(1000 + Math.random() * 9000))}`,
      txId: fakeKey,
      card: {
        issuerCode: pickRandom(['11', '12', '21', '24', '31']),
        number: `5***-****-****-${String(Math.floor(1000 + Math.random() * 9000))}`,
        approveNo: String(Math.floor(10000000 + Math.random() * 89999999)),
        installmentPlanMonths: 0,
      },
      receiptUrl: 'https://mock.tosspayments.com/receipt',
    });
  }

  // --- 실제 토스 confirm 모드 ---
  // 실키 등록 상태에서 paymentKey 없이 호출 = SDK 결제창 인증을 거치지 않은 것 → 에러.
  if (!body.paymentKey) {
    return res.status(400).json({
      ok: false,
      error: '실 결제는 토스 SDK 결제창에서 인증 후 paymentKey 가 있어야 합니다. (현재 카드 결제 흐름은 SDK 미구현 — mock 모드에서만 사용)',
    });
  }

  // --- 실제 토스 confirm ---
  try {
    const authHeader = `Basic ${Buffer.from(`${secret}:`).toString('base64')}`;
    const resp = await fetch(`${baseUrl}/v1/payments/confirm`, {
      method: 'POST',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentKey: body.paymentKey,
        orderId: body.orderId,
        amount: body.amount,
      }),
    });
    const data = await resp.json() as TossPaymentResponse;
    if (!resp.ok || data.status === 'ABORTED' || data.code) {
      return res.status(200).json({
        ok: false,
        code: data.code,
        error: data.message ?? `토스 응답 오류 (${resp.status})`,
      });
    }
    return res.status(200).json({
      ok: true,
      paymentKey: data.paymentKey,
      orderId: data.orderId,
      status: data.status,
      approvedAt: data.approvedAt,
      totalAmount: data.totalAmount,
      method: data.method,
      card: data.card,
      receiptUrl: data.receipt?.url,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
function pickRandom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

interface TossPaymentResponse {
  paymentKey?: string;
  orderId?: string;
  status?: string;
  approvedAt?: string;
  totalAmount?: number;
  method?: string;
  code?: string;
  message?: string;
  card?: { issuerCode?: string; number?: string; approveNo?: string; installmentPlanMonths?: number };
  receipt?: { url?: string };
}

export type { ConfirmRequest, ConfirmResult };
