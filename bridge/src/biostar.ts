import axios, { type AxiosInstance } from 'axios';
import https from 'node:https';
import { config } from './config.js';

// Suprema BioStar 2 REST API 클라이언트.
// 공식 문서: BioStar 2 New Local API (서버 깔린 PC의 https://<host>/api/login 등)
// 인증: POST /api/login → 응답 헤더 bs-session-id 를 이후 모든 요청에 동봉.

let client: AxiosInstance | null = null;
let sessionId: string | null = null;

async function init(): Promise<AxiosInstance> {
  if (client && sessionId) return client;
  if (!config.biostar.baseUrl) throw new Error('BIOSTAR_BASE_URL 미설정');

  const ax = axios.create({
    baseURL: config.biostar.baseUrl.replace(/\/$/, ''),
    timeout: 15_000,
    httpsAgent: new https.Agent({ rejectUnauthorized: !config.biostar.insecureTls }),
  });

  const res = await ax.post('/api/login', {
    User: { login_id: config.biostar.username, password: config.biostar.password },
  });
  sessionId = (res.headers['bs-session-id'] as string) ?? null;
  if (!sessionId) throw new Error('BioStar 로그인 실패: 세션 토큰 없음');

  ax.interceptors.request.use((cfg) => {
    cfg.headers = cfg.headers ?? {};
    if (sessionId) (cfg.headers as Record<string, string>)['bs-session-id'] = sessionId;
    return cfg;
  });

  client = ax;
  return ax;
}

// ====== 지문 등록 ======
// BioStar 2 에서는 디바이스에 직접 "지문 등록" 명령을 보낼 수 있다.
// 1. 사용자 생성 (없으면): POST /api/users
// 2. 지문 등록: POST /api/devices/{id}/scan_fingerprint
//    → 디바이스 LED 가 점등되고 사용자가 손가락 올리면 응답으로 템플릿 반환
// 3. 템플릿을 사용자에 저장: POST /api/users/fingerprints

export interface EnrollResult {
  ok: boolean;
  fingerprintId?: string;   // BioStar 사용자 ID
  templates?: string[];     // base64 템플릿 (저장용)
  error?: string;
}

export async function enrollFingerprint(externalUserId: string, displayName: string): Promise<EnrollResult> {
  try {
    const ax = await init();

    // 1) 사용자 생성 (이미 있으면 무시)
    let userId = externalUserId;
    try {
      await ax.post('/api/users', {
        User: {
          user_id: externalUserId,
          name: displayName,
        },
      });
    } catch (e) {
      // 이미 존재 시 무시
      if (axios.isAxiosError(e) && e.response?.status !== 409) throw e;
    }

    // 2) 디바이스에 지문 스캔 요청
    if (!config.biostar.deviceId) throw new Error('BIOSTAR_DEVICE_ID 미설정');
    const scan = await ax.post(`/api/devices/${config.biostar.deviceId}/scan_fingerprint`, {
      ScanData: { quality: 50, template_format: 'SUPREMA' },
    });
    const templates: string[] = (scan.data?.Templates ?? []).map((t: { data: string }) => t.data);
    if (templates.length === 0) throw new Error('템플릿 수신 실패 (지문 인식 안 됨)');

    // 3) 사용자에 템플릿 저장
    await ax.post('/api/users/fingerprints', {
      UserCollection: { rows: [{ id: userId, fingerprints: templates.map((data) => ({ data })) }] },
    });

    return { ok: true, fingerprintId: userId, templates };
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 401) {
      sessionId = null;
      client = null;
    }
    return { ok: false, error: humanError(e) };
  }
}

// ====== 입퇴실 이벤트 폴링 ======
// /api/events/search 로 최근 이벤트를 주기적으로 가져옴.
// 입실/퇴실 구분은 디바이스 설정(IN/OUT) 또는 이벤트 type 기반.

type EventCb = (e: { userId: string; type: 'enter' | 'exit'; at: Date; raw: Record<string, unknown> }) => void;
let lastTs: number | null = null;
let pollTimer: NodeJS.Timeout | null = null;
const listeners = new Set<EventCb>();

export function onEvent(cb: EventCb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function startPolling() {
  if (pollTimer) return;
  if (!config.biostar.baseUrl) return; // 설정 없으면 폴링 안 함
  console.log(`[biostar] 이벤트 폴링 시작 (${config.biostar.pollMs}ms)`);
  pollTimer = setInterval(pollOnce, config.biostar.pollMs);
  void pollOnce();
}

export function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

async function pollOnce() {
  try {
    const ax = await init();
    const since = lastTs ?? Date.now() - 60_000;
    const res = await ax.post('/api/events/search', {
      Query: {
        offset: 0,
        limit: 50,
        conditions: [
          { column: 'datetime', operator: 4, values: [Math.floor(since / 1000)] }, // 4 = greater than
          ...(config.biostar.deviceId ? [{ column: 'device_id.id', operator: 1, values: [config.biostar.deviceId] }] : []),
        ],
        orders: [{ column: 'datetime', descending: true }],
      },
    });
    const rows: Array<{ datetime: string; user_id?: { user_id: string }; event_type_id?: { code: string }; raw?: Record<string, unknown> }> =
      res.data?.records ?? [];
    if (rows.length === 0) return;
    lastTs = Date.now();
    for (const row of rows.reverse()) {
      const userId = row.user_id?.user_id;
      if (!userId) continue;
      // BioStar 이벤트 코드는 다양. IN/OUT은 디바이스 별로 설정값에 따라 결정.
      // 단순화: 인증 성공 이벤트만 모두 'enter' 로 보내고, 브라우저 측에서 토글.
      const code = row.event_type_id?.code ?? '';
      const type: 'enter' | 'exit' = code.includes('OUT') ? 'exit' : 'enter';
      const at = new Date(row.datetime);
      const raw = (row as unknown as Record<string, unknown>);
      listeners.forEach((cb) => { try { cb({ userId, type, at, raw }); } catch { /* */ } });
    }
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 401) {
      sessionId = null; client = null;
    }
    console.warn('[biostar] 폴링 오류:', humanError(e));
  }
}

function humanError(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data;
    return `${e.response?.status ?? ''} ${typeof data === 'string' ? data : JSON.stringify(data ?? {}).slice(0, 200)} ${e.message}`;
  }
  return e instanceof Error ? e.message : String(e);
}
