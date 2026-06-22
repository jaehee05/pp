import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const NAV = [
  { to: '/dashboard', label: '대시보드', icon: '📊' },
  { to: '/seats', label: '좌석 배치', icon: '🗺️' },
  { to: '/students', label: '학생 관리', icon: '👥' },
  { to: '/attendance', label: '출입 현황', icon: '🚪' },
  { to: '/payments', label: '결제·이용권', icon: '💳' },
  { to: '/points', label: '상·벌점', icon: '⭐' },
  { to: '/schedule', label: '학습 일정', icon: '🗓️' },
];

export function Layout() {
  // /public/logo.png 가 있으면 그걸 사용, 없으면 기본 placeholder logo.svg
  const [logoSrc, setLogoSrc] = useState('/logo.png');
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <aside className="flex w-56 flex-col border-r border-slate-200 bg-white">
        <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-4">
          <img
            src={logoSrc}
            onError={() => setLogoSrc('/logo.svg')}
            alt="합격공간"
            className="h-9 w-9 rounded-full object-cover ring-1 ring-slate-200"
          />
          <div className="leading-tight">
            <div className="text-[15px] font-bold text-slate-900">합격공간</div>
            <div className="text-[10px] text-slate-500">관리형 독서실</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-2 py-3">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                  isActive
                    ? 'bg-brand-50 font-semibold text-brand-700'
                    : 'text-slate-700 hover:bg-slate-100'
                }`
              }
            >
              <span>{n.icon}</span>
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <NavLink to="/kiosk" className="btn-secondary w-full text-xs">
            🖥️ 키오스크 모드
          </NavLink>
        </div>
      </aside>
      <main className="flex-1 overflow-auto bg-slate-50">
        <Outlet />
      </main>
    </div>
  );
}
