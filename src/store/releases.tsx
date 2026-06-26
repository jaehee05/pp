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
      // SEED 는 첫 로드 한 번만 — 사용자가 수정한 뒤 SEED 가 자동 덮어쓰지 않게 빈 list 도 보존.
      merge: (persisted, current) => {
        const p = persisted as State | undefined;
        if (!p || !Array.isArray(p.list)) return current;
        return { ...current, list: p.list };
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
