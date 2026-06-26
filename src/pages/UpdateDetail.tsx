import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useReleases, canEditReleases, renderReleaseBody } from '../store/releases';
import { useAuth } from '../store/auth';

export function UpdateDetailPage() {
  const { slug = '' } = useParams();
  const isNew = slug === '_new';
  const list = useReleases((s) => s.list);
  const upsert = useReleases((s) => s.upsert);
  const remove = useReleases((s) => s.remove);
  const me = useAuth((s) => s.current());
  const canEdit = canEditReleases(me?.username);
  const nav = useNavigate();

  const rec = isNew ? null : list.find((x) => x.slug === slug) ?? null;

  const [edit, setEdit] = useState(isNew);
  const [form, setForm] = useState({
    slug: rec?.slug ?? 'v1_006',
    title: rec?.title ?? '',
    date: rec?.date ?? new Date().toISOString().slice(0, 10),
    body: rec?.body ?? '## 새 기능\n- ',
  });

  useEffect(() => {
    if (rec) setForm({ slug: rec.slug, title: rec.title, date: rec.date, body: rec.body });
  }, [rec?.slug]);

  if (!isNew && !rec) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="text-sm text-slate-500">릴리즈 노트를 찾을 수 없습니다.</p>
        <Link to="/updates" className="mt-3 inline-block text-sm text-brand-600 hover:underline">← 목록으로</Link>
      </div>
    );
  }

  const save = () => {
    if (!canEdit) return;
    const slugClean = form.slug.trim().replace(/[^a-zA-Z0-9_\-.]/g, '_');
    if (!slugClean) { alert('slug 필요'); return; }
    if (!form.title.trim()) { alert('제목 필요'); return; }
    upsert({
      slug: slugClean,
      title: form.title.trim(),
      date: form.date,
      body: form.body,
      createdAt: rec?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    });
    setEdit(false);
    if (isNew || slugClean !== slug) nav(`/updates/${slugClean}`, { replace: true });
  };

  const del = () => {
    if (!canEdit || !rec) return;
    if (!confirm(`"${rec.title}" 정말 삭제할까요?`)) return;
    remove(rec.slug);
    nav('/updates', { replace: true });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <Link to="/updates" className="text-xs text-slate-500 hover:text-brand-600">← 모든 릴리즈 노트</Link>

      {!edit && rec && (
        <article className="mt-3">
          <p className="text-xs text-slate-500">{rec.date} · <span className="font-mono">{rec.slug}</span></p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">{rec.title}</h1>
          {canEdit && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setEdit(true)}
                className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
              >
                ✏️ 수정
              </button>
              <button
                onClick={del}
                className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-300 hover:bg-rose-50"
              >
                🗑 삭제
              </button>
            </div>
          )}
          <div className="prose prose-sm mt-6 max-w-none text-slate-700">
            {renderReleaseBody(rec.body)}
          </div>
          <p className="mt-10 text-right text-xs text-slate-400">
            최종 수정: {new Date(rec.updatedAt).toISOString().slice(0, 10)}
          </p>
        </article>
      )}

      {edit && canEdit && (
        <div className="mt-4 space-y-3">
          <h2 className="text-lg font-bold">{isNew ? '새 릴리즈 노트' : '릴리즈 노트 수정'}</h2>
          <div className="grid grid-cols-3 gap-3">
            <label className="col-span-1 text-sm">
              <div className="mb-1 font-semibold text-slate-700">slug (URL)</div>
              <input
                className="input font-mono"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="v1_006"
              />
              <p className="mt-1 text-[11px] text-slate-500">/updates/{form.slug || '?'}</p>
            </label>
            <label className="col-span-1 text-sm">
              <div className="mb-1 font-semibold text-slate-700">날짜</div>
              <input
                type="date"
                className="input"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </label>
            <label className="col-span-1 text-sm">
              <div className="mb-1 font-semibold text-slate-700">&nbsp;</div>
              <div className="text-xs text-slate-500">편집자: <b>{me?.username}</b></div>
            </label>
          </div>
          <label className="block text-sm">
            <div className="mb-1 font-semibold text-slate-700">제목</div>
            <input
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="v1.0.6 — ..."
            />
          </label>
          <label className="block text-sm">
            <div className="mb-1 font-semibold text-slate-700">본문 (마크다운-lite)</div>
            <textarea
              className="input min-h-[280px] font-mono text-[13px]"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
            <p className="mt-1 text-[11px] text-slate-500">
              <code>## 제목</code> · <code>- 불릿</code> · <code>**굵게**</code> · <code>`코드`</code> · 빈 줄 = 단락
            </p>
          </label>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 text-xs font-semibold text-slate-600">미리보기</div>
            <div className="text-sm text-slate-700">{renderReleaseBody(form.body)}</div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={save}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              저장
            </button>
            <button
              onClick={() => {
                if (isNew) nav('/updates');
                else setEdit(false);
              }}
              className="rounded-md bg-white px-4 py-2 text-sm ring-1 ring-slate-300 hover:bg-slate-100"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {edit && !canEdit && (
        <p className="mt-6 rounded-md bg-rose-50 p-4 text-sm text-rose-700">
          수정 권한이 없습니다. (계정 <b>jaehee05</b> 만 편집 가능)
        </p>
      )}
    </div>
  );
}
