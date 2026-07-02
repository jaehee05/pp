// 로컬 디바이스 에이전트 (카드단말기 등) WebSocket 어댑터.
// 브라우저는 USB/Serial을 직접 못 다루므로 로컬에서 돌리는 작은 네이티브 에이전트와
// ws://localhost:7421 으로 통신한다. 실제 에이전트는 별도 바이너리(전자/Rust/.NET 등)로 구현.

export type DeviceEvent =
  | { type: 'connected' }
  | { type: 'disconnected' }
  | { type: 'card_payment_result'; ok: boolean; approvalNo?: string; issuer?: string; txId?: string; error?: string }
  | { type: 'device_list'; devices: { id: string; name: string; status?: string }[] };

export type AgentRequest =
  | { id: string; cmd: 'list_devices' }
  | { id: string; cmd: 'card_pay'; amount: number; installment?: number; orderId: string; merchant?: 'main' | 'sub' }
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
      console.log('[deviceAgent] connecting to', this.url);
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => {
        console.log('[deviceAgent] connected');
        this.emit({ type: 'connected' });
      };
      this.ws.onclose = () => {
        console.warn('[deviceAgent] disconnected, will retry in 3s');
        this.emit({ type: 'disconnected' });
        this.scheduleReconnect();
      };
      this.ws.onerror = (e) => {
        console.error('[deviceAgent] ws error', e);
        this.ws?.close();
      };
      this.ws.onmessage = (ev) => {
        try { this.emit(JSON.parse(ev.data) as DeviceEvent); }
        catch { /* ignore */ }
      };
    } catch (e) {
      console.error('[deviceAgent] connect threw', e);
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
    if (req.cmd === 'list_devices') {
      setTimeout(() => this.emit({
        type: 'device_list',
        devices: [],
      }), 200);
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
// 기본값: 실제 Bridge 연결 시도.
// 명시적으로 mock 강제하려면 .env 에 VITE_DEVICE_AGENT=mock
console.log('[deviceAgent] init, VITE_DEVICE_AGENT =', import.meta.env.VITE_DEVICE_AGENT);
if (import.meta.env.VITE_DEVICE_AGENT === 'mock') {
  console.log('[deviceAgent] mock mode (env)');
  deviceAgent.enableMock();
} else {
  deviceAgent.connect();
}
