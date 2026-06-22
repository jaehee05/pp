import type { LocalStudent } from '../store/students';

// 알림 발송 어댑터 — 실제로는 Firebase Function이 솔라피/카카오 알림톡 API 호출.
// 프론트는 큐에 enqueue만 하고, 함수에서 처리하는 패턴. 지금은 콘솔 로깅 + 발송 로그 저장.

interface Job {
  id: string;
  to: string;
  channel: 'kakao' | 'sms';
  template: string;
  message: string;
  ts: number;
}

const KEY = 'pp.notify.log.v1';

function push(job: Job) {
  const raw = localStorage.getItem(KEY);
  const list: Job[] = raw ? JSON.parse(raw) : [];
  list.unshift(job);
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 200)));
  // 콘솔로도 출력 (개발 가시성)
  // eslint-disable-next-line no-console
  console.log('[notify]', job);
}

function send(to: string, message: string, template: string) {
  if (!to) return;
  push({
    id: `n_${Date.now().toString(36)}`,
    to,
    channel: 'kakao',
    template,
    message,
    ts: Date.now(),
  });
}

export const notify = {
  enter(s: LocalStudent) {
    if (s.notify.studentEnterExit && s.phone) {
      send(s.phone, `[PP독서실] ${s.name}님 입실했습니다.`, 'enter_student');
    }
    if (s.notify.parentEnterExit && s.parentPhone) {
      send(s.parentPhone, `[PP독서실] ${s.name} 학생이 입실했습니다.`, 'enter_parent');
    }
  },
  exit(s: LocalStudent) {
    if (s.notify.studentEnterExit && s.phone) {
      send(s.phone, `[PP독서실] ${s.name}님 퇴실했습니다.`, 'exit_student');
    }
    if (s.notify.parentEnterExit && s.parentPhone) {
      send(s.parentPhone, `[PP독서실] ${s.name} 학생이 퇴실했습니다.`, 'exit_parent');
    }
  },
  noShow(s: LocalStudent, scheduledStart: string) {
    if (s.notify.parentLateMiss && s.parentPhone) {
      send(s.parentPhone, `[PP독서실] ${s.name} 학생이 ${scheduledStart} 입실 예정이었으나 아직 미입실입니다.`, 'no_show');
    }
  },
  recent(limit = 50): Job[] {
    const raw = localStorage.getItem(KEY);
    const list: Job[] = raw ? JSON.parse(raw) : [];
    return list.slice(0, limit);
  },
};
