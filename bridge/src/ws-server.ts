import { WebSocketServer, type WebSocket } from 'ws';
import { config } from './config.js';
import { pay, cancel } from './nice-van.js';
import { enrollFingerprint, onEvent } from './biostar.js';

// 브라우저(passplace.space)의 src/lib/deviceAgent.ts 와 동일한 프로토콜.
// 명령 IN:  { id, cmd: 'enroll_fingerprint' | 'identify_fingerprint' | 'card_pay' | 'card_cancel', ... }
// 이벤트 OUT: { type: 'connected' | 'fingerprint_scan' | 'fingerprint_enroll_done' | 'card_payment_result' | ... }

interface IncomingCmd {
  id: string;
  cmd: string;
  studentId?: string;
  studentName?: string;
  amount?: number;
  installment?: number;
  orderId?: string;
  approvalNo?: string;
  approvalDate?: string;
  merchant?: 'main' | 'sub';
}

const clients = new Set<WebSocket>();

function broadcast(evt: Record<string, unknown>) {
  const msg = JSON.stringify(evt);
  for (const c of clients) {
    if (c.readyState === c.OPEN) c.send(msg);
  }
}

export function startServer() {
  const wss = new WebSocketServer({ port: config.wsPort, host: '0.0.0.0' });
  console.log(`[ws] listening on ws://0.0.0.0:${config.wsPort}`);

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`[ws] client connected (${clients.size})`);
    ws.send(JSON.stringify({ type: 'connected' }));

    ws.on('message', async (raw) => {
      let req: IncomingCmd;
      try { req = JSON.parse(String(raw)); }
      catch { return; }
      console.log(`[ws] cmd=${req.cmd} id=${req.id}`);

      try {
        if (req.cmd === 'card_pay') {
          const res = await pay({
            amount: req.amount ?? 0,
            installment: req.installment,
            orderId: req.orderId ?? req.id,
            merchant: req.merchant,
          });
          ws.send(JSON.stringify({
            type: 'card_payment_result',
            ok: res.ok,
            approvalNo: res.approvalNo,
            issuer: res.cardIssuer,
            txId: res.txId,
            error: res.error,
          }));
        }
        else if (req.cmd === 'card_cancel') {
          const res = await cancel(req.approvalNo ?? '', req.amount ?? 0, req.approvalDate ?? '');
          ws.send(JSON.stringify({
            type: 'card_payment_result',
            ok: res.ok,
            approvalNo: res.approvalNo,
            txId: res.txId,
            error: res.error,
          }));
        }
        else if (req.cmd === 'enroll_fingerprint') {
          ws.send(JSON.stringify({ type: 'fingerprint_enroll_progress', step: 1, total: 3 }));
          const res = await enrollFingerprint(req.studentId ?? '', req.studentName ?? '');
          if (res.ok) {
            ws.send(JSON.stringify({ type: 'fingerprint_enroll_done', fingerprintId: res.fingerprintId }));
          } else {
            ws.send(JSON.stringify({ type: 'card_payment_result', ok: false, error: res.error })); // 임시 - enroll 실패 이벤트 추가 필요
          }
        }
        else if (req.cmd === 'identify_fingerprint') {
          // BioStar는 디바이스에서 직접 인식하면 이벤트 폴링으로 들어옴. no-op.
          // 필요 시 디바이스에 즉시 스캔 명령 보내도록 확장 가능.
          ws.send(JSON.stringify({ type: 'fingerprint_scan_pending' }));
        }
        else {
          console.warn('[ws] unknown cmd:', req.cmd);
        }
      } catch (e) {
        console.error('[ws] cmd error:', e);
        ws.send(JSON.stringify({ type: 'error', id: req.id, error: e instanceof Error ? e.message : String(e) }));
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[ws] client disconnected (${clients.size})`);
    });
  });

  // BioStar 이벤트 → WebSocket 으로 broadcast
  onEvent((e) => {
    broadcast({
      type: 'fingerprint_scan',
      fingerprintId: e.userId,
      quality: 100,
      bioEventType: e.type,
      at: e.at.toISOString(),
    });
  });
}
