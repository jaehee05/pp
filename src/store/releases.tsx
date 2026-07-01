import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { firestoreStorage } from '../lib/firestoreStorage';

export interface Release {
  slug: string;        // 예: "v1_000". URL: /updates/v1_000
  title: string;       // 예: "v1.0.0 — 첫 출시"
  date: string;        // YYYY-MM-DD
  body: string;        // 마크다운 비슷한 평문 (## 제목, - 불릿, **굵게**)
  createdAt: number;
  updatedAt: number;
}

interface State {
  list: Release[];
  upsert: (r: Release) => void;
  remove: (slug: string) => void;
  get: (slug: string) => Release | null;
  replaceAll: (list: Release[]) => void;
}

const SEED: Release[] = [
  {
    slug: 'v1_024',
    title: 'v1.0.24 — 이용권 만료일 일괄 재계산 버튼',
    date: '2026-07-02',
    body: `## 새 기능
- **관리자 이용권 관리 페이지**에 [🔁 이용권 만료일 일괄 재계산] 버튼 추가.
- 클릭 → 현재 활성 이용권 전체를 훑어서 각 sub 의 \`planId\` 로 현재 이용권 설정 조회 → \`durationMonths\` / \`durationDays\` 기준으로 만료일 다시 계산 + planSnapshot 갱신.
- 이용권 수정 후 기존 회원 sub 를 새 설정에 맞춰 강제 반영할 때 사용. 처리된 sub 건수를 알림으로 표시.

## 주의
- **수동으로 만료일을 조정했던 sub 도 덮어씌워집니다.** 필요 시 개별 sub 편집으로 재조정 필요.
- 자동 하이드레이션 마이그레이션과 별개 — 명시적 액션.`,
    createdAt: Date.parse('2026-07-02'),
    updatedAt: Date.parse('2026-07-02'),
  },
  {
    slug: 'v1_023',
    title: 'v1.0.23 — 1개월권 만료일 보정 확대 + 데이터 손실 방지 안전망',
    date: '2026-07-01',
    body: `## 사고 대응 (2026-07-01)
- v1.0.22 에서 추가한 하이드레이션 후 자동 write 코드가 Firestore 읽기 실패(타임아웃) 시 초기 defaults 를 그대로 원본에 덮어써 subs/pays/pendingOrders 데이터 손실 발생.
- 백업 (다른 브라우저 localStorage) 로 원상 복구 완료.

## 재발 방지 안전망
- \`plans\` 스토어 onFinishHydration setState 는 **subs.length > 0 일 때만** 발동. 빈 상태는 write 하지 않음.
- \`firestoreStorage.setItem\` 이 defaults 처럼 보이는 payload (subs/pays/list/logs/seats 배열 전부 비어있음) 를 쓰려 할 때 Firestore 원본에 실 데이터가 있으면 **write 거부** — 로그 경고만 남기고 조용히 무시. 로컬 캐시도 안 건드림 (백업 소스 보호).

## 마이그레이션 조건 확대
- 1개월권 판단이 이름에 "개월/달" 포함으로 한정돼 있어, "분두 1과목 할인 (5%)" 같이 이름에 개월 안 들어간 30일 이용권들이 스킵되던 문제 수정.
- 이제 \`durationDays === 30\` 이면 (이름에 "N일" 명시된 경우 제외) 모두 캘린더 1개월로 간주 → 시작 월 마지막 날까지 자동 보정.`,
    createdAt: Date.parse('2026-07-01'),
    updatedAt: Date.parse('2026-07-01'),
  },
  {
    slug: 'v1_022',
    title: 'v1.0.22 — 기존 1개월권 만료일 자동 보정',
    date: '2026-07-01',
    body: `## 버그 수정 / 데이터 보정
- v1.0.21 캘린더 1개월 기준 적용 전에 만들어진 1개월권 중 만료일이 시작 월 마지막 날 **하루 전**으로 박혀있던 건 자동 보정.
  - 예: 7/1 시작, 7/30 만료 → **7/31 만료** 로 정정.
  - 31일 있는 달(1·3·5·7·8·10·12)에 7/1 같은 1일 시작 + 시작 월 안 끝 패턴만 대상.
  - 30일 또는 그 미만 달은 변화 없음 (이미 마지막 날).

## 조건 (보수적)
- status === 'active'
- startAt KST = 해당 달의 1일 00:00
- endAt KST = 같은 달의 (마지막 날 − 1) 00:00
- planSnapshot 이 1개월 패턴: \`durationMonths === 1\` 또는 (\`durationDays === 30\` && 이름에 "개월/달")

## 적용 방식
- 클라이언트 하이드레이션 시 \`plans\` 스토어 merge 단계에서 sub 보정 후 즉시 setState 로 persist 갱신 → Firestore 에도 반영.
- 멱등 — 이미 마지막 날까지인 sub 는 건들지 않음.`,
    createdAt: Date.parse('2026-07-01'),
    updatedAt: Date.parse('2026-07-01'),
  },
  {
    slug: 'v1_021',
    title: 'v1.0.21 — 1개월권 = 캘린더 기준 + 좌석 배정 가드',
    date: '2026-07-01',
    body: `## 변경 — 1개월권 만료일 계산
- **\`Plan.durationMonths\` 추가**. 1개월권은 이제 시작 월의 마지막 날까지.
  - 7/1 + 1개월 → 7/31 (기존 7/30)
  - 6/1 + 1개월 → 6/30
  - 2/1 + 1개월 → 2/28 (윤년 2/29)
  - 다음 달에 같은 day 가 없으면 (예: 1/31 + 1개월) 그 월 마지막 날로 클램프.
- 마이그레이션: 기존 \`durationDays\` ∈ {30, 60, 90, 180, 365} 이고 이름에 "개월/달" 포함된 이용권은 자동으로 \`durationMonths\` 로 변환.
- admin 이용권 편집기에 **기간 단위 (개월/일) 셀렉터** 추가.

## 변경 — 좌석 배정 흐름
- **활성 이용권 없는 회원은 좌석 배정 불가**.
  - 배치도 우클릭 → "학생 배정" 모달에서 '신규 구매' 탭 제거.
  - 활성 이용권 없으면 안내 박스 + 배정 버튼 비활성.
- **이용권 구매 직후 좌석 자동 안내**: 회원정보에서 결제 완료(현금/카드/외부) 후 학생에게 배정된 좌석이 없으면 좌석 선택 모달 자동 오픈 → 빈 좌석 클릭으로 즉시 배정.

## 내부
- \`lib/sub.computeEndAt(startAt, opts)\` 단일 진입점. \`durationMonths\` 우선.
- \`lib/useSeats.assignSeatToStudent(seatId, studentId)\` 외부 호출용 헬퍼.`,
    createdAt: Date.parse('2026-07-01'),
    updatedAt: Date.parse('2026-07-01'),
  },
  {
    slug: 'v1_020',
    title: 'v1.0.20 — KST 날짜 고정 + 페이스패스 그라운드워크',
    date: '2026-07-01',
    body: `## 버그 수정
- **이용권이 있는데 "이용 안함"으로 표시되던 문제 수정**.
  - 브라우저 timezone 이 KST 가 아닐 때 시작일이 미래로 계산돼 \`currentSubOf\` 가 "시작 예정"으로 잘못 분류.
  - \`fromLocalISODate / toLocalISODate / ddayOf / nextDayStart / expiryShort\` 모두 **KST(UTC+9) 기준** 으로 통일 — 브라우저 TZ 무관.

## 새 기능 — 페이스패스 (Toss FacePass) 출입 그라운드워크
- \`Student.faceId\` 필드 추가 (지문과 병존).
- 회원정보 페이지에 **😊 페이스패스 등록/삭제** 버튼.
- 신규 endpoint:
  - \`/api/facepass/enroll\` — Toss Front 단말의 plugin 이 얼굴 등록 완료 시 POST → faceId 채워줌.
  - \`/api/facepass/identify\` — 인증 완료 시 POST → 출입 토글 (source='face', 5초 dedupe).
- \`deviceAgent\` 에 \`enroll_face\` / \`identify_face\` 메시지 + mock 시뮬레이션.
- \`AttendanceLog.source\` 에 \`'face'\` 추가.
- 실제 통합 미완 — 토스플레이스 가맹점 등록 + Toss Front 단말 도입 + Plugin SDK 시그니처 확정 후 보강.`,
    createdAt: Date.parse('2026-07-01'),
    updatedAt: Date.parse('2026-07-01'),
  },
  {
    slug: 'v1_019',
    title: 'v1.0.19 — 토스플레이스 카드 결제 + 외부 변경 자동 반영',
    date: '2026-06-27',
    body: `## 변경 — 카드 결제 = 토스플레이스 단말기
- **카드 결제 → 토스플레이스 (Toss Place)** 로 전환. 기존 토스페이먼츠 SDK 결제창 / 로컬 bridge 단말기 경로 폐기.
- [결제하기] → **PendingOrder 등록 (메인/서브 각각 invoice)**. 단말기에서 결제 완료되면 토스플레이스 \`payment.payment.approved.v1\` 웹훅으로 자동 활성화.
- 카드는 다른 수단과 혼합 결제 불가.
- 현금 단독은 즉시 처리 흐름 (\`processCashImmediate\`) 으로 분리.

## 신규 endpoint
- \`/api/payment/tossplace-webhook\`:
  - HMAC-SHA256 시그니처 검증 (\`v1=hex\`, timestamp 5분 윈도우)
  - \`x-toss-webhook-id\` 멱등 (\`tossplaceWebhooks/{id}\`)
  - \`firebase-admin\` 으로 \`appState/pp.plans.v1\` JSON 직접 갱신 → \`invoice.orderId\` 매칭된 건 paid 처리.

## 개선 — 외부 변경 자동 반영
- 웹훅이 Firestore 만 갱신하면 클라이언트가 알지 못해 새로고침이 필요했던 문제 해결.
- \`firestoreStorage.subscribeExternalUpdates(name, rehydrate)\` 헬퍼 추가 — Firestore \`onSnapshot\` + \`metadata.hasPendingWrites\` 로 자기 write echo 와 외부 변경 분리 → 외부 변경 시 자동 \`persist.rehydrate()\`.
- plans / students / attendance 모두 적용.

## 환경
- \`TOSSPLACE_WEBHOOK_SECRET\`, \`FIREBASE_PROJECT_ID\`, \`GOOGLE_APPLICATION_CREDENTIALS_JSON\` 추가.`,
    createdAt: Date.parse('2026-06-27'),
    updatedAt: Date.parse('2026-06-27'),
  },
  {
    slug: 'v1_018',
    title: 'v1.0.18 — 정상회원 ↔ 퇴원 예정 토글',
    date: '2026-06-27',
    body: `## 새 기능
- 회원정보 페이지의 [정상회원] 버튼이 **토글 버튼**으로 — 클릭 시 confirm 후 정상회원/퇴원 예정 전환.
- 퇴원 예정 회원은 운영 배치도 좌석 카드의 이름 줄 아래에 **회색 이탤릭 "퇴원 예정"** 표시.
- 어드민 회원 폼 select 에도 "퇴원 예정" 옵션 추가.

## 내부
- \`Student.status\` union 에 \`'leaving'\` 추가 (기존 active/paused/left 유지).`,
    createdAt: Date.parse('2026-06-27'),
    updatedAt: Date.parse('2026-06-27'),
  },
  {
    slug: 'v1_017',
    title: 'v1.0.17 — 비대면/성남사랑 결제 대기 → 수동 완료',
    date: '2026-06-27',
    body: `## 변경
- **비대면 / 성남사랑** 결제 클릭 시 즉시 활성화 X → **결제 대기 (PendingOrder)** 로 보관.
- 운영자가 결제 확인 후 [✓ 결제 완료 처리] 직접 클릭해야 이용권 활성화.
- 다른 결제수단과 혼합 불가 (지역상품권 QR 정책과 동일).

## 내부
- 기존 지역상품권 QR PendingOrder 인프라 재사용.
- \`InvoicePart.method\` union 에 \`'remote' | 'localpay'\` 추가.
- \`applyPendingOrder\` 의 method 하드코딩 제거 — invoice 의 method 사용.
- 추후 외부 결제 API 연동 시 자동 처리로 전환할 자리 (현재는 수동).`,
    createdAt: Date.parse('2026-06-27'),
    updatedAt: Date.parse('2026-06-27'),
  },
  {
    slug: 'v1_016',
    title: 'v1.0.16 — 채널톡 상담 버튼 + 회원정보 연동',
    date: '2026-06-27',
    body: `## 새 기능
- **채널톡 (channel.io) 상담 버튼** 설치 — 우하단 floating 버튼.
- **회원 정보 자동 연동**: 로그인한 관리자 계정의 \`id / name / username / accountType\`을 채널톡 프로필로 boot.
  - 채널톡 대시보드에서 어느 운영자가 문의했는지 즉시 식별 가능.
- 비로그인 화면 (로그인 페이지 등) 에서도 anonymous boot 로 문의 가능.
- **키오스크 (\`/kiosk\`) 경로에서는 자동 숨김** — 학생 입퇴실 화면이라 상담 버튼 불필요.

## 내부
- \`src/components/ChannelTalk.tsx\` — SDK lazy load + auth/route 변화에 따라 boot/shutdown.
- \`App.tsx\` 에 한 줄 마운트.`,
    createdAt: Date.parse('2026-06-27'),
    updatedAt: Date.parse('2026-06-27'),
  },
  {
    slug: 'v1_015',
    title: 'v1.0.15 — 결제 옵션: 지역상품권 QR (수동 확인)',
    date: '2026-06-27',
    body: `## 변경
- 5번째 결제수단 라벨: \`토스페이먼츠\` → **\`지역상품권 QR\`**.
- 흐름 단순화 — 외부 API 호출 제거:
  - [결제하기] 클릭 → 메인/서브 가맹점별 결제 대기 항목만 등록 (PendingOrder).
  - 학생이 지역상품권 앱으로 메인 QR + 서브 QR 각각 결제.
  - 운영자가 결제 확인 후 패널에서 가맹점별 [✓ 결제 완료 처리] 클릭.
  - **양쪽 완료** 시 이용권 자동 활성화 (기존 멱등 로직 그대로).

## 참고
- 토스페이먼츠 가상계좌 발급 API (\`/api/payment/invoice\`) / confirm (\`/api/payment/charge\`) /
  webhook (\`/api/payment/webhook\`) endpoint 는 그대로 보존.
  추후 카드 단말기 또는 SDK 결제창 연동 시 재사용 가능.
- Vercel env 의 \`TOSS_*\` 키는 그대로 유지 (테스트).`,
    createdAt: Date.parse('2026-06-27'),
    updatedAt: Date.parse('2026-06-27'),
  },
  {
    slug: 'v1_014',
    title: 'v1.0.14 — 토스페이먼츠 가상계좌 정식 연동',
    date: '2026-06-27',
    body: `## 변경
- 토스페이먼츠 docs 기준으로 결제 코드 정정.
- **청구서 = 가상계좌** 방식으로 정착 (\`POST /v1/virtual-accounts\`).
  - 메인 / 서브 가맹점 각각 시크릿 키로 별도 호출 → 가상계좌 2건 발급.
  - 학생 휴대폰으로 토스 자동 입금 안내 SMS 발송.
  - 양쪽 입금 시 webhook → 이용권 자동 활성화.

## 정정
- 가맹점 2개 = **시크릿 키 2개**. 토스에 \`subMerchantKey\` 라는 개념 없음.
- 환경변수 분리: \`TOSS_SECRET_KEY_MAIN\` / \`TOSS_SECRET_KEY_SUB\` (\`TOSS_SECRET_KEY\` 단일 키 fallback).
- orderId 제약 (영문/숫자/-/_ 6~64자) 검증 + sanitize 추가.
- 메인 (독서실) 가맹점은 면세 → \`taxFreeAmount\` 자동 설정.

## 새 endpoint
- \`/api/payment/charge\` → 토스 \`POST /v1/payments/confirm\` (SDK 결제창 인증 후 승인).
- \`/api/payment/webhook\` → 토스 webhook 수신 endpoint (가상계좌 입금 / 결제 상태 변경).
  - 토스 개발자센터 > 웹훅 등록: \`https://passplace.space/api/payment/webhook\`
  - 현재는 로깅만; Firestore 실시간 갱신은 추가 작업 필요 (시뮬 버튼 유지).

## UI
- 결제 대기 패널에 **은행 / 계좌번호 / 예금주 / 입금기한** 표시.
- 계좌번호 클릭 시 클립보드 복사.`,
    createdAt: Date.parse('2026-06-27'),
    updatedAt: Date.parse('2026-06-27'),
  },
  {
    slug: 'v1_013',
    title: 'v1.0.13 — 결제 PG 전환: 결제선생 → 토스페이먼츠',
    date: '2026-06-27',
    body: `## 변경
- 결제 PG 를 **결제선생 → 토스페이먼츠** 로 전환.
- 결제수단 라벨: \`결제선생\` → **\`토스페이먼츠\`**.
- 동작 흐름은 동일 — 메인/서브 가맹점에 각각 결제 링크 발송 → 양쪽 결제 완료 시 이용권 자동 활성화.

## 환경변수
- 기존 \`PAYMENTTEACHER_*\` → \`TOSS_*\` 로 교체:
  - \`TOSS_SECRET_KEY\` (필수)
  - \`TOSS_MERCHANT_MAIN_KEY\` / \`TOSS_MERCHANT_SUB_KEY\` (멀티 가맹점 시)
  - \`TOSS_BASE_URL\` (기본 https://api.tosspayments.com)
- 키 미설정 시 mock 모드 유지.

## 내부
- \`api/payment/invoice.ts\`: 토스 \`POST /v1/payments\` 호출 (subMerchantKey 라우팅).
- \`api/payment/charge.ts\`: \`POST /v1/payments/confirm\` (단말기 호출용 placeholder).
- \`api/payment/config.ts\`: \`TOSS_SECRET_KEY\` 검사.`,
    createdAt: Date.parse('2026-06-27'),
    updatedAt: Date.parse('2026-06-27'),
  },
  {
    slug: 'v1_012',
    title: 'v1.0.12 — 결제선생 청구서 비동기 결제',
    date: '2026-06-27',
    body: `## 새 결제수단: **결제선생**
- 결제 수단에 \`결제선생\` 옵션 추가 (기존 카드/현금/비대면/성남사랑 + 1).
- 선택 후 [결제하기] → 결제선생 API 로 **메인/서브 각각 청구서 1건씩 (총 2건)** 발송.
- 청구서 발송 직후엔 이용권/결제 활성화되지 **않음**. "결제 대기" 상태로 보관.
- 회원정보 페이지에 **📧 결제 대기 패널** 노출:
  - 각 청구서별 가맹점(메인/서브) / 금액 / 결제 URL / 상태 (대기/완료/취소)
  - **양쪽 청구서 모두 결제 완료 시** 자동으로 이용권 + 결제 기록 생성, 큐잉 누적 적용.
- 시연 모드: 청구서당 \`✓ 결제 완료 처리 (시뮬)\` 버튼으로 webhook 시뮬레이션 가능.

## 내부
- \`Plan.method\` 에 \`'invoice'\` 추가.
- \`PendingOrder\` 인터페이스 + zustand 액션 \`addPendingOrder / updateInvoiceStatus / markPendingOrderApplied / cancelPendingOrder / removePendingOrder\` 추가.
- \`/api/payment/invoice\` 서버리스 함수 신설 (mock + 실 호출 분기).
- \`src/lib/invoice.ts\` 클라이언트 래퍼.`,
    createdAt: Date.parse('2026-06-27'),
    updatedAt: Date.parse('2026-06-27'),
  },
  {
    slug: 'v1_011',
    title: 'v1.0.11 — 이용권 구매 수량 옵션',
    date: '2026-06-27',
    body: `## 새 기능
- **이용권 선택에 수량 입력** (기본 1, 1~99).
- [+ 추가] 누르면 수량만큼 주문 항목이 자동 생성되고 이름에 \`(1/3)\`, \`(2/3)\` 형식 표시.
- 갱신 큐잉 로직 보정: 한 번에 여러 권 추가해도 각 권이 직전 권 만료일 다음날부터 정렬되게 누적
  (예: 6/1부터 1개월권 ×3 → 6/1~6/30, 7/1~7/30, 7/31~8/29).`,
    createdAt: Date.parse('2026-06-27'),
    updatedAt: Date.parse('2026-06-27'),
  },
  {
    slug: 'v1_010',
    title: 'v1.0.10 — 시즌/할인 기능 정리 + 좌석 외부 클릭 닫기',
    date: '2026-06-27',
    body: `## 제거
- **이용권 시즌 제한 (월별 노출)** 기능 전체 제거 — 운영 복잡도가 가치보다 큼.
  - Plan.availableMonths 필드 / 폼 / 뱃지 / 필터 모두 삭제.
- **학생 할인 등급 (1과목 / 2과목이상)** 필드 제거.
  - 기존 데이터는 학생 **메모 상단**에 \`할인 대상: 1과목\` 형태로 자동 이전 (1회 마이그레이션).
  - Plan.allowedDiscountTiers 필드 / 폼 / 필터 / 안내 배지 모두 삭제.

## 새 기능
- **좌석 배치도**: 캔버스 외부 (회색 여백) 클릭하면 선택된 좌석 패널 + 컨텍스트 메뉴가 자동 닫힘.

## 정리
- 사용설명서에서 시즌·할인 등급 관련 항목 모두 제거 / 7단계 → 6단계.`,
    createdAt: Date.parse('2026-06-27'),
    updatedAt: Date.parse('2026-06-27'),
  },
  {
    slug: 'v1_009',
    title: 'v1.0.9 — 시즌 안내 + 이용현황 음수 버그',
    date: '2026-06-27',
    body: `## 새 기능
- **이용권 선택 영역 시즌 안내**: 시작 예정월이 시즌 제한 월이면 파란 배지로 안내.
  - 예: "📅 7월은 여름방학으로, 여름방학 이용권만 이용 가능합니다."
  - 7,8월 = 여름방학 / 12,1,2월 = 겨울방학 / 그 외 = 시즌 (자동 라벨링).
- **이용권 목록 시즌 뱃지 가독성**: 7개월 이상 선택 시 "X월 제외" 형식으로 표시.
  - 예: 7월만 제외하면 \`📅 7월 제외\` (기존 \`1,2,3,4,5,6,8,9,10,11,12월\`).

## 버그 수정
- **대시보드 회원 이용현황 "이용안함 -37"** — activeSubs 중복 카운트 해결.
  - studentId 기준 dedupe + Math.max(0, ...) 가드.`,
    createdAt: Date.parse('2026-06-27'),
    updatedAt: Date.parse('2026-06-27'),
  },
  {
    slug: 'v1_008',
    title: 'v1.0.8 — 기간권 만료일/시작일 보정 + 시간대 버그 수정',
    date: '2026-06-26',
    body: `## 버그 수정
- **기간권 종료일이 1일씩 밀려있던 문제 수정** — 6/1 시작 + 30일 = **6/30 만료** (기존: 7/1).
  - 다음 이용권 큐잉 시작일도 자연스럽게 만료일 다음날로 정렬 (예: 7/1).
- **UTC ↔ KST 시간대 차이로 날짜가 하루 밀려 보이던 문제 수정** (\`toISOString\` → \`toLocalISODate\`).
  - 회원정보 시작일/종료일, 이용권 큐 테이블, 결제 화면, 이용권 편집 모달 모두 적용.

## 내부
- \`lib/format.ts\` 에 \`toLocalISODate\` / \`fromLocalISODate\` 헬퍼 추가.`,
    createdAt: Date.parse('2026-06-26'),
    updatedAt: Date.parse('2026-06-26'),
  },
  {
    slug: 'v1_007',
    title: 'v1.0.7 — 시작일 자동 세팅 + 임시 계정 안내 제거',
    date: '2026-06-26',
    body: `## 새 기능
- **이용권 시작일 자동 세팅** — 회원정보 이용권 선택 화면의 시작일 필드가 자동 계산됨.
  - 이전 이용권 있음 → 마지막 만료일 다음날
  - 없음 → 오늘
  - 사용자가 직접 수정한 경우 자동 동기화 중단. \`↺ 자동 계산\` 버튼으로 복원 가능.

## 변경
- 로그인 / 관리자 계정 페이지의 **임시 계정(admin / admin1234!) 안내 배너 제거** — 모든 운영 화면에서 비공개.`,
    createdAt: Date.parse('2026-06-26'),
    updatedAt: Date.parse('2026-06-26'),
  },
  {
    slug: 'v1_006',
    title: 'v1.0.6 — 시즌 제한 이용권 (방학권 등)',
    date: '2026-06-26',
    body: `## 새 기능
- **이용권 노출 월** 필터 — 이용권마다 1~12월 체크박스로 시즌 제한 설정.
- 프리셋: \`전체 토글\` (선택↔해제) / \`여름방학 (7,8월)\` / \`겨울방학 (12,1,2월)\` / \`학기 (방학 제외)\`
- **판정 기준 = 이용권 시작 예정월** (구매일이 아님).
  - 예: 6월에 결제하지만 기존 권이 6/30 만료라면 시작=7/1 → 방학권 노출.
  - 신규 학생 → 오늘 기준.
- 이용권 선택 영역에 📅 시작 예정월 안내 배지 추가.

## 개선
- 이용권 목록 설명 옆에 **📅 시즌 뱃지** (월 범위 표시) 추가.
- "전체" 버튼이 토글 동작 (한 번=전체선택, 한 번 더=전체해제).`,
    createdAt: Date.parse('2026-06-26'),
    updatedAt: Date.parse('2026-06-26'),
  },
  {
    slug: 'v1_005',
    title: 'v1.0.5 — 사용 설명서 + 좌석번호 표시',
    date: '2026-06-26',
    body: `## 새 기능
- **사용 설명서** 페이지 추가 (\`/admin/help\`). 8개 섹션, 좌측 sticky TOC.
- **회원 목록 좌석 컬럼**: 실제 배정된 좌석번호를 회색 뱃지로 표시 (기존 "-" → 좌석번호).
- **이용권 선택 영역 안내 배지**: 학생의 현재 할인 등급 표시 + 회원수정에서 등급 설정 안내.

## 개선
- 좌석 레이아웃 read-only 구독 hook (\`useSeats\`) 신설 — 좌석 배정/해제 실시간 반영.`,
    createdAt: Date.parse('2026-06-26'),
    updatedAt: Date.parse('2026-06-26'),
  },
  {
    slug: 'v1_004',
    title: 'v1.0.4 — 할인 등급 시스템 + 매출 현황 비활성화',
    date: '2026-06-26',
    body: `## 새 기능
- **학생 할인 등급** 필드 추가 — 없음 / 1과목 / 2과목이상.
- **이용권 노출 필터** — 이용권마다 "노출 대상 할인 등급" 체크박스. 매칭되는 학생에게만 표시.
  - 예: "분두 1과목 할인(5%)" 이용권 → 1과목 학생에게만 노출.

## 변경
- **매출 관리** 메뉴 일시 비활성화 (결제선생 실 연동 후 재오픈).
- 대시보드 매출 카드는 "준비 중" placeholder 로 대체.`,
    createdAt: Date.parse('2026-06-26'),
    updatedAt: Date.parse('2026-06-26'),
  },
  {
    slug: 'v1_003',
    title: 'v1.0.3 — 이용권 갱신 큐잉 + D-day 강화',
    date: '2026-06-25',
    body: `## 새 기능
- **이용권 갱신 큐잉**: 만료 전 미리 결제하면 기존 종료일의 다음날부터 자동 시작. 두 이용권 모두 active 보관.
- **D-day 에 예정 이용권 포함** — 가장 늦은 종료일 기준으로 잔여일 계산.
- **D-day 줄 컬러 띠**: D-3 이하 주황 강조 → D-7 주황 약 → D-14 황색 → 그 외 회색.
- **이용권 순서 드래그앤드롭** (기존 ▲▼ 버튼 제거).

## 개선
- 좌석 카드 D-day 줄을 헤더에 딱 붙여 흰 갭 제거 + 가운데 정렬.`,
    createdAt: Date.parse('2026-06-25'),
    updatedAt: Date.parse('2026-06-25'),
  },
  {
    slug: 'v1_002',
    title: 'v1.0.2 — 결제선생 연동 + 시연 모드',
    date: '2026-06-24',
    body: `## 새 기능
- **카드 결제 → 결제선생 (PaymentTeacher) API** 경유로 변경 (NICE VAN 직접 연동 제거).
- 시연용 **mock 키** 자동 감지 — 가짜 응답으로 흐름 테스트 가능.
- 페이지 상단 노랑 띠 **"결제선생 API 키 미설정 — 시연 모드"** 배너.

## 변경
- 이용권 사업자 분리 (메인/서브) — 카드 결제 시 단말기 2회 swipe 로 자동 분할.`,
    createdAt: Date.parse('2026-06-24'),
    updatedAt: Date.parse('2026-06-24'),
  },
  {
    slug: 'v1_001',
    title: 'v1.0.1 — 키오스크 + 실시간 동기화',
    date: '2026-06-22',
    body: `## 새 기능
- **키오스크 페이지** (\`/kiosk\`) — PIN 4자리 입력으로 입퇴실/외출/복귀.
- **관리자 키오스크 출입** — 관리자 계정에 PIN 부여 가능.
- **Firestore 실시간 구독** (\`onSnapshot\`) — 학생/배치도/이용권 변경이 다른 기기에 즉시 반영.
- **Bridge 앱** 골격 (\`bridge/\`) — NICE VAN + Suprema BioStar 2 로컬 연결용 Windows 앱. 휴대용 Node 자동 다운로드.

## 개선
- 좌석 카드 모바일 표시 보정 (성별 기호 잘림 / wrap 봉인).`,
    createdAt: Date.parse('2026-06-22'),
    updatedAt: Date.parse('2026-06-22'),
  },
  {
    slug: 'v1_000',
    title: 'v1.0.0 — 첫 출시',
    date: '2026-06-20',
    body: `합격공간 관리 프로그램 첫 버전 (PICKKO 레퍼런스 기반).

## 포함 기능
- **회원 관리**: 등록 / 수정 / 일괄등록 (bulk-import) / 메시지 수신 설정.
- **좌석 배치도**: 픽셀 단위 자유 배치, 기본값 저장/복원, JSON 내보내기/가져오기.
- **이용권 / 결제**: 기간권·시간권·회차권, 메인/서브 사업자 분리, 분할결제.
- **알림톡 / SMS**: 뿌리오 채널 (\`@kjhedu\`), 입퇴실 자동 발송, VM proxy 경유.
- **상/벌점 시스템**.
- **출입로그 + 학부모 알림**.

## 기술 스택
- Vite + React 19 + TypeScript + Tailwind v3 + Firebase Firestore
- Vercel Serverless Functions (\`api/payment\`, \`api/ppurio\`)
- 도메인: passplace.space`,
    createdAt: Date.parse('2026-06-20'),
    updatedAt: Date.parse('2026-06-20'),
  },
];

