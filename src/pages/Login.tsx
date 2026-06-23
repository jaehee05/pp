import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { useBranding } from '../store/branding';

export function LoginPage() {
  const login = useAuth((s) => s.login);
  const hasOnlyTemp = useAuth((s) => s.hasOnlyTemp);
  const { brand, storeName } = useBranding();
  const nav = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const res = await login(username, password);
    setBusy(false);
    if (res.ok) nav('/admin/dashboard', { replace: true });
    else setError(res.error ?? '로그인에 실패했습니다.');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src="/logo.png" alt={brand} className="mb-3 h-16 w-16 rounded-full object-cover" />
          <h1 className="text-xl font-bold text-slate-900">{brand}</h1>
          <p className="text-sm text-slate-500">{storeName} 관리자 로그인</p>
        </div>

        <form onSubmit={onSubmit} className="card space-y-4 p-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">아이디</label>
            <input
              className="input"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="아이디"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">비밀번호</label>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" className="btn-primary w-full py-2.5" disabled={busy}>
            {busy ? '로그인 중…' : '로그인'}
          </button>

          {hasOnlyTemp() && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">
              최초 로그인: 임시 계정 <b>admin</b> / <b>admin1234!</b> 으로 로그인한 뒤
              관리자 계정을 생성하면 임시 계정은 자동 삭제됩니다.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
