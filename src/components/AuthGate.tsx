import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/auth';

// persist(특히 Firestore 비동기 저장소) 하이드레이션이 끝날 때까지 대기.
function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useAuth.persist.hasHydrated());
  useEffect(() => {
    // 비동기 저장소(Firestore) 하이드레이션 완료 구독.
    // 이미 완료된 경우 초기 useState 값이 true이므로 별도 처리 불필요.
    return useAuth.persist.onFinishHydration(() => setHydrated(true));
  }, []);
  return hydrated;
}

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <img src="/logo.png" alt="" className="h-12 w-12 animate-pulse rounded-full object-cover" />
        <span className="text-sm">불러오는 중…</span>
      </div>
    </div>
  );
}

// 로그인된 사용자만 children 렌더. 비로그인 시 /login으로.
export function RequireAuth({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const currentId = useAuth((s) => s.currentId);
  const loc = useLocation();

  if (!hydrated) return <Splash />;
  if (!currentId) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}
