import { useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { Modal } from '../../components/Modal';
import { useTemplates, type LocalTemplate } from '../../store/messageTemplates';

export function MessagesTemplates() {
  const list = useTemplates((s) => s.list);
  const upsert = useTemplates((s) => s.upsert);
  const remove = useTemplates((s) => s.remove);
  const [editing, setEditing] = useState<LocalTemplate | null>(null);

  function newOne() {
    setEditing({
      id: `t_${Date.now().toString(36)}`,
      name: '', trigger: 'custom', channel: 'sms', body: '', active: true,
    });
  }

  return (
    <>
      <PageHeader
        title="메시지 템플릿"
        desc="입퇴실·미입실 등 발송 트리거별 메시지 본문을 관리합니다. 변수 {name} {time} {duration} {scheduledStart} 치환."
        actions={<button className="btn-primary" onClick={newOne}>+ 템플릿 추가</button>}
      />

      <div className="p-6">
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">이름</th>
                <th className="px-3 py-2 text-left">트리거</th>
                <th className="px-3 py-2 text-center">채널</th>
                <th className="px-3 py-2 text-left">본문</th>
                <th className="px-3 py-2 text-center">활성</th>
                <th className="px-3 py-2 text-right">동작</th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium">{t.name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{t.trigger}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={
                      t.channel === 'lms' ? 'rounded bg-sky-100 px-2 py-0.5 text-xs text-sky-700' :
                      'rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700'
                    }>{t.channel.toUpperCase()}</span>
                  </td>
                  <td className="max-w-xl px-3 py-2 text-xs text-slate-600 truncate">{t.body}</td>
                  <td className="px-3 py-2 text-center">{t.active ? '✅' : '⛔'}</td>
                  <td className="px-3 py-2 text-right">
                    <button className="btn-secondary mr-1" onClick={() => setEditing(t)}>수정</button>
                    <button className="btn-danger" onClick={() => confirm(`"${t.name}" 삭제할까요?`) && remove(t.id)}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <TemplateForm template={editing}
          onClose={() => setEditing(null)}
          onSave={(t) => { upsert(t); setEditing(null); }} />
      )}
    </>
  );
}

function TemplateForm({ template, onClose, onSave }: { template: LocalTemplate; onClose: () => void; onSave: (t: LocalTemplate) => void }) {
  const [v, setV] = useState<LocalTemplate>(template);
  return (
    <Modal open onClose={onClose} title={template.name ? `수정 — ${template.name}` : '템플릿 추가'} width="max-w-xl"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>취소</button>
          <button className="btn-primary" onClick={() => { if (!v.name || !v.body) return alert('이름·본문을 입력하세요.'); onSave(v); }}>저장</button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 text-sm">
        <label className="col-span-2">이름
          <input className="input mt-1" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </label>
        <label>트리거
          <input className="input mt-1" value={v.trigger}
            onChange={(e) => setV({ ...v, trigger: e.target.value })}
            placeholder="enter_student / no_show / custom 등" />
        </label>
        <label>채널
          <select className="input mt-1" value={v.channel}
            onChange={(e) => setV({ ...v, channel: e.target.value as LocalTemplate['channel'] })}>
            <option value="sms">SMS (90byte)</option>
            <option value="lms">LMS (2000byte)</option>
          </select>
        </label>
        <label className="col-span-2">본문 ({'{name}'} {'{time}'} {'{duration}'} {'{scheduledStart}'} 치환 가능)
          <textarea className="input mt-1 font-mono" rows={5} value={v.body}
            onChange={(e) => setV({ ...v, body: e.target.value })} />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} />
          활성
        </label>
      </div>
    </Modal>
  );
}