export const useReleases = create<State>()(
  persist(
    (set, get) => ({
      list: SEED,
      upsert(r) {
        const exists = get().list.find((x) => x.slug === r.slug);
        const next = exists
          ? get().list.map((x) => (x.slug === r.slug ? { ...r, updatedAt: Date.now() } : x))
          : [{ ...r, createdAt: Date.now(), updatedAt: Date.now() }, ...get().list];
        set({ list: next });
      },
      remove(slug) {
        set({ list: get().list.filter((x) => x.slug !== slug) });
      },
      get(slug) {
        return get().list.find((x) => x.slug === slug) ?? null;
      },
      replaceAll(list) {
        set({ list });
      },
    }),
    {
      name: 'pp.releases.v1',
      storage: createJSONStorage(() => firestoreStorage),
      // 사용자가 편집한 항목(persisted)을 우선시하면서, 그 사이 SEED 에 새로 추가된 릴리즈는 합쳐넣는다.
      // 같은 slug 면 persisted 가 이김 → 사용자 편집 보존.
      // SEED 에만 있는 새 슬러그 → 자동 추가 (배포 후 새 릴리즈 노출).
      merge: (persisted, current) => {
        const p = persisted as State | undefined;
        if (!p || !Array.isArray(p.list)) return current;
        const persistedSlugs = new Set(p.list.map((x) => x.slug));
        const fresh = SEED.filter((s) => !persistedSlugs.has(s.slug));
        const combined = [...fresh, ...p.list].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
        return { ...current, list: combined };
      },
    },
  ),
);

