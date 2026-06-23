import { useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { useAuth } from '../../store/auth';

export function AccountPage() {
  const accounts = useAuth((s) => s.accounts);
  const current = useAuth((s) => s.current());
  const hasOnlyTemp = useAuth((s) => s.hasOnlyTemp());
  const createAdmin = useAuth((s) => s.createAdmin);
  const changePassword = useAuth((s) => s.changePassword);
  const removeAccount = useAuth((s) => s.removeAccount);

  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (password !== password2) {
      setMsg({ kind: 'err', text: '비밀번호가 일치하지 않습니다.' });
      return;
    }
    setBusy(true);
    const res = await createAdmin({ username, password, name });
    setBusy(false);
    if (res.ok) {
      setMsg({ kind: 'ok', text: '관리자 계정이 생성되었습니다.' });
      setUsername(''); setName(''); setPassword(''); setPassword2('');
    } else {
      setMsg({ kind: 'err', text: res.error ?? '생성에 실패했습니다.' });
    }
  }

  async function onChangePassword(id: string) {
    const pw = window.prompt('새 비밀번호 (6자 이상)');
    if (pw == null) return;
    const res = await changePassword(id, pw);
    setMsg(res.ok
      ? { kind: 'ok', text: '비밀번호가 변경되었습니다.' }
      : { kind: 'err', text: res.error ?? '변경 실패' });
  }

  function onRemove(id: string) {
    if (!window.confirm('이 계정을 삭제할까요?')) return;
    const res = removeAccount(id);
    if (!res.ok) setMsg({ kind: 'err', text: res.error ?? '삭제 실패' });
  }

  return (
    <>
      <PageHeader title="관리자 계정" desc="로그인 계정 관리" />
      <div className="space-y-6 p-4 sm:p-6">
        {hasOnlyTemp && (
          <div className="card border-l-4 border-amber-400 bg-amber-50 p-4 text-sm text-amber-800">
            <b>임시 계정으로 사용 중입니다.</b> 아래에서 실제 관리자 계정을 생성하면
            임시 계정(<code>admin</code>)은 자동으로 삭제됩니다.
          </div>
        )}

        {msg && (
          <div className={`rounded-md px-3 py-2 text-sm ${
            msg.kind === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {msg.text}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 계정 생성 */}
          <form onSubmit={onCreate} className="card space-y-4 p-5">
            <h2 className="text-base font-semibold text-slate-900">관리자 계정 생성</h2>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">아이디</label>
              <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="영문/숫자 아이디" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">이름</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="표시 이름" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">비밀번호</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6자 이상" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">비밀번호 확인</label>
              <input className="input" type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="다시 입력" />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? '생성 중…' : '계정 생성'}
            </button>
          </form>

          {/* 계정 목록 */}
          <div className="card p-5">
            <h2 className="mb-4 text-base font-semibold text-slate-900">계정 목록</h2>
            <ul className="space-y-2">
              {accounts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-slate-800">{a.name}</span>
                      {a.temp && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-700">임시</span>}
                      {current?.id === a.id && <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[11px] text-brand-700">현재</span>}
                    </div>
                    <div className="truncate text-xs text-slate-500">@{a.username}</div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {!a.temp && (
                      <button onClick={() => onChangePassword(a.id)} className="btn-secondary px-2 py-1 text-xs">비번변경</button>
                    )}
                    <button onClick={() => onRemove(a.id)} className="btn-danger px-2 py-1 text-xs">삭제</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
