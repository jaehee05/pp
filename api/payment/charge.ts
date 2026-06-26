// Vercel Node Serverless Function — 결제선생(PaymentTeacher) API 프록시.
// 환경변수 설정 시 실제 결제선생 호출, 미설정 시 mock(시연용).
//
// 필요한 환경변수:
//   PAYMENTTEACHER_API_KEY        결제선생 API 키
//   PAYMENTTEACHER_API_SECRET     시크릿 (있을 경우)
//   PAYMENTTEACHER_MERCHANT_MAIN  메인 가맹점 ID (합격공간 독서실)
//   PAYMENTTEACHER_MERCHANT_SUB   서브 가맹점 ID (합격공간 진학지도교습소)
//   PAYMENTTEACHER_BASE_URL       API endpoint (기본: https://api.paymentteacher.com)

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ChargeRequest {
  amount: number;
  installment?: number;        // 0 = 일시불
  orderId: string;
  merchant?: 'main' | 'sub';   // 가맹점 분기
  taxFree?: boolean;           // 면세 사업자 여부
}

interface ChargeResult {
  ok: boolean;
  mock?: boolean;
  approvalNo?: string;
  issuer?: string;             // 카드사
  cardNo?: string;             // 마스킹 번호
  txId?: string;
  approvedAt?: string;         // ISO 시각
  error?: string;
  code?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  let body: ChargeRequest;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid JSON' });
  }
  if (!body?.amount || body.amount <= 0) return res.status(400).json({ ok: false, error: 'amount > 0 required' });
  if (!body.orderId) return res.status(400).json({ ok: false, error: 'orderId required' });

  const env = process.env;
  const apiKey = env.PAYMENTTEACHER_API_KEY;
  const merchantMain = env.PAYMENTTEACHER_MERCHANT_MAIN ?? env.PPURIO_USERNAME ?? '3285619001';
  const merchantSub = env.PAYMENTTEACHER_MERCHANT_SUB ?? '3285620001';
  const baseUrl = env.PAYMENTTEACHER_BASE_URL ?? 'https://api.paymentteacher.com';
  const merchantId = body.merchant === 'sub' ? merchantSub : merchantMain;

  // --- Mock 모드 (실 키 미설정) ---
  if (!apiKey || apiKey.startsWith('dummy')) {
    await sleep(1500 + Math.random() * 1000); // 단말기 swipe 체감
    const fail = body.amount > 99999999;       // 1억 초과 시 실패 시뮬
    if (fail) {
      return res.status(200).json({
        ok: false, mock: true, code: 'F001',
        error: '카드 한도 초과 (시연 모드)',
      });
    }
    return res.status(200).json({
      ok: true, mock: true,
      approvalNo: String(Math.floor(10000000 + Math.random() * 89999999)),
      issuer: pickRandom(['신한카드', '삼성카드', 'KB국민카드', '현대카드', '하나카드']),
      cardNo: `5***-****-****-${String(Math.floor(1000 + Math.random() * 9000))}`,
      txId: `tx_mock_${Date.now()}`,
      approvedAt: new Date().toISOString(),
      code: '0000',
    });
  }

  // --- 실제 결제선생 호출 (API 키 발급 받으면 활성) ---
  try {
    const resp = await fetch(`${baseUrl}/v1/payment/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        merchant_id: merchantId,
        order_id: body.orderId,
        amount: body.amount,
        installment: body.installment ?? 0,
        tax_free: body.taxFree ?? true,
      }),
    });
    const data = await resp.json() as {
      code?: string;
      message?: string;
      approval_no?: string;
      issuer?: string;
      card_no?: string;
      tx_id?: string;
      approved_at?: string;
    };
    if (!resp.ok || (data.code && data.code !== '0000')) {
      return res.status(200).json({
        ok: false,
        code: data.code,
        error: data.message ?? `HTTP ${resp.status}`,
      });
    }
    return res.status(200).json({
      ok: true,
      approvalNo: data.approval_no,
      issuer: data.issuer,
      cardNo: data.card_no,
      txId: data.tx_id,
      approvedAt: data.approved_at,
      code: data.code,
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

export type { ChargeRequest, ChargeResult };
