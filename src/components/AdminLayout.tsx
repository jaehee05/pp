import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { PaymentMockBanner } from './PaymentMockBanner';

interface NavItem {
  to?: string;
  label: string;
  icon: string;
  children?: { to: string; label: string }[];
}

const NAV: NavItem[] = [
  { to: '/admin/dashboard', label: '대시보드', icon: '◧' },
  {
    label: '매출 관리', icon: '📈', children: [
      { to: '/admin/sales/daily', label: '일별 매출' },
      { to: '/admin/sales/payments', label: '결제 내역' },
      { to: '/admin/sales/refunds', label: '환불 내역' },
    ],
  },
  { to: '/admin/members', label: '회원 관리', icon: '👤' },
  {
    label: '매장 관리', icon: '🏬', children: [
      { to: '/admin/store/info', label: '매장 정보' },
      { to: '/admin/store/managers', label: '매니저 관리' },
      { to: '/admin/store/hours', label: '운영 시간' },
      { to: '/admin/account', label: '관리자 계정' },
    ],
  },
  { to: '/admin/seat-plans', label: '좌석 이용권 관리', icon: '🎫' },
  {
    label: '메시지 발송 관리', icon: '💬', children: [
      { to: '/admin/messages/templates', label: '템플릿' },
      { to: '/admin/messages/ppurio', label: '뿌리오 설정' },
      { to: '/admin/messages/history', label: '발송 이력' },
      { to: '/admin/messages/balance', label: '잔여 캐시/포인트' },
    ],
  },
  {
    label: '배치도 관리', icon: '🧩', children: [
      { to: '/admin/layouts/seats', label: '좌석 배치' },
    ],
  },
];

export function AdminLayout() {
  const [drawer, setDrawer] = useState(false);
  const close = () => setDrawer(false);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <AppHeader onMenu={() => setDrawer(true)} />
      <PaymentMockBanner />
      <div className="relative flex flex-1 overflow-hidden">
        {/* 모바일 백드롭 */}
        {drawer && (
          <div className="fixed inset-0 top-14 z-[60] bg-black/30 md:hidden" onClick={close} />
        )}
        <aside
          className={`fixed inset-y-0 left-0 top-14 z-[70] flex w-60 shrink-0 transform flex-col border-r border-slate-200 bg-white transition-transform duration-200 md:static md:top-0 md:translate-x-0 md:z-auto ${
            drawer ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
            {NAV.map((n) => <NavGroup key={n.label} item={n} onNavigate={close} />)}
          </nav>
        </aside>
        <main className="flex-1 overflow-auto bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavGroup({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const [open, setOpen] = useState(true);
  if (item.to) {
    return (
      <NavLink
        to={item.to}
        onClick={onNavigate}
        className={({ isActive }) =>
          `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
            isActive ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-700 hover:bg-slate-100'
          }`
        }
      >
        <span className="text-base">{item.icon}</span>
        <span>{item.label}</span>
      </NavLink>
    );
  }
  return (
    <div>
      <button onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
        <span className="flex items-center gap-2"><span className="text-base">{item.icon}</span>{item.label}</span>
        <span className="text-xs text-slate-400">{open ? '▾' : '▸'}</span>
      </button>
      {open && item.children && (
        <div className="ml-7 mt-0.5 space-y-0.5 border-l border-slate-100 pl-2">
          {item.children.map((c) => (
            <NavLink
              key={c.to}
              to={c.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                `block rounded-md px-3 py-1.5 text-[13px] transition ${
                  isActive ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >{c.label}</NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
