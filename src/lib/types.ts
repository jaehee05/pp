import type { Timestamp } from 'firebase/firestore';

export type ID = string;
export type TS = Timestamp;

export type WeekdayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export const WEEKDAYS: WeekdayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const WEEKDAY_LABEL: Record<WeekdayKey, string> = {
  mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일',
};

// ---------- 학생 ----------
export interface Student {
  id: ID;
  name: string;
  gender?: 'M' | 'F';       // 성별
  phone: string;            // 학생 연락처
  parentPhone?: string;     // 학부모 연락처
  school?: string;
  grade?: string;
  memo?: string;

  // 알림 설정 (개별 on/off)
  notify: {
    studentEnterExit: boolean;   // 학생 본인에게 입퇴실 알림
    parentEnterExit: boolean;    // 학부모에게 입퇴실 알림
    parentLateMiss: boolean;     // 학부모에게 미입실 알림
  };

  // 입실 예정 시간 (요일별, "HH:mm" 또는 null)
  schedule: Partial<Record<WeekdayKey, { start: string; end: string } | null>>;

  // 지문 ID (디바이스 에이전트에서 발급)
  fingerprintId?: string;

  // 좌석/이용권은 다른 컬렉션에서 조회
  status: 'active' | 'paused' | 'left';
  joinedAt: TS;
  pointsTotal: number; // 누적 상-벌점 합
}

// ---------- 좌석 ----------
// 모든 좌표/크기는 px 단위.
export interface Seat {
  id: ID;        // 좌석 내부 id
  label: string; // 표시명 (좌석 번호, 예: "11")
  tag?: string;  // 분류 라벨 — "고정석" / "관리자석" / "지정석" 등
  x: number;     // px
  y: number;     // px
  w: number;     // px
  h: number;     // px
  z?: number;    // z-index
  type: 'seat' | 'room' | 'wall' | 'door' | 'desk' | 'label'; // 도형 종류
  rotation?: 0 | 90 | 180 | 270;
  assignedStudentId?: ID | null; // 현재 배정된 학생 (장기 배정)
  active?: boolean;              // false = 비활성(고장/공사 등). 기본 true
  memo?: string;                 // 좌석 메모
  assignmentHistory?: { studentId: ID; assignedAt: number; releasedAt?: number }[];
}

export interface SeatLayout {
  id: ID;
  name: string;        // 예: "1관 1층"
  width: number;       // canvas px
  height: number;      // canvas px
  snap: number;        // 스냅 단위 (px). 보통 5 or 10.
  seats: Seat[];
  updatedAt: TS;
}

// ---------- 이용권/결제 ----------
export interface Plan {
  id: ID;
  name: string;                 // 예: "정기권 1개월", "4시간권"
  category: 'seat' | 'room';    // 좌석권 / 룸·사물함권
  seatType?: 'fixed' | 'free';  // 좌석권일 때만: 고정석/자유석
  type: 'period' | 'hours' | 'count'; // 기간제 / 시간제 / 회차제
  durationDays?: number;
  hours?: number;
  counts?: number;

  // 금액 (과세/비과세 분리. price = taxFree + taxable)
  taxFreeAmount: number;        // 면세금액
  taxableAmount: number;        // 과세금액
  price: number;                // 합계금액 (저장 시 자동 계산)

  kind?: string;                // 회원 구분 (일반/학생/성인 등)
  discountPolicy?: string;      // 할인정책 라벨 (예: "분두 1과목 할인(5%)")
  includesLocker?: boolean;     // 사물함 포함 여부

  active: boolean;
  hidden?: boolean;             // 숨김(노출 안 함)
  description?: string;
}

export interface Subscription {
  id: ID;
  studentId: ID;
  planId: ID;
  planSnapshot: Pick<Plan, 'name' | 'type' | 'durationDays' | 'hours' | 'counts' | 'price'>;
  startAt: TS;
  endAt?: TS;          // period 형
  hoursRemaining?: number;
  countsRemaining?: number;
  paymentId?: ID;
  status: 'active' | 'expired' | 'refunded';
}

export interface Payment {
  id: ID;
  studentId: ID;
  planId: ID;
  amount: number;
  method: 'card' | 'cash' | 'transfer';
  cardApprovalNo?: string;
  cardIssuer?: string;
  installment?: number;
  terminalTxId?: string;   // 단말기 거래 ID
  status: 'pending' | 'approved' | 'failed' | 'cancelled';
  errorMessage?: string;
  createdAt: TS;
  approvedAt?: TS;
}

// ---------- 출입로그 ----------
export interface AttendanceLog {
  id: ID;
  studentId: ID;
  type: 'enter' | 'exit' | 'leave_temp' | 'return';
  source: 'fingerprint' | 'manual' | 'qr';
  at: TS;
  seatId?: ID;
  byUserId?: ID;       // 수동 처리한 운영자
  note?: string;
}

export interface AttendanceState {
  studentId: ID;
  state: 'in' | 'out' | 'temp_out';
  seatId?: ID;
  lastEnterAt?: TS;
  lastEventAt: TS;
}

// ---------- 상/벌점 ----------
export interface PointEntry {
  id: ID;
  studentId: ID;
  delta: number;       // +상점 / -벌점
  reason: string;
  category?: string;
  byUserId: ID;
  createdAt: TS;
}

// ---------- 일정표 ----------
export interface StudyPlanItem {
  id: ID;
  studentId: ID;
  weekStart: string;   // "YYYY-MM-DD" (해당 주 월요일)
  weekday: WeekdayKey;
  startTime: string;   // "HH:mm"
  endTime: string;
  subject: string;
  detail?: string;
  done?: boolean;
}

// ---------- 알림 발송 큐 ----------
export interface NotificationJob {
  id: ID;
  studentId: ID;
  channel: 'sms' | 'lms';
  template: 'enter' | 'exit' | 'no_show' | 'custom';
  toPhone: string;
  payload: Record<string, string | number>;
  status: 'queued' | 'sent' | 'failed';
  error?: string;
  createdAt: TS;
  sentAt?: TS;
}
