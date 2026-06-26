import { Link } from 'react-router-dom';
import { useReleases, canEditReleases } from '../store/releases';
import { useAuth } from '../store/auth';

export function UpdatesIndexPage() {
  const list = useReleases((s) => s.list);
  const me = useAuth((s) => s.current());
  const canEdit = canEditReleases(me?.username);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">합격공간</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">릴리즈 노트</h1>
        <p className="mt-2 text-sm text-slate-600">출시 이후의 모든 업데이트 기록.</p>
        {canEdit && (
          <div className="mt-4">
            <Link
              to="/updates/_new"
              className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              + 새 릴리즈 노트
            </Link>
          </div>
        )}
      </header>

      <ol className="relative space-y-6 border-l-2 border-slate-200 pl-5">
        {list.length === 0 && <li className="text-sm text-slate-500">아직 릴리즈 노트가 없습니다.</li>}
        {list.map((r) => (
          <li key={r.slug} className="relative">
            <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-brand-600 shadow"></span>
            <Link to={`/updates/${r.slug}`} className="group block">
              <div className="text-xs text-slate-500">{r.date}</div>
              <h2 className="mt-0.5 text-lg font-bold text-slate-900 group-hover:text-brand-700">{r.title}</h2>
              <div className="mt-1 line-clamp-2 text-sm text-slate-600">
                {firstParagraph(r.body)}
              </div>
              <div className="mt-1 text-xs text-slate-400 group-hover:text-brand-600">자세히 →</div>
            </Link>
          </li>
        ))}
      </ol>

      <footer className="mt-12 text-center text-xs text-slate-400">
        <Link to="/admin/dashboard" className="hover:text-brand-600">← 관리자 홈으로</Link>
      </footer>
    </div>
  );
}

function firstParagraph(body: string): string {
  const lines = body.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
  return (lines[0] ?? '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
}
