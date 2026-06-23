// Vercel Edge Function — 뿌리오(PPURIO) 메시지 발송 프록시.
// 환경변수가 설정되어 있으면 실제 뿌리오 REST API로 전송, 없으면 mock 응답을 반환한다.
//
// 필요한 환경변수 (Vercel Project Settings → Environment Variables):
//   PPURIO_USERNAME         뿌리오 계정 ID
//   PPURIO_API_KEY          API 키
//   PPURIO_SENDER           발신 번호 (사전 등록된 번호)
//
// 뿌리오 공식 REST API 명세는 https://www.ppurio.com 가입 후 개발자 페이지에서 확인.
// 본 함수는 토큰 발급 → 메시지 전송 두 단계로 구성된 일반적인 흐름을 가정한다.
// 실제 endpoint URL / 요청 페이로드 구조는 뿌리오 문서에 맞춰 PPURIO_ENDPOINT 부분만 교체하면 된다.

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
  error?: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }
  let body: SendRequest;
  try { body = await req.json(); }
  catch { return json({ ok: false, error: 'Invalid JSON' }, 400); }

  if (!body.to || !body.message) {
    return json({ ok: false, error: 'to and message are required' }, 400);
  }

  const username = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.PPURIO_USERNAME;
  const apiKey = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.PPURIO_API_KEY;
  const sender = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.PPURIO_SENDER;

  if (!username || !apiKey || !sender) {
    // 키 미설정 — mock 응답
    return json({
      ok: true,
      mock: true,
      id: `mock_${Date.now()}`,
      error: 'PPURIO env vars not set (PPURIO_USERNAME / PPURIO_API_KEY / PPURIO_SENDER)',
    });
  }

  try {
    // 1) 토큰 발급. 실제 endpoint 는 뿌리오 문서 기준으로 교체.
    // const tokenRes = await fetch('https://message.ppurio.com/v1/token', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': 'Basic ' + btoa(`${username}:${apiKey}`),
    //     'Content-Type': 'application/json',
    //   },
    // });
    // const { token } = await tokenRes.json();

    // 2) 메시지 발송. 실제 endpoint·payload 는 뿌리오 문서 기준으로 교체.
    // const sendRes = await fetch('https://message.ppurio.com/v1/message', {
    //   method: 'POST',
    //   headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     account: username,
    //     messageType: body.channel.toUpperCase(),
    //     from: sender,
    //     duplicateFlag: 'Y',
    //     content: body.message,
    //     subject: body.subject,
    //     targetCount: 1,
    //     targets: [{ to: body.to.replace(/-/g, '') }],
    //     kakaoOption: body.channel === 'kakao' && body.templateCode
    //       ? { templateCode: body.templateCode, senderKey: 'YOUR_KAKAO_SENDER_KEY' }
    //       : undefined,
    //   }),
    // });
    // const sendJson = await sendRes.json();
    // return json({ ok: sendRes.ok, id: sendJson.messageKey });

    // 실제 호출이 주석 상태이므로 mock 응답으로 마무리
    return json({
      ok: true,
      mock: true,
      id: `mock_${Date.now()}`,
      error: 'PPURIO 실제 호출 부분은 api/notify/send.ts 내 주석 해제 후 사용. 공식 endpoint·payload 구조를 뿌리오 개발자 페이지에서 확인하세요.',
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
}

function json(data: SendResult, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