export function canEditReleases(username?: string | null): boolean {
  return username === 'jaehee05';
}

// 아주 가벼운 markdown-ish 렌더링 (외부 라이브러리 없이).
// 지원: ## 헤딩, - 불릿, **굵게**, 빈 줄 = 단락.
export function renderReleaseBody(body: string): React.ReactNode {
  const lines = body.split('\n');
  const out: React.ReactNode[] = [];
  let buf: React.ReactNode[] = [];
  let listBuf: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listBuf.length === 0) return;
    const items = listBuf;
    out.push(
      <ul key={`u${key++}`} className="my-2 ml-5 list-disc space-y-1">
        {items.map((it, i) => <li key={i}>{inline(it)}</li>)}
      </ul>,
    );
    listBuf = [];
  };
  const flushPara = () => {
    if (buf.length === 0) return;
    const cur = buf;
    out.push(<p key={`p${key++}`} className="my-2 leading-relaxed">{cur}</p>);
    buf = [];
  };

  for (const raw of lines) {
    const line = raw;
    if (line.startsWith('## ')) {
      flushList(); flushPara();
      out.push(<h3 key={`h${key++}`} className="mt-5 mb-1 text-base font-bold text-slate-900">{line.slice(3)}</h3>);
    } else if (line.startsWith('- ')) {
      flushPara();
      listBuf.push(line.slice(2));
    } else if (line.trim() === '') {
      flushList(); flushPara();
    } else {
      flushList();
      if (buf.length > 0) buf.push(<br key={`br${key++}`} />);
      buf.push(<span key={`s${key++}`}>{inline(line)}</span>);
    }
  }
  flushList(); flushPara();
  return <>{out}</>;
}

// **굵게** / `코드`
function inline(s: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let rest = s;
  let key = 0;
  // 매우 단순한 토큰 파서 (정규식 1패스).
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`)/;
  while (true) {
    const m = re.exec(rest);
    if (!m) {
      if (rest) parts.push(rest);
      break;
    }
    const idx = m.index;
    if (idx > 0) parts.push(rest.slice(0, idx));
    if (m[2]) parts.push(<b key={key++} className="font-semibold text-slate-900">{m[2]}</b>);
    else if (m[3]) parts.push(<code key={key++} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[12px] text-rose-700">{m[3]}</code>);
    rest = rest.slice(idx + m[0].length);
  }
  return <>{parts}</>;
}
