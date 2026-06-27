// 토스페이먼츠 가상계좌 발급 API (청구서 발송 효과).
// 메인 가맹점 (독서실, 면세) + 서브 가맹점 (교습소, 과세) 각각 1건씩 가상계좌 발급.
// 학생/구매자 휴대폰으로 토스에서 입금 안내 자동 발송. 입금 시 webhook 으로 알림.
//
// 환경변수:
//   TOSS_SECRET_KEY_MAIN    메인 가맹점 (독서실) 시크릿 키
//   TOSS_SECRET_KEY_SUB     서브 가맹점 (교습소) 시크릿 키
//   TOSS_SECRET_KEY         단일 키 fallback (양 가맹점에 동일 키 사용 시)
//   TOSS_BASE_URL           기본: https://api.tosspayments.com
//   TOSS_DEFAULT_BANK       기본 은행 코드 (기본: 20 = 우리은행)
//
// 모두 미설정이면 mock 모드 (시연용 가짜 계좌번호 발급).

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface InvoiceLine {
  vendor: 'main' | 'sub';
  amount: number;
  description?: string;
  taxFreeAmount?: number; // 면세 금액 (메인 가맹점일 때 amount 와 동일하게)
}
interface InvoiceRequest {
  orderId: string;        // 우리 시스템의 주문 ID (6~64자, [-_a-zA-Z0-9]).
  studentName: string;
  studentPhone?: string;
  bank?: string;          // 가상계좌 은행 두 자리 코드 (예: '20'=우리, '04'=국민)
  validHours?: number;    // 입금 기한 시간 (기본 168 = 7일)
  lines: InvoiceLine[];
}
interface InvoicePartResult {
  invoiceId: string;      // 토스 paymentKey (또는 mock id)
  orderId: string;        // 가맹점별로 분리된 토스 orderId (e.g. "ord_xxx_main")
  vendor: 'main' | 'sub';
  amount: number;
  bank: string;
  bankCode: string;
  accountNumber: string;
  customerName: string;
  dueDate?: string;       // 입금 기한 ISO
  url?: string;           // 영수증/결제 정보 URL (있을 시)
}
interface InvoiceResult {
  ok: boolean;
  mock?: boolean;
  invoices?: InvoicePartResult[];
  error?: string;
  code?: string;
}

// 한국 주요 은행 코드 → 이름 매핑
const BANK_NAMES: Record<string, string> = {
  '04': '국민', '11': '농협', '20': '우리', '23': 'SC', '27': '한국시티',
  '32': '부산', '34': '광주', '37': '전북', '39': '경남', '50': 'SH수협',
  '53': '한국씨티', '54': 'HSBC', '57': '제이피모간체이스', '60': 'BOA',
  '81': '하나', '88': '신한', '89': '케이뱅크', '90': '카카오뱅크',
};

