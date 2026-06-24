import { useEffect } from 'react';
import { liveAppState } from './firestoreSync';
import { useAttendance } from '../store/attendance';
import { useStudents } from '../store/students';
import { usePlans } from '../store/plans';
import { usePpurio } from '../store/ppurioSettings';

// zustand persist 가 저장하는 형태는 { state: {...}, version: N }.
// 원격 변경을 받아 state 만 추출해서 store 에 적용.
function applyRemote<T>(setState: (s: Partial<T>) => void) {
  return (json: string) => {
    try {
      const parsed = JSON.parse(json) as { state?: T };
      if (parsed?.state) setState(parsed.state);
    } catch { /* */ }
  };
}

// App.tsx 등에서 한 번만 호출. 로그인 후 마운트.
export function useRealtimeStores() {
  useEffect(() => {
    const unsubs = [
      liveAppState('pp.attendance.v1', applyRemote(useAttendance.setState)),
      liveAppState('pp.students.v1', applyRemote(useStudents.setState)),
      liveAppState('pp.plans.v1', applyRemote(usePlans.setState)),
      liveAppState('pp.ppurioSettings.v1', applyRemote(usePpurio.setState)),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);
}
