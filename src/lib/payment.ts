// 카드 결제 클라이언트 (결제선생 API 호출 wrapper).
// /api/payment/charge POST → Vercel 함수 → 결제선생 REST → 단말기 → 응답

export interface PayResult {
  ok: boolean;
  mock?: boolean;
  approvalNo?: string;
  issuer?: string;
  cardNo?: string;
  txId?: string;
  approvedAt?: string;
  error?: string;
  code?: string;
}

export interface PayRequest {
  amount: number;
  installment?: number;
  orderId: string;
  merchant?: 'main' | 'sub';
  taxFree?: boolean;
}

let mockCache: boolean | null = null;
let mockPromise: Promise<boolean> | null = null;
export function fetchPaymentMock(): Promise<boolean> {
  if (mockCache !== null) return Promise.resolve(mockCache);
  if (mockPromise) return mockPromise;
  mockPromise = fetch('/api/payment/config')
    .then((r) => r.json())
    .then((d: { mock?: boolean }) => {
      mockCache = !!d?.mock;
      return mockCache;
    })
    .catch(() => { mockCache = false; return false; });
  return mockPromise;
}

export async function chargeCard(req: PayRequest): Promise<PayResult> {
  try {
    const res = await fetch('/api/payment/charge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    const data = await res.json() as PayResult;
    if (!res.ok && !data.error) data.error = `HTTP ${res.status}`;
    return data;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
