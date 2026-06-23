import { useMemo, useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { Modal } from '../../components/Modal';
import { usePlans } from '../../store/plans';
import type { Plan } from '../../lib/types';
import { fmtMoney } from '../../lib/format';

export function PlansPage({ category }: { category: 'seat' | 'room' }) {
  const all = usePlans((s) => s.plans);
  const upsert = usePlans((s) => s.upsertPlan);
  const remove = usePlans((s) => s.removePlan);

  const list = useMemo(() => all.filter((p) => p.category === category), [all, category]);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  function newPlan() {
    setEditing({
      id: `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: '',
      category,
      seatType: category === 'seat' ? 'fixed' : undefined,
      type: 'period',
      durationDays: 30,
      price: 0,
      active: true,
      hidden: false,
    });
  }

  const visible = showHidden ? list : list.filter((p) => !p.hidden);

  return (
    <>
      <PageHeader
        title={category === 'seat' ? '좌석 이용권 관리' : '룸/사물함 이용권 관리'}
        desc="이용권을 추가·수정·삭제하고, 가격·기간·노출 여부를 관리합니다."
        actions={
          <>
            <label className="flex items-center gap-2 text-xs text-slate-500">
              <input type="checkbox" className="accent-brand-600" checked={showHidden}
                onChange={(e) => setShowHidden(e.target.checked)} />
              숨김 포함
            </label>
            <button className="btn-primary" onClick={newPlan}>+ 이용권 추가</button>
          </>
        }
      />

      <div className="p-6">
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">이름</th>
                {category === 'seat' && <th className="px-3 py-2 text-center">좌석타입</th>}
                <th className="px-3 py-2 text-center">유형</th>
                <th className="px-3 py-2 text-center">기간/시간/회차</th>
                <th className="px-3 py-2 text-right">가격</th>
                <th className="px-3 py-2 text-center">활성</th>
                <th className="px-3 py-2 text-center">숨김</th>
                <th className="px-3 py-2 text-right">동작</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-slate-400">등록된 이용권이 없습니다.</td></tr>
              )}
              {visible.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium">{p.name}</td>
                  {category === 'seat' && (
                    <td className="px-3 py-2 text-center text-xs">
                      <span className={`rounded px-2 py-0.5 ${p.seatType === 'fixed' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}`}>
                        {p.seatType === 'fixed' ? '고정석' : '자유석'}
                      </span>
                    </td>
                  )}
                  <td className="px-3 py-2 text-center">
                    {p.type === 'period' ? '기간권' : p.type === 'hours' ? '시간권' : '회차권'}
                  </td>
                  <td className="px-3 py-2 text-center text-slate-600">
                    {p.type === 'period' && `${p.durationDays}일`}
                    {p.type === 'hours' && `${p.hours}시간`}
                    {p.type === 'count' && `${p.counts}회`}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{fmtMoney(p.price)}</td>
                  <td className="px-3 py-2 text-center">{p.active ? '✅' : '⛔'}</td>
                  <td className="px-3 py-2 text-center">{p.hidden ? '🙈' : '-'}</td>
                  <td className="px-3 py-2 text-right">
                    <button className="btn-secondary mr-1" onClick={() => setEditing(p)}>수정</button>
                    <button className="btn-danger" onClick={() => confirm(`"${p.name}" 삭제할까요?`) && remove(p.id)}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <PlanForm
          plan={editing}
          onClose={() => setEditing(null)}
          onSave={(p) => { upsert(p); setEditing(null); }}
        />
      )}
    </>
  );
}

function PlanForm({ plan, onClose, onSave }: { plan: Plan; onClose: () => void; onSave: (p: Plan) => void }) {
  const [v, setV] = useState<Plan>(plan);
  return (
    <Modal
      open
      onClose={onClose}
      title={plan.name ? `이용권 수정 — ${plan.name}` : '이용권 추가'}
      width="max-w-xl"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>취소</button>
          <button className="btn-primary" onClick={() => { if (!v.name) return alert('이름을 입력하세요.'); onSave(v); }}>저장</button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 text-sm">
        <label className="col-span-2">이름
          <input className="input mt-1" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </label>
        {v.category === 'seat' && (
          <label>좌석 타입
            <select className="input mt-1" value={v.seatType ?? 'fixed'}
              onChange={(e) => setV({ ...v, seatType: e.target.value as 'fixed' | 'free' })}>
              <option value="fixed">고정석</option>
              <option value="free">자유석</option>
            </select>
          </label>
        )}
        <label>이용권 유형
          <select className="input mt-1" value={v.type}
            onChange={(e) => setV({ ...v, type: e.target.value as Plan['type'] })}>
            <option value="period">기간권</option>
            <option value="hours">시간권</option>
            <option value="count">회차권</option>
          </select>
        </label>
        {v.type === 'period' && (
          <label>기간 (일)
            <input className="input mt-1" type="number" min={1} value={v.durationDays ?? 30}
              onChange={(e) => setV({ ...v, durationDays: +e.target.value })} />
          </label>
        )}
        {v.type === 'hours' && (
          <label>시간 (h)
            <input className="input mt-1" type="number" min={1} value={v.hours ?? 10}
              onChange={(e) => setV({ ...v, hours: +e.target.value })} />
          </label>
        )}
        {v.type === 'count' && (
          <label>회차
            <input className="input mt-1" type="number" min={1} value={v.counts ?? 10}
              onChange={(e) => setV({ ...v, counts: +e.target.value })} />
          </label>
        )}
        <label>가격 (원)
          <input className="input mt-1" type="number" min={0} step={1000} value={v.price}
            onChange={(e) => setV({ ...v, price: +e.target.value })} />
        </label>
        <label className="col-span-2">설명 (선택)
          <textarea className="input mt-1" rows={2} value={v.description ?? ''}
            onChange={(e) => setV({ ...v, description: e.target.value })} />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} />
          활성 (판매·배정 가능)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!v.hidden} onChange={(e) => setV({ ...v, hidden: e.target.checked })} />
          숨김 (기본 목록에서 비노출)
        </label>
      </div>
    </Modal>
  );
}
