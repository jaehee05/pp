import { NavLink, Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { MemberPanel } from './MemberPanel';

const NAV = [
  { to: '/ops/rooms', label: '룸', icon: '🏠' },
  { to: '/ops/lockers', label: '사물함', icon: '🗄️' },
  { to: '/ops/shoes', label: '신발장', icon: '👟' },
  { to: '/ops/notices', label: '전달사항', icon: '📢' },
  { to: '/ops/reservations', label: '예약문의', icon: '🗓️' },
  { to: '/ops/register', label: '회원등록', icon: '➕' },
];

export function OpsLayout() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-20 shrink-0 flex-col items-stretch border-r border-slate-200 bg-white py-2">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 px-1 py-3 text-[11px] transition ${
                  isActive ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              <span className="text-xl leading-none">{n.icon}</span>
              <span>{n.label}</span>
            </NavLink>
          ))}
        </aside>
        <main className="flex-1 overflow-auto bg-slate-50">
          <Outlet />
        </main>
        <MemberPanel />
      </div>
    </div>
  );
}
