// Vercel Edge Function — 뿌리오(PPURIO) 메시지 발송.
// PPURIO는 IP 화이트리스트 인증을 요구하므로, 고정 IP를 가진 외부 VM에 띄운 프록시
// (2027-consulting/vm-proxy 와 동일)를 경유한다. 직접 호출하면 인증 실패.
//
// 필요한 환경변수:
//   PPURIO_PROXY_URL          프록시 endpoint (예: http://A.B.C.D:8080/)
//   PPURIO_PROXY_SECRET       프록시 인증 시크릿 (X-Proxy-Secret 헤더)
//   PPURIO_USERNAME           뿌리오 계정 ID
//   PPURIO_API_KEY            API 키
//   PPURIO_SENDER             SMS/LMS 발신번호 (등록된 번호)
//   PPURIO_SENDER_PROFILE     알림톡 발신프로필 — 알림톡(channel=kakao + templateCode) 사용 시 필수

// Node.js runtime — Edge runtime은 비표준 포트(:8080)나 HTTP outbound 차단 때문에
// VM 프록시(http://158.180.84.176:8080)에 접근 못 함 ("Direct IP access" 403).
// Node 런타임은 Lambda 기반이라 네트워크 제약 없음.
export const config = { runtime: 'nodejs' };

interface SendRequest {
  to: string;
  channel: 'sms' | 'lms' | 'kakao';
  message: string;
  subject?: string;
  templateCode?: string;                 // 알림톡 템플릿 코드 (channel=kakao 시 필수)
  changeWord?: Record<string, string>;   // 알림톡 변수 치환
  messageType?: 'ALT' | 'ALH' | 'ALI';   // 알림톡 유형 (강조형=ALH 기본)
}

interface SendResult {
  ok: boolean;
  mock?: boolean;
  id?: string;
  code?: string;
  error?: string;
}

const TOKEN_MEM: { token?: string; expiresAt?: number } = {};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  let body: SendRequest;
  try { body = await req.json(); }
  catch { return json({ ok: false, error: 'Invalid JSON' }, 400); }

  if (!body.to || !body.message) return json({ ok: false, error: 'to and message are required' }, 400);

  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  const proxyUrl = env.PPURIO_PROXY_URL;
  const proxySecret = env.PPURIO_PROXY_SECRET;
  const username = env.PPURIO_USERNAME;
  const apiKey   = env.PPURIO_API_KEY;
  const sender   = env.PPURIO_SENDER;
  const senderProfile = env.PPURIO_SENDER_PROFILE;

  if (!username || !apiKey || !sender) {
    return json({
      ok: true, mock: true, id: `mock_${Date.now()}`,
      error: 'PPURIO 계정 env(PPURIO_USERNAME/API_KEY/SENDER) 미설정 — mock',
    });
  }
  if (!proxyUrl || !proxySecret) {
    return json({
      ok: true, mock: true, id: `mock_${Date.now()}`,
      error: 'PROXY env(PPURIO_PROXY_URL/SECRET) 미설정 — mock. 2027 VM 프록시 정보를 등록하세요.',
    });
  }

  try {
    const tokenRes = await getToken(proxyUrl, proxySecret, username, apiKey);
    if (typeof tokenRes !== 'string') {
      return json({
        ok: false,
        error: `토큰 발급 실패 — proxy ${tokenRes.status}: ${JSON.stringify(tokenRes.body).slice(0, 400)}`,
      }, 500);
    }
    const token = tokenRes;

    const wantsKakao = body.channel === 'kakao' && !!body.templateCode;
    if (wantsKakao && !senderProfile) {
      return json({ ok: false, error: 'PPURIO_SENDER_PROFILE 미설정 — 알림톡 발송 불가' }, 500);
    }

    const path = wantsKakao ? '/v1/kakao' : '/v1/message';
    const messageType =
      wantsKakao ? (body.messageType ?? 'ALH') :
      body.channel === 'lms' || smsBytes(body.message) > 90 ? 'LMS' : 'SMS';

    const target: Record<string, unknown> = { to: digits(body.to) };
    if (body.changeWord) target.changeWord = body.changeWord;

    const payload: Record<string, unknown> = {
      account: username,
      messageType,
      from: digits(sender),
      duplicateFlag: 'Y',
      content: body.message,
      targetCount: 1,
      targets: [target],
      refKey: `pp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    };
    if (messageType === 'LMS') payload.subject = body.subject || '[합격공간] 알림';
    if (wantsKakao) {
      payload.senderProfile = senderProfile;
      payload.templateCode = body.templateCode;
      payload.isResend = 'N';
    }

    const { ok, status, body: resBody } = await proxyFetch(
      proxyUrl, proxySecret, path,
      { Authorization: `Bearer ${token}` }, payload,
    );

    if (!ok || (resBody?.code && resBody.code !== '1000')) {
      return json({
        ok: false,
        code: resBody?.code,
        error: resBody?.description ?? resBody?.error ?? `send ${status}: ${JSON.stringify(resBody).slice(0, 200)}`,
      }, 500);
    }
    return json({ ok: true, id: resBody?.messageKey ?? resBody?.refKey, code: resBody?.code });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
}

async function getToken(
  proxyUrl: string, proxySecret: string, username: string, apiKey: string,
): Promise<string | { status: number; body: Record<string, unknown> }> {
  const now = Date.now();
  if (TOKEN_MEM.token && (TOKEN_MEM.expiresAt ?? 0) > now + 60_000) return TOKEN_MEM.token;
  const basic = btoa(`${username}:${apiKey}`);
  const { ok, status, body } = await proxyFetch(proxyUrl, proxySecret, '/v1/token', { Authorization: `Basic ${basic}` }, {});
  if (!ok || !body?.token) return { status, body };
  TOKEN_MEM.token = body.token;
  TOKEN_MEM.expiresAt = now + 23 * 60 * 60 * 1000;
  return body.token;
}

interface ProxyResp {
  ok: boolean;
  status: number;
  body: Record<string, unknown> & {
    token?: string;
    code?: string;
    description?: string;
    messageKey?: string;
    refKey?: string;
    error?: string;
  };
}

async function proxyFetch(
  proxyUrl: string, proxySecret: string,
  path: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
): Promise<ProxyResp> {
  const res = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Proxy-Secret': proxySecret },
    body: JSON.stringify({ path, method: 'POST', headers, body }),
    signal: AbortSignal.timeout(10_000),
  });
  const text = await res.text();
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
  return { ok: res.ok, status: res.status, body: parsed };
}

function digits(s: string): string { return s.replace(/\D/g, ''); }
function smsBytes(s: string): number {
  let n = 0;
  for (const ch of s) n += ch.charCodeAt(0) > 127 ? 2 : 1;
  return n;
}
function json(data: SendResult, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