const ORDER_ID_RE = /^[a-zA-Z0-9_-]{6,64}$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  let body: InvoiceRequest;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid JSON' });
  }
  if (!body?.orderId) return res.status(400).json({ ok: false, error: 'orderId required' });
  if (!body.studentName) return res.status(400).json({ ok: false, error: 'studentName required' });
  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    return res.status(400).json({ ok: false, error: 'lines required' });
  }

  const env = process.env;
  const secretMain = env.TOSS_SECRET_KEY_MAIN ?? env.TOSS_SECRET_KEY ?? '';
  const secretSub = env.TOSS_SECRET_KEY_SUB ?? env.TOSS_SECRET_KEY ?? '';
  const baseUrl = env.TOSS_BASE_URL ?? 'https://api.tosspayments.com';
  const defaultBank = body.bank ?? env.TOSS_DEFAULT_BANK ?? '20'; // 우리은행
  const validHours = body.validHours ?? 168;

  const useMock = !secretMain || secretMain.startsWith('dummy');

  // --- Mock 모드 ---
  if (useMock) {
    await sleep(700 + Math.random() * 500);
    const invoices: InvoicePartResult[] = body.lines
      .filter((l) => l.amount > 0)
      .map((l, i) => {
        const subOrderId = sanitizeOrderId(`${body.orderId}_${l.vendor}`);
        const id = `toss_mock_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 6)}`;
        const accountNumber = `1002${String(Math.floor(100000000 + Math.random() * 899999999))}`;
        return {
          invoiceId: id,
          orderId: subOrderId,
          vendor: l.vendor,
          amount: l.amount,
          bank: BANK_NAMES[defaultBank] ?? '우리',
          bankCode: defaultBank,
          accountNumber,
          customerName: body.studentName,
          dueDate: addHoursISO(validHours),
          url: `https://mock.tosspayments.com/v/${id}`,
        };
      });
    return res.status(200).json({ ok: true, mock: true, invoices });
  }

  // --- 실제 토스 가상계좌 발급 ---
  try {
    const invoices: InvoicePartResult[] = [];
    for (const line of body.lines) {
      if (line.amount <= 0) continue;
      const subOrderId = sanitizeOrderId(`${body.orderId}_${line.vendor}`);
      if (!ORDER_ID_RE.test(subOrderId)) {
        return res.status(400).json({ ok: false, error: `orderId 형식 오류: ${subOrderId}` });
      }
      const secret = line.vendor === 'sub' ? secretSub : secretMain;
      if (!secret) {
        return res.status(500).json({
          ok: false,
          error: line.vendor === 'sub'
            ? 'TOSS_SECRET_KEY_SUB 미설정 (서브 가맹점 시크릿 키 필요)'
            : 'TOSS_SECRET_KEY_MAIN 미설정',
        });
      }
      const authHeader = `Basic ${Buffer.from(`${secret}:`).toString('base64')}`;

      const tossBody: Record<string, unknown> = {
        amount: line.amount,
        orderId: subOrderId,
        orderName: line.description ?? (line.vendor === 'main' ? '독서실 결제' : '교습소 결제'),
        customerName: body.studentName,
        bank: defaultBank,
        validHours,
      };
      if (body.studentPhone) {
        tossBody.customerMobilePhone = String(body.studentPhone).replace(/\D/g, '');
      }
      if (line.taxFreeAmount != null) {
        tossBody.taxFreeAmount = line.taxFreeAmount;
      }

      const resp = await fetch(`${baseUrl}/v1/virtual-accounts`, {
        method: 'POST',
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(tossBody),
      });
      const data = await resp.json() as TossPaymentResponse;
      if (!resp.ok || !data.paymentKey || !data.virtualAccount) {
        return res.status(502).json({
          ok: false,
          code: data.code,
          error: data.message ?? `토스 응답 오류 (${resp.status})`,
        });
      }
      const va = data.virtualAccount;
      invoices.push({
        invoiceId: data.paymentKey,
        orderId: data.orderId ?? subOrderId,
        vendor: line.vendor,
        amount: line.amount,
        bank: BANK_NAMES[va.bankCode ?? defaultBank] ?? va.bankCode ?? defaultBank,
        bankCode: va.bankCode ?? defaultBank,
        accountNumber: va.accountNumber,
        customerName: va.customerName ?? body.studentName,
        dueDate: va.dueDate,
        url: data.receipt?.url,
      });
    }
    return res.status(200).json({ ok: true, invoices });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
function addHoursISO(hours: number): string {
  const d = new Date(Date.now() + hours * 3600 * 1000);
  return d.toISOString().slice(0, 19);
}
function sanitizeOrderId(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
}

// 토스 응답 타입 (부분)
interface TossPaymentResponse {
  paymentKey?: string;
  orderId?: string;
  status?: string;
  code?: string;
  message?: string;
  virtualAccount?: {
    accountNumber: string;
    bankCode?: string;
    customerName?: string;
    dueDate?: string;
    accountType?: string;
  };
  receipt?: { url?: string };
}

export type { InvoiceRequest, InvoiceResult, InvoicePartResult };
