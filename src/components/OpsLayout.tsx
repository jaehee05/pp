import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { MemberPanel } from './MemberPanel';

const NAV = [
  { to: '/ops/layout', label: '배치도', icon: '🧩' },
  { to: '/ops/rooms', label: '룸', icon: '🏠' },
  { to: '/ops/lockers', label: '사물함', icon: '🗄️' },
  { to: '/ops/shoes', label: '신발장', icon: '👟' },
  { to: '/ops/notices', label: '전달사항', icon: '📢' },
  { to: '/ops/reservations', label: '예약문의', icon: '🗓️' },
  { to: '/ops/register', label: '회원등록', icon: '➕' },
];

export function OpsLayout() {
  const [nav, setNav] = useState(false);       // 좌측 메뉴 드로어 (모바일)
  const [members, setMembers] = useState(false); // 우측 회원 패널 드로어 (모바일)

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <AppHeader onMenu={() => setNav(true)} />
      <div className="relative flex flex-1 overflow-hidden">
        {/* 좌측 메뉴 백드롭 (모바일) */}
        {nav && <div className="fixed inset-0 top-14 z-30 bg-black/30 md:hidden" onClick={() => setNav(false)} />}
        <aside
          className={`fixed inset-y-0 left-0 top-14 z-40 flex w-20 shrink-0 transform flex-col items-stretch border-r border-slate-200 bg-white py-2 transition-transform duration-200 md:static md:top-0 md:translate-x-0 ${
            nav ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              onClick={() => setNav(false)}
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

        {/* 우측 회원 패널: lg 이상 고정, 모바일은 드로어 */}
        {members && <div className="fixed inset-0 top-14 z-30 bg-black/30 lg:hidden" onClick={() => setMembers(false)} />}
        <div
          className={`fixed inset-y-0 right-0 top-14 z-40 flex transform transition-transform duration-200 lg:static lg:top-0 lg:translate-x-0 ${
            members ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
          }`}
        >
          <MemberPanel onClose={() => setMembers(false)} />
        </div>

        {/* 모바일 회원 패널 토글 버튼 */}
        <button
          onClick={() => setMembers(true)}
          className="btn-primary fixed bottom-5 right-5 z-20 h-12 w-12 rounded-full p-0 text-lg shadow-lg lg:hidden"
          aria-label="회원 패널 열기"
        >👤</button>
      </div>
    </div>
  );
}
