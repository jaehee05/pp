import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { messaging, type MessageRecord } from '../../lib/messaging';
import { fmtDateTime, fmtPhone } from '../../lib/format';

export function MessagesHistory() {
  const [list, setList] = useState<MessageRecord[]>([]);
  const [filter, setFilter] = useState<'all' | 'sent' | 'mock' | 'failed'>('all');

  useEffect(() => {
    setList(messaging.recent(200));
    const t = setInterval(() => setList(messaging.recent(200)), 3000);
    return () => clearInterval(t);
  }, []);

  const visible = filter === 'all' ? list : list.filter((r) => r.status === filter);

  return (
    <>
      <PageHeader
        title="발송 이력"
        desc="자동 발송된 문자(SMS/LMS) 이력입니다. 3초마다 갱신."
        actions={
          <div className="rounded-md bg-slate-100 p-0.5 text-sm">
            {(['all', 'sent', 'mock', 'failed'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1 ${filter === f ? 'bg-white shadow-sm font-semibold' : 'text-slate-600'}`}>
                {f === 'all' ? '전체' : f === 'sent' ? '발송' : f === 'mock' ? 'Mock' : '실패'}
              </button>
            ))}
          </div>
        }
      />
      <div className="p-6">
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">시각</th>
                <th className="px-3 py-2 text-left">수신</th>
                <th className="px-3 py-2 text-center">채널</th>
                <th className="px-3 py-2 text-left">트리거</th>
                <th className="px-3 py-2 text-left">본문</th>
                <th className="px-3 py-2 text-center">상태</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-10 text-center text-slate-400">발송 이력 없음</td></tr>
              )}
              {visible.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-600">{fmtDateTime(new Date(r.ts))}</td>
                  <td className="px-3 py-2">{fmtPhone(r.to)}</td>
                  <td className="px-3 py-2 text-center text-xs">{r.channel.toUpperCase()}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{r.template}</td>
                  <td className="max-w-md truncate px-3 py-2 text-xs text-slate-600">{r.message}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={
                      r.status === 'sent' ? 'rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700' :
                      r.status === 'mock' ? 'rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700' :
                      r.status === 'failed' ? 'rounded bg-rose-100 px-2 py-0.5 text-xs text-rose-700' :
                      'rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600'
                    }>{r.status}</span>
                    {r.error && <div className="mt-0.5 text-[10px] text-slate-400" title={r.error}>{r.error.slice(0, 40)}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
