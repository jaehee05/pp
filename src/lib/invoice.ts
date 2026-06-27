// 결제선생 청구서 발송 클라이언트 (api/payment/invoice wrapper).
export interface InvoiceLine { vendor: 'main' | 'sub'; amount: number; description?: string }
export interface InvoiceRequest {
  orderId: string;
  studentName?: string;
  studentPhone?: string;
  lines: InvoiceLine[];
}
export interface InvoicePartResult {
  invoiceId: string;
  vendor: 'main' | 'sub';
  amount: number;
  url: string;
}
export interface InvoiceResult {
  ok: boolean;
  mock?: boolean;
  invoices?: InvoicePartResult[];
  error?: string;
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
