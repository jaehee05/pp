// 토스페이먼츠 가상계좌 발급 클라이언트 (api/payment/invoice wrapper).
export interface InvoiceLine {
  vendor: 'main' | 'sub';
  amount: number;
  description?: string;
  taxFreeAmount?: number;
}
export interface InvoiceRequest {
  orderId: string;
  studentName: string;
  studentPhone?: string;
  bank?: string;          // 두 자리 은행 코드 (예: '20'=우리, '04'=국민)
  validHours?: number;    // 입금 기한 (기본 168 = 7일)
  lines: InvoiceLine[];
}
export interface InvoicePartResult {
  invoiceId: string;
  orderId: string;
  vendor: 'main' | 'sub';
  amount: number;
  bank: string;           // 은행 이름 (예: '우리')
  bankCode: string;       // 두 자리 코드
  accountNumber: string;
  customerName: string;
  dueDate?: string;
  url?: string;
}
export interface InvoiceResult {
  ok: boolean;
  mock?: boolean;
  invoices?: InvoicePartResult[];
  error?: string;
  code?: string;
}

export async function sendInvoice(req: InvoiceRequest): Promise<InvoiceResult> {
  try {
    const res = await fetch('/api/payment/invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    const data = await res.json() as InvoiceResult;
    if (!res.ok && !data.error) data.error = `HTTP ${res.status}`;
    return data;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
