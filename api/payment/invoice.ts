// 토스페이먼츠 결제 링크 발송 API.
// 메인/서브 가맹점 각각 1건씩 결제 링크 생성 → 응답 URL 을 청구서처럼 전달.
// 사용자가 결제 완료 시 webhook 으로 알림.
//
// 환경변수 (실키 사용 시):
//   TOSS_SECRET_KEY           토스 시크릿 키 (test_sk_xxx / live_sk_xxx)
//   TOSS_MERCHANT_MAIN_KEY    메인(독서실) 가맹점 클라이언트 키 또는 sub-merchant id
//   TOSS_MERCHANT_SUB_KEY     서브(교습소) 가맹점 키
//   TOSS_BASE_URL             기본: https://api.tosspayments.com
//
// 미설정 시 mock 모드 — 가짜 URL 발급해서 시연 가능.

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface InvoiceLine { vendor: 'main' | 'sub'; amount: number; description?: string }
interface InvoiceRequest {
  orderId: string;
  studentName?: string;
  studentPhone?: string;
  lines: InvoiceLine[];
}
interface InvoicePartResult {
  invoiceId: string;
  vendor: 'main' | 'sub';
  amount: number;
  url: string;
}
interface InvoiceResult {
  ok: boolean;
  mock?: boolean;
  invoices?: InvoicePartResult[];
  error?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  let body: InvoiceRequest;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid JSON' });
  }
  if (!body.orderId) return res.status(400).json({ ok: false, error: 'orderId required' });
  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    return res.status(400).json({ ok: false, error: 'lines required' });
  }

  const env = process.env;
  const secretKey = env.TOSS_SECRET_KEY;
  const merchantMain = env.TOSS_MERCHANT_MAIN_KEY ?? '';
  const merchantSub = env.TOSS_MERCHANT_SUB_KEY ?? '';
  const baseUrl = env.TOSS_BASE_URL ?? 'https://api.tosspayments.com';

  // --- Mock 모드 ---
  if (!secretKey || secretKey.startsWith('dummy')) {
    await sleep(700 + Math.random() * 500);
    const invoices: InvoicePartResult[] = body.lines
      .filter((l) => l.amount > 0)
      .map((l, i) => {
        const id = `toss_mock_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 6)}`;
        return {
          invoiceId: id,
          vendor: l.vendor,
          amount: l.amount,
          url: `https://mock.tosspayments.com/checkout/${id}`,
        };
      });
    return res.status(200).json({ ok: true, mock: true, invoices });
  }

  // --- 실제 토스페이먼츠 호출 ---
  // 토스의 결제 위젯/링크는 client-side 흐름 중심이라 본 API 는 placeholder.
  // 정확한 엔드포인트는 토스 가입 후 발급되는 시크릿 키로 `POST /v1/payments` (Brandpay) 또는
  // `POST /v1/billing/authorizations/issue` 등 사용.
  // 여기서는 가맹점별로 결제 링크 한 줄씩 만든다고 가정.
  try {
    const authHeader = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
    const invoices: InvoicePartResult[] = [];
    for (const line of body.lines) {
      if (line.amount <= 0) continue;
      const subMerchantKey = line.vendor === 'sub' ? merchantSub : merchantMain;
      const tossOrderId = `${body.orderId}_${line.vendor}`;
      const resp = await fetch(`${baseUrl}/v1/payments`, {
        method: 'POST',
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: line.amount,
          orderId: tossOrderId,
          orderName: line.description ?? (line.vendor === 'main' ? '독서실 결제' : '교습소 결제'),
          customerName: body.studentName,
          customerMobilePhone: body.studentPhone,
          // 가맹점 분기 (sub-merchant 가 분리되어 있는 경우)
          ...(subMerchantKey ? { subMerchantKey } : {}),
          // 성공/실패 redirect URL (실제 host 에 맞게 교체 필요)
          successUrl: `https://passplace.space/pay/success?order=${encodeURIComponent(tossOrderId)}`,
          failUrl: `https://passplace.space/pay/fail?order=${encodeURIComponent(tossOrderId)}`,
        }),
      });
      const data = await resp.json() as { paymentKey?: string; checkout?: { url?: string }; message?: string };
      if (!resp.ok || !data.paymentKey) {
        return res.status(502).json({ ok: false, error: data.message ?? `토스 응답 오류 (${resp.status})` });
      }
      invoices.push({
        invoiceId: data.paymentKey,
        vendor: line.vendor,
        amount: line.amount,
        url: data.checkout?.url ?? '',
      });
    }
    return res.status(200).json({ ok: true, invoices });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

export type { InvoiceRequest, InvoiceResult, InvoicePartResult };
