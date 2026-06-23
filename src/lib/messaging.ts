// 메시지 발송 라이브러리.
// /api/notify/send (Vercel Edge Function) 호출. 실패 시 localStorage 로그에만 기록.

export type Channel = 'sms' | 'lms' | 'kakao';

export interface MessageRecord {
  id: string;
  to: string;
  channel: Channel;
  template: string;
  message: string;
  status: 'queued' | 'sent' | 'failed' | 'mock';
  remoteId?: string;
  error?: string;
  ts: number;
}

const LOG_KEY = 'pp.messaging.log.v1';

function loadLog(): MessageRecord[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* */ }
  return [];
}
function saveLog(list: MessageRecord[]) {
  localStorage.setItem(LOG_KEY, JSON.stringify(list.slice(0, 500)));
}

export const messaging = {
  recent(limit = 100): MessageRecord[] {
    return loadLog().slice(0, limit);
  },

  async send({
    to, channel, message, template, subject, templateCode,
  }: {
    to: string;
    channel: Channel;
    message: string;
    template: string;          // 내부 템플릿 이름 (enter / exit / no_show / custom 등)
    subject?: string;
    templateCode?: string;     // 카카오 알림톡 템플릿 코드
  }): Promise<MessageRecord> {
    const id = `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    let rec: MessageRecord = { id, to, channel, template, message, status: 'queued', ts: Date.now() };

    if (!to) {
      rec.status = 'failed';
      rec.error = '수신 번호 없음';
      saveLog([rec, ...loadLog()]);
      return rec;
    }

    try {
      const res = await fetch('/api/notify/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, channel, message, subject, templateCode }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        rec = { ...rec, status: 'failed', error: data.error ?? `HTTP ${res.status}` };
      } else if (data.mock) {
        rec = { ...rec, status: 'mock', remoteId: data.id, error: data.error };
      } else {
        rec = { ...rec, status: 'sent', remoteId: data.id };
      }
    } catch (e) {
      // API 호출 실패 (dev 환경 등): 로컬 로그만
      rec = { ...rec, status: 'mock', error: e instanceof Error ? e.message : String(e) };
    }
    saveLog([rec, ...loadLog()]);
    return rec;
  },
};
