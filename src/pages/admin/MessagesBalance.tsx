import { useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { messaging } from '../../lib/messaging';

export function MessagesBalance() {
  const [testPhone, setTestPhone] = useState('');
  const [testMsg, setTestMsg] = useState('[합격공간] 테스트 메시지입니다.');
  const [result, setResult] = useState<string>('');
  const [sending, setSending] = useState(false);

  async function sendTest() {
    if (!testPhone) return alert('수신 번호를 입력하세요.');
    setSending(true);
    const rec = await messaging.send({
      to: testPhone, channel: 'kakao', template: 'test', message: testMsg,
    });
    setSending(false);
    setResult(JSON.stringify(rec, null, 2));
  }

  return (
    <>
      <PageHeader title="잔여 캐시·포인트 + 뿌리오 설정" desc="API 키 설정 후 실제 발송이 가능합니다." />
      <div className="space-y-4 p-6">
        <div className="card p-5">
          <h3 className="mb-3 font-semibold">잔여 캐시·포인트</h3>
          <p className="text-sm text-slate-500">
            뿌리오 잔액 조회는 API 키 설정 후 실시간 표시됩니다. 현재는 API 응답 없이 mock 모드.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-xs text-slate-500">잔여 캐시</div>
              <div className="mt-1 text-xl font-bold">- c</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-xs text-slate-500">잔여 포인트</div>
              <div className="mt-1 text-xl font-bold">- p</div>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="mb-3 font-semibold">뿌리오(PPURIO) API 설정</h3>
          <p className="mb-3 text-sm text-slate-500">
            Vercel 프로젝트 환경변수에 아래 3개를 추가하면 실제 발송으로 전환됩니다.
            로컬 개발 환경에서는 mock 모드로 동작.
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <code className="rounded bg-slate-100 px-2 py-1 text-xs">PPURIO_USERNAME</code>
              <span className="text-xs text-slate-500">뿌리오 계정 ID</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="rounded bg-slate-100 px-2 py-1 text-xs">PPURIO_API_KEY</code>
              <span className="text-xs text-slate-500">API 키</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="rounded bg-slate-100 px-2 py-1 text-xs">PPURIO_SENDER</code>
              <span className="text-xs text-slate-500">사전 등록한 발신 번호</span>
            </div>
          </div>
          <p className="mt-4 rounded-md bg-amber-50 p-3 text-xs text-amber-700">
            <b>참고:</b> 실제 뿌리오 REST API endpoint·payload 구조는 가입 후 개발자 페이지에서 확인 가능합니다.
            <code>api/notify/send.ts</code> 파일의 주석 처리된 fetch 코드를 그 명세에 맞춰 활성화하세요.
          </p>
        </div>

        <div className="card p-5">
          <h3 className="mb-3 font-semibold">테스트 발송</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label>수신 번호
              <input className="input mt-1" value={testPhone} onChange={(e) => setTestPhone(e.target.value)}
                placeholder="010-0000-0000" />
            </label>
            <div />
            <label className="col-span-2">메시지
              <textarea className="input mt-1" rows={3} value={testMsg}
                onChange={(e) => setTestMsg(e.target.value)} />
            </label>
          </div>
          <button className="btn-primary mt-3" onClick={sendTest} disabled={sending}>
            {sending ? '발송 중…' : '테스트 발송'}
          </button>
          {result && (
            <pre className="mt-3 max-h-60 overflow-y-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">
              {result}
            </pre>
          )}
        </div>
      </div>
    </>
  );
}
