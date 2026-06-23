import type { LocalStudent } from '../store/students';
import { messaging } from './messaging';

// 입퇴실/미입실 등 운영 이벤트를 학생/학부모에게 발송.
// 실제 발송은 messaging.send → /api/notify/send 경유.

export const notify = {
  enter(s: LocalStudent) {
    if (s.notify.studentEnterExit && s.msgReceive !== false && s.phone) {
      void messaging.send({
        to: s.phone, channel: 'sms', template: 'enter_student',
        message: `[합격공간] ${s.name}님 입실했습니다.`,
      });
    }
    if (s.notify.parentEnterExit && s.parentMsgReceive !== false && s.parentPhone) {
      void messaging.send({
        to: s.parentPhone, channel: 'sms', template: 'enter_parent',
        message: `[합격공간] ${s.name} 학생이 입실했습니다.`,
      });
    }
  },
  exit(s: LocalStudent) {
    if (s.notify.studentEnterExit && s.msgReceive !== false && s.phone) {
      void messaging.send({
        to: s.phone, channel: 'sms', template: 'exit_student',
        message: `[합격공간] ${s.name}님 퇴실했습니다.`,
      });
    }
    if (s.notify.parentEnterExit && s.parentMsgReceive !== false && s.parentPhone) {
      void messaging.send({
        to: s.parentPhone, channel: 'sms', template: 'exit_parent',
        message: `[합격공간] ${s.name} 학생이 퇴실했습니다.`,
      });
    }
  },
  noShow(s: LocalStudent, scheduledStart: string) {
    if (s.notify.parentLateMiss && s.parentMsgReceive !== false && s.parentPhone) {
      void messaging.send({
        to: s.parentPhone, channel: 'sms', template: 'no_show',
        message: `[합격공간] ${s.name} 학생이 ${scheduledStart} 입실 예정이었으나 아직 미입실입니다.`,
      });
    }
  },
  // 기존 코드 호환용 — 메시지 페이지에서 사용
  recent: messaging.recent,
};
