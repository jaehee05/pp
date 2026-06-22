// 로컬 디바이스 에이전트 (지문/카드단말기) WebSocket 어댑터.
// 브라우저는 USB/Serial을 직접 못 다루므로 로컬에서 돌리는 작은 네이티브 에이전트와
// ws://localhost:7421 으로 통신한다. 실제 에이전트는 별도 바이너리(전자/Rust/.NET 등)로 구현.

export type DeviceEvent =
  | { type: 'connected' }
  | { type: 'disconnected' }
  | { type: 'fingerprint_scan'; fingerprintId: string; quality: number }
  | { type: 'fingerprint_enroll_progress'; step: number; total: number }
  | { type: 'fingerprint_enroll_done'; fingerprintId: string }
  | { type: 'card_payment_result'; ok: boolean; approvalNo?: string; issuer?: string; txId?: string; error?: string };

export type AgentRequest =
  | { id: string; cmd: 'enroll_fingerprint'; studentId: string }
  | { id: string; cmd: 'identify_fingerprint' }
  | { id: string; cmd: 'card_pay'; amount: number; installment?: number; orderId: string }
  | { id: string; cmd: 'card_cancel'; approvalNo: string; amount: number };

type Listener = (e: DeviceEvent) => void;

class DeviceAgent {
  private ws: WebSocket | null = null;
  private url: string;
  private listeners = new Set<Listener>();
  private reconnectTimer: number | null = null;
  private mockMode = false;

  constructor(url = 'ws://localhost:7421') {
    this.url = url;
  }

  enableMock() {
    this.mockMode = true;
    setTimeout(() => this.emit({ type: 'connected' }), 100);
  }

  connect() {
    if (this.mockMode) return;
    try {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => this.emit({ type: 'connected' });
      this.ws.onclose = () => {
        this.emit({ type: 'disconnected' });
        this.scheduleReconnect();
      };
      this.ws.onerror = () => this.ws?.close();
      this.ws.onmessage = (ev) => {
        try { this.emit(JSON.parse(ev.data) as DeviceEvent); }
        catch { /* ignore */ }
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }

  send(req: AgentRequest) {
    if (this.mockMode) return this.mockHandle(req);
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(req));
  }

  on(l: Listener) { this.listeners.add(l); return () => this.listeners.delete(l); }
  private emit(e: DeviceEvent) { this.listeners.forEach((l) => l(e)); }

  private mockHandle(req: AgentRequest) {
    if (req.cmd === 'enroll_fingerprint') {
      let step = 0;
      const total = 3;
      const tick = () => {
        step++;
        if (step <= total) this.emit({ type: 'fingerprint_enroll_progress', step, total });
        if (step < total) setTimeout(tick, 600);
        else setTimeout(() => this.emit({
          type: 'fingerprint_enroll_done',
          fingerprintId: `fp_${req.studentId}_${Date.now()}`,
        }), 500);
      };
      setTimeout(tick, 400);
    }
    if (req.cmd === 'identify_fingerprint') {
      setTimeout(() => this.emit({
        type: 'fingerprint_scan',
        fingerprintId: 'fp_mock_demo',
        quality: 88,
      }), 800);
    }
    if (req.cmd === 'card_pay') {
      setTimeout(() => this.emit({
        type: 'card_payment_result',
        ok: true,
        approvalNo: String(Math.floor(10000000 + Math.random() * 89999999)),
        issuer: '신한카드',
        txId: `tx_${Date.now()}`,
      }), 1500);
    }
    if (req.cmd === 'card_cancel') {
      setTimeout(() => this.emit({
        type: 'card_payment_result',
        ok: true,
        approvalNo: req.approvalNo,
        txId: `tx_cancel_${Date.now()}`,
      }), 1000);
    }
  }
}

export const deviceAgent = new DeviceAgent();

// 환경변수로 모의/실제 전환
if (import.meta.env.VITE_DEVICE_AGENT === 'mock' || !import.meta.env.VITE_DEVICE_AGENT) {
  deviceAgent.enableMock();
} else {
  deviceAgent.connect();
}
