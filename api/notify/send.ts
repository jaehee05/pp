// Vercel Node.js Serverless Function — 뿌리오(PPURIO) 메시지 발송.
// PPURIO는 IP 화이트리스트 인증을 요구하므로, 고정 IP를 가진 VM 프록시
// (2027-consulting/vm-proxy 와 동일)를 경유한다.
//
// Edge runtime은 보안상 비표준 포트(:8080) HTTP outbound 차단 → Cloudflare 단에서
// "Direct IP access" 403으로 잘림. Node.js runtime(Lambda 기반)으로 운영.
//
// 필요한 환경변수:
//   PPURIO_PROXY_URL          프록시 endpoint
//   PPURIO_PROXY_SECRET       X-Proxy-Secret 헤더값
//   PPURIO_USERNAME           뿌리오 계정 ID
//   PPURIO_API_KEY            API 키
//   PPURIO_SENDER             SMS/LMS 발신번호
//   PPURIO_SENDER_PROFILE     알림톡 발신프로필

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface SendRequest {
  to: string;
  channel: 'sms' | 'lms' | 'kakao';
  message: string;
  subject?: string;
  templateCode?: string;
  changeWord?: Record<string, string>;
  messageType?: 'ALT' | 'ALH' | 'ALI';
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

const TOKEN_MEM: { token?: string; expiresAt?: number } = {};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  let body: SendRequest;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid JSON' });
  }
  if (!body?.to || !body?.message) {
    return res.status(400).json({ ok: false, error: 'to and message are required' });
  }

  const env = process.env;
  const proxyUrl = env.PPURIO_PROXY_URL;
  const proxySecret = env.PPURIO_PROXY_SECRET;
  const username = env.PPURIO_USERNAME;
  const apiKey = env.PPURIO_API_KEY;
  const sender = env.PPURIO_SENDER;
  const senderProfile = env.PPURIO_SENDER_PROFILE;

  if (!username || !apiKey || !sender) {
    return res.status(200).json({
      ok: true, mock: true, id: `mock_${Date.now()}`,
      error: 'PPURIO 계정 env(PPURIO_USERNAME/API_KEY/SENDER) 미설정 — mock',
    });
  }
  if (!proxyUrl || !proxySecret) {
    return res.status(200).json({
      ok: true, mock: true, id: `mock_${Date.now()}`,
      error: 'PROXY env(PPURIO_PROXY_URL/SECRET) 미설정 — mock',
    });
  }

  try {
    const tokenRes = await getToken(proxyUrl, proxySecret, username, apiKey);
    if (typeof tokenRes !== 'string') {
      return res.status(500).json({
        ok: false,
        error: `토큰 발급 실패 — proxy ${tokenRes.status}: ${JSON.stringify(tokenRes.body).slice(0, 400)}`,
      });
    }
    const token = tokenRes;

    const wantsKakao = body.channel === 'kakao' && !!body.templateCode;
    if (wantsKakao && !senderProfile) {
      return res.status(500).json({ ok: false, error: 'PPURIO_SENDER_PROFILE 미설정 — 알림톡 발송 불가' });
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
      return res.status(500).json({
        ok: false,
        code: resBody?.code,
        error: resBody?.description ?? resBody?.error ?? `send ${status}: ${JSON.stringify(resBody).slice(0, 200)}`,
      });
    }
    return res.status(200).json({ ok: true, id: resBody?.messageKey ?? resBody?.refKey, code: resBody?.code });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}

async function getToken(
  proxyUrl: string, proxySecret: string, username: string, apiKey: string,
): Promise<string | { status: number; body: Record<string, unknown> }> {
  const now = Date.now();
  if (TOKEN_MEM.token && (TOKEN_MEM.expiresAt ?? 0) > now + 60_000) return TOKEN_MEM.token;
  const basic = Buffer.from(`${username}:${apiKey}`).toString('base64');
  const { ok, status, body } = await proxyFetch(proxyUrl, proxySecret, '/v1/token', { Authorization: `Basic ${basic}` }, {});
  if (!ok || !body?.token) return { status, body };
  TOKEN_MEM.token = body.token;
  TOKEN_MEM.expiresAt = now + 23 * 60 * 60 * 1000;
  return body.token;
}

async function proxyFetch(
  proxyUrl: string, proxySecret: string,
  path: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
): Promise<ProxyResp> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Proxy-Secret': proxySecret },
      body: JSON.stringify({ path, method: 'POST', headers, body }),
      signal: controller.signal,
    });
    const text = await res.text();
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
    return { ok: res.ok, status: res.status, body: parsed };
  } finally {
    clearTimeout(timer);
  }
}

function digits(s: string): string { return s.replace(/\D/g, ''); }
function smsBytes(s: string): number {
  let n = 0;
  for (const ch of s) n += ch.charCodeAt(0) > 127 ? 2 : 1;
  return n;
}
