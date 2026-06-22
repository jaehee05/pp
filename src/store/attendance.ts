import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AttendanceLog, AttendanceState } from '../lib/types';
import { notify } from '../lib/notifications';
import { useStudents } from './students';

type LocalLog = Omit<AttendanceLog, 'at'> & { at: number };
type LocalState = Omit<AttendanceState, 'lastEnterAt' | 'lastEventAt'> & {
  lastEnterAt?: number;
  lastEventAt: number;
};

interface State {
  state: Record<string, LocalState>;   // studentId -> state
  logs: LocalLog[];
  enter: (studentId: string, source: AttendanceLog['source'], seatId?: string) => void;
  exit: (studentId: string, source: AttendanceLog['source']) => void;
  leaveTemp: (studentId: string, source: AttendanceLog['source']) => void;
  returnFromTemp: (studentId: string, source: AttendanceLog['source']) => void;
}

function append(set: (fn: (s: State) => Partial<State>) => void, log: LocalLog, st: LocalState) {
  set((s) => ({
    logs: [log, ...s.logs].slice(0, 500),
    state: { ...s.state, [log.studentId]: st },
  }));
}

function mkLog(type: AttendanceLog['type'], studentId: string, source: AttendanceLog['source'], seatId?: string): LocalLog {
  return {
    id: `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    studentId,
    type,
    source,
    at: Date.now(),
    seatId,
  };
}

export const useAttendance = create<State>()(
  persist(
    (set, get) => ({
      state: {},
      logs: [],
      enter: (studentId, source, seatId) => {
        const log = mkLog('enter', studentId, source, seatId);
        const st: LocalState = { studentId, state: 'in', seatId, lastEnterAt: log.at, lastEventAt: log.at };
        append(set, log, st);
        const student = useStudents.getState().get(studentId);
        if (student) notify.enter(student);
      },
      exit: (studentId, source) => {
        const log = mkLog('exit', studentId, source);
        const prev = get().state[studentId];
        const st: LocalState = { studentId, state: 'out', lastEnterAt: prev?.lastEnterAt, lastEventAt: log.at };
        append(set, log, st);
        const student = useStudents.getState().get(studentId);
        if (student) notify.exit(student);
      },
      leaveTemp: (studentId, source) => {
        const log = mkLog('leave_temp', studentId, source);
        const prev = get().state[studentId];
        const st: LocalState = { studentId, state: 'temp_out', lastEnterAt: prev?.lastEnterAt, lastEventAt: log.at };
        append(set, log, st);
      },
      returnFromTemp: (studentId, source) => {
        const log = mkLog('return', studentId, source);
        const prev = get().state[studentId];
        const st: LocalState = { studentId, state: 'in', lastEnterAt: prev?.lastEnterAt, lastEventAt: log.at };
        append(set, log, st);
      },
    }),
    { name: 'pp.attendance.v1' },
  ),
);
