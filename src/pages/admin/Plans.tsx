import { useMemo, useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { Modal } from '../../components/Modal';
import { usePlans } from '../../store/plans';
import type { Plan } from '../../lib/types';
import { fmtMoney } from '../../lib/format';

function periodLabel(p: Plan): string {
  if (p.type === 'period') {
    if (p.durationMonths) {
      if (p.durationMonths === 12) return '1년';
      return `${p.durationMonths}개월`;
    }
    if (p.durationDays != null) {
      if (p.durationDays === 1) return '1일';
      if (p.durationDays === 7) return '1주';
      if (p.durationDays === 14) return '2주';
      if (p.durationDays === 365) return '1년 (일)';
      return `${p.durationDays}일`;
    }
  }
  if (p.type === 'hours') return `${p.hours}시간`;
  if (p.type === 'count') return `${p.counts}회`;
  return '-';
}

export function PlansPage({ category }: { category: 'seat' | 'room' }) {
  const all = usePlans((s) => s.plans);
  const upsert = usePlans((s) => s.upsertPlan);
  const remove = usePlans((s) => s.removePlan);
  const reorder = usePlans((s) => s.reorderPlan);
  const reapplyPlanToSubs = usePlans((s) => s.reapplyPlanToSubs);

  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [overPos, setOverPos] = useState<'before' | 'after'>('before');

  function onDragStart(id: string) { setDragId(id); }
  function onDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id === dragId) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const middle = rect.top + rect.height / 2;
    setOverId(id);
    setOverPos(e.clientY < middle ? 'before' : 'after');
  }
  function onDragEnd() { setDragId(null); setOverId(null); }
  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) { onDragEnd(); return; }
    reorder(dragId, targetId, overPos);
    onDragEnd();
  }

  const list = useMemo(() => all.filter((p) => p.category === category), [all, category]);
  const [editing, setEditing] = useState<Plan | null>(null);

  function newPlan() {
    setEditing({
      id: `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: '',
      category,
      seatType: category === 'seat' ? 'fixed' : undefined,
      kind: '일반',
      type: 'period',
      durationMonths: 1,
      taxFreeAmount: 0,
      taxableAmount: 0,
      price: 0,
      active: true,
      hidden: false,
      includesLocker: false,
    });
  }

  function toggleHide(p: Plan) {
    upsert({ ...p, hidden: !p.hidden });
  }

  return (
    <>
      <PageHeader
        title={category === 'seat' ? '좌석 이용권 관리' : '룸/사물함 이용권 관리'}
        desc="과세/비과세 분리, 할인정책, 사물함 포함 여부 등을 관리합니다."
        actions={
          <>
            <button
              className="mr-2 rounded-md bg-white px-3 py-1.5 text-sm ring-1 ring-slate-300 hover:bg-slate-50"
              title="이용권을 수정한 뒤, 이 버튼을 누르면 기존 회원들의 활성 이용권 만료일을 현재 이용권 설정으로 다시 계산합니다."
              onClick={() => {
                if (!confirm('기존 활성 이용권들의 만료일을 현재 이용권 설정으로 일괄 재계산합니다.\n(수동으로 조정했던 만료일은 덮어씌워집니다)\n\n진행할까요?')) return;
                const n = reapplyPlanToSubs();
                alert(`✓ ${n}건의 이용권 만료일이 갱신되었습니다.`);
              }}
            >🔁 이용권 만료일 일괄 재계산</button>
            <button className="btn-primary" onClick={newPlan}>+ 이용권 추가</button>
          </>
        }
      />

      <div className="p-6">
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 text-center">NO</th>
                <th className="px-3 py-2 text-left">기간</th>
                <th className="px-3 py-2 text-left">구분</th>
                {category === 'seat' && <th className="px-3 py-2 text-left">좌석</th>}
                <th className="px-3 py-2 text-right">메인 (독서실)</th>
                <th className="px-3 py-2 text-right">서브 (교습소)</th>
                <th className="px-3 py-2 text-right">합계</th>
                <th className="px-3 py-2 text-left">설명</th>
                <th className="px-3 py-2 text-left">할인정책</th>
                <th className="px-3 py-2 text-center">사물함</th>
                <th className="px-3 py-2 text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && (
                <tr><td colSpan={11} className="px-3 py-10 text-center text-slate-400">등록된 이용권이 없습니다.</td></tr>
              )}
              {list.map((p, i) => {
                const hidden = !!p.hidden;
                const rowCls = hidden ? 'text-slate-400 line-through' : '';
                const isDragging = dragId === p.id;
                const showTopLine = overId === p.id && overPos === 'before' && dragId !== p.id;
                const showBottomLine = overId === p.id && overPos === 'after' && dragId !== p.id;
                return (
                  <tr
                    key={p.id}
                    draggable
                    onDragStart={() => onDragStart(p.id)}
                    onDragOver={(e) => onDragOver(e, p.id)}
                    onDragLeave={() => { if (overId === p.id) setOverId(null); }}
                    onDrop={() => onDrop(p.id)}
                    onDragEnd={onDragEnd}
                    className={`border-t border-slate-100 hover:bg-slate-50 ${
                      isDragging ? 'opacity-40' : ''
                    } ${showTopLine ? 'shadow-[inset_0_3px_0_0_#3b82f6]' : ''} ${
                      showBottomLine ? 'shadow-[inset_0_-3px_0_0_#3b82f6]' : ''
                    }`}
                    style={{ cursor: 'grab' }}
                  >
                    <td className={`px-3 py-2 text-center text-slate-500 ${rowCls}`}>
                      <span className="mr-1 cursor-grab select-none text-slate-300">⋮⋮</span>{i + 1}
                    </td>
                    <td className={`px-3 py-2 ${rowCls}`}>{periodLabel(p)}</td>
                    <td className={`px-3 py-2 ${rowCls}`}>{p.kind ?? '일반'}</td>
                    {category === 'seat' && (
                      <td className={`px-3 py-2 ${rowCls}`}>
                        <span className={`rounded px-2 py-0.5 text-xs ${
                          hidden ? 'bg-slate-100 text-slate-400' :
                          p.seatType === 'fixed' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'
                        }`}>
                          {p.seatType === 'fixed' ? '고정석' : '자유석'}
                        </span>
                      </td>
                    )}
                    <td className={`px-3 py-2 text-right font-mono ${rowCls} ${(p.taxFreeAmount ?? 0) > 0 ? 'text-sky-700' : 'text-slate-400'}`}>
                      {fmtMoney(p.taxFreeAmount ?? 0)}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono ${rowCls} ${(p.taxableAmount ?? 0) > 0 ? 'text-violet-700' : 'text-slate-400'}`}>
                      {fmtMoney(p.taxableAmount ?? 0)}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono font-semibold ${rowCls}`}>{fmtMoney(p.price)}</td>
                    <td className={`px-3 py-2 ${rowCls}`}>{p.description ?? ''}</td>
                    <td className={`px-3 py-2 ${rowCls}`}>{p.discountPolicy ?? ''}</td>
                    <td className={`px-3 py-2 text-center ${rowCls}`}>{p.includesLocker ? '포함' : '-'}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => toggleHide(p)}
                        className={`mr-1 rounded-md px-2 py-1 text-xs ${
                          hidden ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {hidden ? '보임' : '숨김'}
                      </button>
                      <button className="btn-secondary mr-1" disabled={hidden} onClick={() => setEditing(p)}>수정</button>
                      <button className="btn-danger" disabled={hidden}
                        onClick={() => confirm(`"${p.name}" 삭제할까요?`) && remove(p.id)}>삭제</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <PlanForm
          plan={editing}
          onClose={() => setEditing(null)}
          onSave={(p) => { upsert({ ...p, price: (p.taxFreeAmount ?? 0) + (p.taxableAmount ?? 0) }); setEditing(null); }}
        />
      )}
    </>
  );
}

