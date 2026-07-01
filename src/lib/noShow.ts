import type { LocalStudent } from '../store/students';
import { WEEKDAYS, type WeekdayKey, type DayPlan } from './types';

const GRACE_MINUTES = 15;

function todayWeekday(): WeekdayKey {
  const d = new Date().getDay(); // 0=Sun..6=Sat
  const map: WeekdayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return map[d];
}

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function parseHm(s: string) {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + (m || 0);
}

// 학원&과외 일정표(weeklyPlan) 의 오늘 입실/재입실 시각들 (4개).
const ENTER_SLOTS: { key: NoShowSlotKey; field: keyof DayPlan; label: string }[] = [
  { key: 'initialEnter', field: 'initialEnter', label: '아침 입실' },
  { key: 'morningReenter', field: 'morningReenter', label: '오전 후 재입실' },
  { key: 'afternoonReenter', field: 'afternoonReenter', label: '오후 후 재입실' },
  { key: 'eveningReenter', field: 'eveningReenter', label: '저녁 후 재입실' },
];

export type NoShowSlotKey = 'initialEnter' | 'morningReenter' | 'afternoonReenter' | 'eveningReenter';

export interface NoShowSlot { key: NoShowSlotKey; time: string; label: string }

// weeklyPlan 기반: 오늘 지금 시점에서 grace 지난 입실/재입실 슬롯 중 아직 미입실인 것들 반환.
// weeklyPlan 없으면 legacy student.schedule 로 fallback (단일 슬롯).
export function pendingNoShowSlots(
  student: LocalStudent,
  att: { state: 'in' | 'out' | 'temp_out' } | undefined,
): NoShowSlot[] {
  if (att?.state === 'in' || att?.state === 'temp_out') return [];
  const day = student.weeklyPlan?.[todayWeekday()];
  const now = nowMinutes();
  const result: NoShowSlot[] = [];
  if (day) {
    for (const s of ENTER_SLOTS) {
      const t = day[s.field];
      if (!t) continue;
      if (now >= parseHm(t) + GRACE_MINUTES) {
        result.push({ key: s.key, time: t, label: s.label });
      }
    }
    if (result.length > 0) return result;
  }
  // Legacy fallback
  const slot = student.schedule[todayWeekday()];
  if (slot?.start && now >= parseHm(slot.start) + GRACE_MINUTES) {
    result.push({ key: 'initialEnter', time: slot.start, label: '입실 (schedule)' });
  }
  return result;
}

export function isNoShow(
  student: LocalStudent,
  att: { state: 'in' | 'out' | 'temp_out' } | undefined,
): boolean {
  return pendingNoShowSlots(student, att).length > 0;
}

export function noShowList(students: LocalStudent[], state: Record<string, { state: 'in' | 'out' | 'temp_out' }>) {
  return students.filter((s) => isNoShow(s, state[s.id]));
}

export { WEEKDAYS, GRACE_MINUTES };
