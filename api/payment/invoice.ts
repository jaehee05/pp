// 결제선생(PaymentTeacher) 청구서 발송 API.
// 메인/서브 각각 1건씩 청구서 발송 → 결제 페이지 URL 반환.
// 사용자가 청구서 URL 에서 결제 완료 시 webhook 으로 알림.
//
// 환경변수:
//   PAYMENTTEACHER_API_KEY        결제선생 API 키 (없으면 mock 동작)
//   PAYMENTTEACHER_MERCHANT_MAIN  메인 가맹점 ID
//   PAYMENTTEACHER_MERCHANT_SUB   서브 가맹점 ID
//   PAYMENTTEACHER_BASE_URL       (기본: https://api.paymentteacher.com)

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
  const apiKey = env.PAYMENTTEACHER_API_KEY;
  const merchantMain = env.PAYMENTTEACHER_MERCHANT_MAIN ?? '3285619001';
  const merchantSub = env.PAYMENTTEACHER_MERCHANT_SUB ?? '3285620001';
  const baseUrl = env.PAYMENTTEACHER_BASE_URL ?? 'https://api.paymentteacher.com';

  // --- Mock 모드 ---
  if (!apiKey || apiKey.startsWith('dummy')) {
    await sleep(700 + Math.random() * 500);
    const invoices: InvoicePartResult[] = body.lines
      .filter((l) => l.amount > 0)
      .map((l, i) => {
        const id = `inv_mock_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 6)}`;
        return {
          invoiceId: id,
          vendor: l.vendor,
          amount: l.amount,
          url: `https://mock.paymentteacher.com/pay/${id}`,
        };
      });
    return res.status(200).json({ ok: true, mock: true, invoices });
  }

  // --- 실제 결제선생 호출 ---
  try {
    const invoices: InvoicePartResult[] = [];
    for (const line of body.lines) {
      if (line.amount <= 0) continue;
      const merchantId = line.vendor === 'sub' ? merchantSub : merchantMain;
      const resp = await fetch(`${baseUrl}/v1/invoice/issue`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId,
          amount: line.amount,
          orderId: `${body.orderId}_${line.vendor}`,
          buyerName: body.studentName,
          buyerPhone: body.studentPhone,
          description: line.description ?? `${line.vendor === 'main' ? '메인 (독서실)' : '서브 (교습소)'} 결제`,
        }),
      });
      const data = await resp.json() as { invoiceId?: string; payUrl?: string; error?: string };
      if (!resp.ok || !data.invoiceId) {
        return res.status(502).json({ ok: false, error: data.error ?? `결제선생 응답 오류 (${resp.status})` });
      }
      invoices.push({
        invoiceId: data.invoiceId,
        vendor: line.vendor,
        amount: line.amount,
        url: data.payUrl ?? '',
      });
    }
    return res.status(200).json({ ok: true, invoices });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

// 타입 export (클라이언트와 공유용으로 별도 lib 에도 정의되어 있음)
export type { InvoiceRequest, InvoiceResult, InvoicePartResult };