function PlanForm({ plan, onClose, onSave }: { plan: Plan; onClose: () => void; onSave: (p: Plan) => void }) {
  const [v, setV] = useState<Plan>(plan);
  const total = (v.taxFreeAmount ?? 0) + (v.taxableAmount ?? 0);

  return (
    <Modal
      open
      onClose={onClose}
      title={plan.name ? `이용권 수정 — ${plan.name}` : '이용권 추가'}
      width="max-w-2xl"
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
        <label>구분 (회원 종류)
          <select className="input mt-1" value={v.kind ?? '일반'}
            onChange={(e) => setV({ ...v, kind: e.target.value })}>
            <option value="일반">일반</option>
            <option value="학생">학생</option>
            <option value="성인">성인</option>
            <option value="기타">기타</option>
          </select>
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
          <>
            <label>기간 단위
              <select
                className="input mt-1"
                value={v.durationMonths != null ? 'month' : 'day'}
                onChange={(e) => {
                  if (e.target.value === 'month') {
                    setV({ ...v, durationMonths: v.durationMonths ?? 1, durationDays: undefined });
                  } else {
                    setV({ ...v, durationDays: v.durationDays ?? 30, durationMonths: undefined });
                  }
                }}>
                <option value="month">개월 (캘린더 — 시작 월의 마지막 날까지)</option>
                <option value="day">일 (정확히 N일)</option>
              </select>
            </label>
            {v.durationMonths != null ? (
              <label>기간 (개월)
                <input className="input mt-1" type="number" min={1} value={v.durationMonths}
                  onChange={(e) => setV({ ...v, durationMonths: +e.target.value, durationDays: undefined })} />
              </label>
            ) : (
              <label>기간 (일)
                <input className="input mt-1" type="number" min={1} value={v.durationDays ?? 30}
                  onChange={(e) => setV({ ...v, durationDays: +e.target.value, durationMonths: undefined })} />
              </label>
            )}
          </>
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

        <div className="col-span-2 rounded-md bg-slate-50 p-3">
          <p className="mb-2 text-xs text-slate-500">
            결제 시 두 사업자로 자동 분할됨. 한쪽 0으로 두면 그쪽 거래 생략.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <label>메인 사업자 결제 (원)
              <span className="ml-1 text-[10px] text-sky-600">독서실</span>
              <input className="input mt-1 text-right font-mono" type="number" min={0} step={100}
                value={v.taxFreeAmount ?? 0}
                onChange={(e) => setV({ ...v, taxFreeAmount: +e.target.value })} />
            </label>
            <label>서브 사업자 결제 (원)
              <span className="ml-1 text-[10px] text-violet-600">교습소</span>
              <input className="input mt-1 text-right font-mono" type="number" min={0} step={100}
                value={v.taxableAmount ?? 0}
                onChange={(e) => setV({ ...v, taxableAmount: +e.target.value })} />
            </label>
            <label>합계금액 (자동)
              <input className="input mt-1 bg-white text-right font-mono font-semibold" type="number" value={total} readOnly />
            </label>
          </div>
        </div>

        <label className="col-span-2">설명 (선택)
          <textarea className="input mt-1" rows={2} value={v.description ?? ''}
            onChange={(e) => setV({ ...v, description: e.target.value })} />
        </label>
        <label className="col-span-2">할인정책 (선택)
          <input className="input mt-1" value={v.discountPolicy ?? ''}
            onChange={(e) => setV({ ...v, discountPolicy: e.target.value })}
            placeholder="예: 분두 1과목 할인(5%) / 형제 할인 10% / 비원생 정상가(0%)" />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!v.includesLocker}
            onChange={(e) => setV({ ...v, includesLocker: e.target.checked })} />
          사물함 포함
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} />
          활성 (판매·배정 가능)
        </label>
      </div>
    </Modal>
  );
}
