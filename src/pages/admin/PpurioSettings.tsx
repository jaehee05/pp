import { useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { usePpurio } from '../../store/ppurioSettings';
import { messaging } from '../../lib/messaging';

export function PpurioSettingsPage() {
  const cfg = usePpurio();
  const [draft, setDraft] = useState({
    ppurioAccount: cfg.ppurioAccount,
    apiKey: cfg.apiKey,
    senderProfile: cfg.senderProfile,
    smsSender: cfg.smsSender,
    proxyUrl: cfg.proxyUrl,
    proxySecret: cfg.proxySecret,
    enabled: cfg.enabled,
  });
  const [saved, setSaved] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testMsg, setTestMsg] = useState('[합격공간] 테스트 메시지');
  const [testResult, setTestResult] = useState('');
  const [sending, setSending] = useState(false);

  function save() {
    cfg.set(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function sendTest() {
    if (!testPhone) return alert('수신 번호 입력');
    setSending(true);
    const rec = await messaging.send({
      to: testPhone, channel: 'sms', template: 'test', message: testMsg,
    });
    setSending(false);
    setTestResult(JSON.stringify(rec, null, 2));
  }

  function maskApiKey(s: string) {
    if (!s) return '';
    if (s.length <= 12) return s;
    return s.slice(0, 8) + '…' + s.slice(-4);
  }

  return (
    <>
      <PageHeader
        title="뿌리오 설정"
        desc="Firestore에 저장. 실제 발송은 Vercel 환경변수 값을 사용하므로 값 변경 시 Vercel 콘솔에도 반영 필요."
      />
      <div className="space-y-4 p-6">
        <div className="card p-6">
          <h3 className="mb-4 font-semibold">계정·인증</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Field label="뿌리오 계정 ID (ppurioAccount)">
              <input className="input" value={draft.ppurioAccount}
                onChange={(e) => setDraft({ ...draft, ppurioAccount: e.target.value })} />
            </Field>
            <Field label="API 키">
              <input className="input font-mono" value={draft.apiKey}
                onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                placeholder={maskApiKey(cfg.apiKey)} />
            </Field>
            <Field label="알림톡 발신프로필 (senderProfile)">
              <input className="input" value={draft.senderProfile}
                onChange={(e) => setDraft({ ...draft, senderProfile: e.target.value })}
                placeholder="예: @kjhedu" />
            </Field>
            <Field label="SMS 발신번호">
              <input className="input" value={draft.smsSender}
                onChange={(e) => setDraft({ ...draft, smsSender: e.target.value })}
                placeholder="01012345678" />
            </Field>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="mb-4 font-semibold">고정 IP 프록시</h3>
          <p className="mb-3 text-xs text-slate-500">
            뿌리오는 IP 화이트리스트 인증 — 고정 IP를 가진 VM에 띄운 프록시 경유.
            (2027-consulting/vm-proxy 와 동일 구조)
          </p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Field label="프록시 URL">
              <input className="input font-mono" value={draft.proxyUrl}
                onChange={(e) => setDraft({ ...draft, proxyUrl: e.target.value })}
                placeholder="http://X.X.X.X:8080" />
            </Field>
            <Field label="프록시 시크릿">
              <input className="input font-mono" type="password" value={draft.proxySecret}
                onChange={(e) => setDraft({ ...draft, proxySecret: e.target.value })}
                placeholder={cfg.proxySecret ? '••••••••' : ''} />
            </Field>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-brand-600" checked={draft.enabled}
              onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
            발송 활성화 (false면 모든 알림 발송 스킵)
          </label>
        </div>

        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-sm text-emerald-600">✅ Firestore에 저장됨</span>}
          <button className="btn-primary" onClick={save}>저장</button>
        </div>

        <div className="card p-6">
          <h3 className="mb-3 font-semibold">테스트 발송 (SMS)</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label>수신 번호
              <input className="input mt-1" value={testPhone} onChange={(e) => setTestPhone(e.target.value)}
                placeholder="01000000000" />
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
          {testResult && (
            <pre className="mt-3 max-h-60 overflow-y-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">
              {testResult}
            </pre>
          )}
          <p className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-700">
            <b>참고:</b> 실제 발송은 Vercel Edge Function이 환경변수
            (PPURIO_USERNAME / API_KEY / SENDER / SENDER_PROFILE / PROXY_URL / PROXY_SECRET)에서
            값을 읽어 처리합니다. 이 페이지 저장값은 Firestore에 보관되며 표시·기록용.
            발송 동작을 바꾸려면 Vercel 환경변수도 같이 업데이트하세요.
          </p>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-600">{label}</span>
      {children}
    </label>
  );
}
