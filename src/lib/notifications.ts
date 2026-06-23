import type { LocalStudent } from '../store/students';
import { messaging } from './messaging';
import { usePpurio } from '../store/ppurioSettings';

// 입퇴실/미입실 등 운영 이벤트를 학생/학부모에게 발송.
// usePpurio 설정의 channel('sms' | 'kakao') 에 따라 분기.
// kakao 인 경우 templateCode + changeWord 로 PPURIO 알림톡 발송.
// changeWord 키:
//   '이름' → 학생 이름 (PPURIO 알림톡 기본 변수와 동일)
//   '1'    → 시간 (입실/퇴실/예정시각)
//   '2'    → 공통 공지

function nowHHmm() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function dispatch(opts: {
  to?: string;
  name: string;             // 수신자 이름 (알림톡 [*이름*])
  smsBody: string;          // SMS fallback 본문
  trigger: string;          // template name (로그/이력용)
  templateCode: string;     // 알림톡 템플릿 코드
  changeWord: Record<string, string>;
}) {
  if (!opts.to) return;
  const cfg = usePpurio.getState();
  if (cfg.enabled === false) return;
  const useKakao = cfg.channel === 'kakao' && !!opts.templateCode;
  void messaging.send({
    to: opts.to,
    name: opts.name,
    channel: useKakao ? 'kakao' : 'sms',
    template: opts.trigger,
    message: opts.smsBody,
    ...(useKakao ? {
      templateCode: opts.templateCode,
      changeWord: opts.changeWord,
    } : {}),
  });
}

export const notify = {
  enter(s: LocalStudent) {
    const cfg = usePpurio.getState();
    const time = nowHHmm();
    const notice = cfg.notice ?? '';
    const smsBody = `[합격공간] ${s.name} 학생이 ${time}에 입실하였습니다.${notice ? '\n\n' + notice : ''}`;
    if (s.notify.studentEnterExit && s.msgReceive !== false && s.phone) {
      dispatch({
        to: s.phone, name: s.name, trigger: 'enter_student',
        templateCode: cfg.templateEnter, smsBody,
        changeWord: { '#{var1}': time, '#{var2}': notice },
      });
    }
    if (s.notify.parentEnterExit && s.parentMsgReceive !== false && s.parentPhone) {
      dispatch({
        to: s.parentPhone, name: s.name, trigger: 'enter_parent',
        templateCode: cfg.templateEnter, smsBody,
        changeWord: { '#{var1}': time, '#{var2}': notice },
      });
    }
  },
  exit(s: LocalStudent) {
    const cfg = usePpurio.getState();
    const time = nowHHmm();
    const notice = cfg.notice ?? '';
    const smsBody = `[합격공간] ${s.name} 학생이 ${time}에 퇴실하였습니다.${notice ? '\n\n' + notice : ''}`;
    if (s.notify.studentEnterExit && s.msgReceive !== false && s.phone) {
      dispatch({
        to: s.phone, name: s.name, trigger: 'exit_student',
        templateCode: cfg.templateExit, smsBody,
        changeWord: { '#{var1}': time, '#{var2}': notice },
      });
    }
    if (s.notify.parentEnterExit && s.parentMsgReceive !== false && s.parentPhone) {
      dispatch({
        to: s.parentPhone, name: s.name, trigger: 'exit_parent',
        templateCode: cfg.templateExit, smsBody,
        changeWord: { '#{var1}': time, '#{var2}': notice },
      });
    }
  },
  noShow(s: LocalStudent, scheduledStart: string) {
    const cfg = usePpurio.getState();
    const notice = cfg.notice ?? '';
    const smsBody = `[합격공간] ${s.name} 학생이 ${scheduledStart} 입실 예정이었으나 아직 미입실입니다.${notice ? '\n\n' + notice : ''}`;
    if (s.notify.parentLateMiss && s.parentMsgReceive !== false && s.parentPhone) {
      dispatch({
        to: s.parentPhone, name: s.name, trigger: 'no_show',
        templateCode: cfg.templateNoShow, smsBody,
        changeWord: { '#{var1}': scheduledStart, '#{var2}': notice },
      });
    }
  },
  // 호환용
  recent: messaging.recent,
};
