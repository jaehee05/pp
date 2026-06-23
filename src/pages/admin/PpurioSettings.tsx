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
    channel: cfg.channel,
    templateEnter: cfg.templateEnter,
    templateExit: cfg.templateExit,
    templateNoShow: cfg.templateNoShow,
    notice: cfg.notice,
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

        <div className="card p-6">
          <h3 className="mb-4 font-semibold">자동 알림 채널 + 템플릿</h3>
          <p className="mb-3 text-xs text-slate-500">
            입실/퇴실/미입실 자동 알림을 SMS로 보낼지, 카카오 알림톡으로 보낼지 선택.
            알림톡은 PPURIO에 사전 등록한 템플릿 코드 필요.
          </p>
          <div className="mb-4 inline-flex overflow-hidden rounded-md ring-1 ring-slate-300">
            {(['sms', 'kakao'] as const).map((c) => (
              <button key={c} type="button" onClick={() => setDraft({ ...draft, channel: c })}
                className={`px-5 py-2 text-sm font-medium ${draft.channel === c ? 'bg-brand-600 text-white' : 'bg-white text-slate-600'}`}>
                {c === 'sms' ? '📱 SMS/LMS' : '💬 카카오 알림톡'}
              </button>
            ))}
          </div>

          {draft.channel === 'kakao' && (
            <div className="space-y-3 rounded-md bg-slate-50 p-4 text-sm">
              <p className="text-xs text-slate-500">
                템플릿 본문에 [*이름*] [*1*] [*2*] 변수가 있어야 자동 치환됨.
                <br />[*이름*] = 학생 이름, [*1*] = 시간(입실/퇴실/예정), [*2*] = 공통 공지(아래 입력)
              </p>
              <Field label="입실 안내 templateCode">
                <input className="input font-mono" value={draft.templateEnter}
                  onChange={(e) => setDraft({ ...draft, templateEnter: e.target.value })}
                  placeholder="PPURIO 콘솔의 템플릿 코드" />
              </Field>
              <Field label="퇴실 안내 templateCode">
                <input className="input font-mono" value={draft.templateExit}
                  onChange={(e) => setDraft({ ...draft, templateExit: e.target.value })}
                  placeholder="PPURIO 콘솔의 템플릿 코드" />
              </Field>
              <Field label="미입실 안내 templateCode">
                <input className="input font-mono" value={draft.templateNoShow}
                  onChange={(e) => setDraft({ ...draft, templateNoShow: e.target.value })}
                  placeholder="PPURIO 콘솔의 템플릿 코드" />
              </Field>
            </div>
          )}
          {draft.channel === 'sms' && (
            <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-700">
              SMS 모드 — 알림톡 템플릿 코드는 사용하지 않습니다. 메시지는 본문에 공통 공지가 함께 붙어 발송.
              한글 45자(90byte) 넘으면 자동으로 LMS로 승격.
            </p>
          )}
        </div>

        <div className="card p-6">
          <h3 className="mb-3 font-semibold">공통 공지 ([*2*] 치환값)</h3>
          <p className="mb-2 text-xs text-slate-500">알림톡/SMS 본문에 자동으로 붙는 안내 문구.</p>
          <textarea className="input font-mono" rows={5} value={draft.notice}
            onChange={(e) => setDraft({ ...draft, notice: e.target.value })}
            placeholder="예: 문의: 010-XXXX-XXXX&#10;합격공간 분당정자점" />
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
