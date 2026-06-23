import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { firestoreStorage } from '../lib/firestoreStorage';

export interface LocalTemplate {
  id: string;
  name: string;        // 사용자에게 보이는 이름
  trigger: string;     // enter / exit / no_show / custom 등
  channel: 'sms' | 'lms';
  body: string;        // 본문 (변수 {name}, {time} 등 치환)
  active: boolean;
}

interface State {
  list: LocalTemplate[];
  upsert: (t: LocalTemplate) => void;
  remove: (id: string) => void;
}

const DEFAULTS: LocalTemplate[] = [
  { id: 't_enter_student', name: '입실 (학생)', trigger: 'enter_student', channel: 'sms',
    body: '[합격공간] {name}님 {time} 입실했습니다.', active: true },
  { id: 't_enter_parent', name: '입실 (학부모)', trigger: 'enter_parent', channel: 'sms',
    body: '[합격공간] {name} 학생이 {time} 입실했습니다.', active: true },
  { id: 't_exit_student', name: '퇴실 (학생)', trigger: 'exit_student', channel: 'sms',
    body: '[합격공간] {name}님 {time} 퇴실했습니다. 오늘 이용 {duration}.', active: true },
  { id: 't_exit_parent', name: '퇴실 (학부모)', trigger: 'exit_parent', channel: 'sms',
    body: '[합격공간] {name} 학생이 {time} 퇴실했습니다. 오늘 이용 {duration}.', active: true },
  { id: 't_no_show', name: '미입실 (학부모)', trigger: 'no_show', channel: 'sms',
    body: '[합격공간] {name} 학생이 {scheduledStart} 입실 예정이었으나 아직 미입실입니다.', active: true },
];

export const useTemplates = create<State>()(
  persist(
    (set) => ({
      list: DEFAULTS,
      upsert: (t) => set((st) => {
        const exists = st.list.some((x) => x.id === t.id);
        return { list: exists ? st.list.map((x) => (x.id === t.id ? t : x)) : [t, ...st.list] };
      }),
      remove: (id) => set((st) => ({ list: st.list.filter((x) => x.id !== id) })),
    }),
    { name: 'pp.msgTemplates.v1', storage: createJSONStorage(() => firestoreStorage) },
  ),
);
