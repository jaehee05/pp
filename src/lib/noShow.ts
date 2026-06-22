import type { LocalStudent } from '../store/students';
import { WEEKDAYS, type WeekdayKey } from './types';

const GRACE_MINUTES = 15;

function todayWeekday(): WeekdayKey {
  const d = new Date().getDay(); // 0=Sun..6=Sat
  // map: Sun->sun, Mon->mon ...
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

export function isNoShow(
  student: LocalStudent,
  att: { state: 'in' | 'out' | 'temp_out' } | undefined,
): boolean {
  if (att?.state === 'in' || att?.state === 'temp_out') return false;
  const slot = student.schedule[todayWeekday()];
  if (!slot || !slot.start) return false;
  const expected = parseHm(slot.start);
  return nowMinutes() >= expected + GRACE_MINUTES;
}

export function noShowList(students: LocalStudent[], state: Record<string, { state: 'in' | 'out' | 'temp_out' }>) {
  return students.filter((s) => isNoShow(s, state[s.id]));
}

export { WEEKDAYS, GRACE_MINUTES };
