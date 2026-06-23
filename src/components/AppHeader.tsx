import { useLocation, useNavigate } from 'react-router-dom';
import { useBranding } from '../store/branding';
import { useAuth } from '../store/auth';

export function AppHeader({ onMenu }: { onMenu?: () => void }) {
  const { brand, storeName } = useBranding();
  const account = useAuth((s) => s.current());
  const logout = useAuth((s) => s.logout);
  const loc = useLocation();
  const nav = useNavigate();
  const isOps = loc.pathname.startsWith('/ops');
  const isAdmin = loc.pathname.startsWith('/admin');

  function switchTo(area: 'admin' | 'ops') {
    if (area === 'admin') nav('/admin/dashboard');
    else nav('/ops/layout');
  }

  function onLogout() {
    logout();
    nav('/login', { replace: true });
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {onMenu && (
          <button
            onClick={onMenu}
            aria-label="메뉴 열기"
            className="-ml-1 rounded-md p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          >
            <span className="block text-lg leading-none">☰</span>
          </button>
        )}
        <h1 className="truncate text-base font-bold text-slate-900 sm:text-lg">
          {brand} <span className="hidden font-medium text-slate-500 sm:inline">{storeName}</span>
        </h1>
        <div className="ml-1 inline-flex shrink-0 rounded-full bg-slate-100 p-0.5 text-xs sm:ml-2 sm:text-sm">
          <button
            onClick={() => switchTo('admin')}
            className={`rounded-full px-3 py-1 transition sm:px-4 ${isAdmin ? 'bg-brand-600 text-white font-semibold' : 'text-slate-600'}`}
          >관리</button>
          <button
            onClick={() => switchTo('ops')}
            className={`rounded-full px-3 py-1 transition sm:px-4 ${isOps ? 'bg-brand-600 text-white font-semibold' : 'text-slate-600'}`}
          >운영</button>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-sm sm:gap-3">
        <span className="hidden text-slate-700 sm:inline">{account?.name ?? '게스트'}님</span>
        <button
          onClick={onLogout}
          title="로그아웃"
          aria-label="로그아웃"
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          <span className="inline-block">⎋</span>
        </button>
      </div>
    </header>
  );
}
