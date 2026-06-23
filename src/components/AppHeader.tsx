import { useLocation, useNavigate } from 'react-router-dom';
import { useBranding } from '../store/branding';

export function AppHeader() {
  const { brand, storeName, managerName } = useBranding();
  const loc = useLocation();
  const nav = useNavigate();
  const isOps = loc.pathname.startsWith('/ops');
  const isAdmin = loc.pathname.startsWith('/admin');

  function switchTo(area: 'admin' | 'ops') {
    if (area === 'admin') nav('/admin/dashboard');
    else nav('/ops/register');
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-slate-900">{brand} {storeName}</h1>
        <div className="ml-2 inline-flex rounded-full bg-slate-100 p-0.5 text-sm">
          <button
            onClick={() => switchTo('admin')}
            className={`rounded-full px-4 py-1 transition ${isAdmin ? 'bg-brand-600 text-white font-semibold' : 'text-slate-600'}`}
          >관리</button>
          <button
            onClick={() => switchTo('ops')}
            className={`rounded-full px-4 py-1 transition ${isOps ? 'bg-brand-600 text-white font-semibold' : 'text-slate-600'}`}
          >운영</button>
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-slate-700">{managerName}님</span>
        <button title="로그아웃" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
          <span className="inline-block">⎋</span>
        </button>
      </div>
    </header>
  );
}
