// Vercel Node Serverless Function — 토스페이먼츠 결제 승인 프록시.
// (단말기 카드 결제 흐름. 청구서 발송은 /api/payment/invoice 참조)
// 환경변수 설정 시 실제 토스 호출, 미설정 시 mock(시연용).
//
// 필요한 환경변수:
//   TOSS_SECRET_KEY              토스 시크릿 키
//   TOSS_MERCHANT_MAIN_KEY       메인(독서실) 가맹점 키
//   TOSS_MERCHANT_SUB_KEY        서브(교습소) 가맹점 키
//   TOSS_BASE_URL                기본: https://api.tosspayments.com

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
  const apiKey = env.TOSS_SECRET_KEY;
  const merchantMain = env.TOSS_MERCHANT_MAIN_KEY ?? '';
  const merchantSub = env.TOSS_MERCHANT_SUB_KEY ?? '';
  const baseUrl = env.TOSS_BASE_URL ?? 'https://api.tosspayments.com';
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

  // --- 실제 토스페이먼츠 호출 (시크릿 키 발급 받으면 활성) ---
  // 토스는 client-side 위젯이 기본 흐름. 단말기 직접 호출용 endpoint 사용 시 아래 형태.
  try {
    const authHeader = `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;
    const resp = await fetch(`${baseUrl}/v1/payments/confirm`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: body.amount,
        orderId: body.orderId,
        ...(merchantId ? { subMerchantKey: merchantId } : {}),
      }),
    });
    const data = await resp.json() as {
      paymentKey?: string;
      status?: string;
      approvedAt?: string;
      card?: { issuerCode?: string; number?: string; approveNo?: string };
      message?: string;
    };
    if (!resp.ok || !data.paymentKey) {
      return res.status(200).json({
        ok: false,
        error: data.message ?? `HTTP ${resp.status}`,
      });
    }
    return res.status(200).json({
      ok: true,
      approvalNo: data.card?.approveNo,
      issuer: data.card?.issuerCode,
      cardNo: data.card?.number,
      txId: data.paymentKey,
      approvedAt: data.approvedAt,
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
