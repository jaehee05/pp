// Vercel Edge Function — 뿌리오(PPURIO) 메시지 발송 프록시.
// 환경변수 PPURIO_USERNAME / PPURIO_API_KEY / PPURIO_SENDER 가 모두 설정되어 있어야 실제 발송.
// 미설정 시 mock 응답.

export const config = { runtime: 'edge' };

interface SendRequest {
  to: string;             // 수신 번호
  channel: 'sms' | 'lms' | 'kakao';
  message: string;
  subject?: string;       // LMS/MMS용 제목
  templateCode?: string;  // 카카오 알림톡 템플릿 코드
}

interface SendResult {
  ok: boolean;
  mock?: boolean;
  id?: string;
  code?: string;
  error?: string;
}

const TOKEN_URL = 'https://message.ppurio.com/v1/token';
const SEND_URL  = 'https://message.ppurio.com/v1/message';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  let body: SendRequest;
  try { body = await req.json(); }
  catch { return json({ ok: false, error: 'Invalid JSON' }, 400); }

  if (!body.to || !body.message) return json({ ok: false, error: 'to and message are required' }, 400);

  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  const username = env.PPURIO_USERNAME;
  const apiKey   = env.PPURIO_API_KEY;
  const sender   = env.PPURIO_SENDER;

  if (!username || !apiKey || !sender) {
    return json({
      ok: true, mock: true, id: `mock_${Date.now()}`,
      error: 'PPURIO env vars not set (PPURIO_USERNAME / PPURIO_API_KEY / PPURIO_SENDER) — mock response',
    });
  }

  try {
    // 1) 토큰 발급
    const basic = base64(`${username}:${apiKey}`);
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${basic}`, 'Content-Type': 'application/json' },
    });
    const tokenText = await tokenRes.text();
    if (!tokenRes.ok) {
      return json({ ok: false, error: `token ${tokenRes.status}: ${tokenText.slice(0, 200)}` }, 500);
    }
    let tokenJson: { token?: string };
    try { tokenJson = JSON.parse(tokenText); }
    catch { return json({ ok: false, error: `token parse fail: ${tokenText.slice(0, 200)}` }, 500); }
    const token = tokenJson.token;
    if (!token) return json({ ok: false, error: `token field missing in response: ${tokenText.slice(0, 200)}` }, 500);

    // 2) 메시지 발송
    const messageType =
      body.channel === 'kakao' ? 'AT' :
      body.channel === 'lms' ? 'LMS' : 'SMS';

    const payload: Record<string, unknown> = {
      account: username,
      messageType,
      from: digits(sender),
      duplicateFlag: 'Y',
      content: body.message,
      targetCount: 1,
      targets: [{ to: digits(body.to) }],
    };
    if (messageType === 'LMS' && body.subject) payload.subject = body.subject;
    if (messageType === 'AT' && body.templateCode) {
      payload.kakaoOption = { templateCode: body.templateCode };
    }

    const sendRes = await fetch(SEND_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const sendText = await sendRes.text();
    let sendJson: { code?: string; description?: string; messageKey?: string } = {};
    try { sendJson = JSON.parse(sendText); } catch { /* */ }

    if (!sendRes.ok || (sendJson.code && sendJson.code !== '1000')) {
      return json({
        ok: false,
        code: sendJson.code,
        error: sendJson.description ?? `send ${sendRes.status}: ${sendText.slice(0, 200)}`,
      }, 500);
    }
    return json({ ok: true, id: sendJson.messageKey, code: sendJson.code });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
}

function base64(s: string): string {
  // Edge Runtime: btoa 가능
  return btoa(s);
}
function digits(s: string): string { return s.replace(/\D/g, ''); }
function json(data: SendResult, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
