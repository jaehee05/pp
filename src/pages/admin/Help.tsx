import { useState } from 'react';
import { PageHeader } from '../../components/PageHeader';

interface Section { id: string; title: string; body: React.ReactNode }

const SECTIONS: Section[] = [
  {
    id: 'quickstart',
    title: '⚡ 빠른 시작',
    body: (
      <>
        <Step n={1} t="로그인">
          <p>https://passplace.space 접속 후 관리자 계정으로 로그인. 초기 임시 계정 <code>admin / admin1234!</code>
          으로 들어와서 [관리 → 매장 관리 → 관리자 계정]에서 실제 계정 만들면 임시 계정 자동 삭제됨.</p>
        </Step>
        <Step n={2} t="이용권 등록">
          [관리 → 좌석 이용권 관리] → "+ 이용권 추가" → 이름·기간·메인/서브 금액·할인 등급 노출 설정.
        </Step>
        <Step n={3} t="좌석 배치">
          [관리 → 배치도 관리 → 좌석 배치] → 팔레트에서 좌석 도형 클릭해 배치도 위에 드래그 배치. 한 번 만든 뒤
          [★ 기본값으로 저장] 눌러두면 초기화해도 복원됨.
        </Step>
        <Step n={4} t="회원 등록">
          [운영 → 회원등록] → 성함·성별·연락처·PIN(4자리)·생년월일·할인 등급·보호자 정보 입력 → 등록.
        </Step>
        <Step n={5} t="좌석 배정 + 결제">
          [운영 → 배치도]에서 좌석 클릭 → "회원 배정" → 학생 선택 → "신규 구매" 모드에서 이용권 선택 → 시작일 → 배정.
          이미 이용권 보유 학생이면 "기존 사용" 모드 자동 선택.
        </Step>
        <Step n={6} t="결제">
          [운영 → 회원정보] → 이용권 선택 → 주문 정보에 추가 → 결제수단 선택 → 결제하기.
          카드 결제는 메인/서브 사업자별 자동 분할 (단말기 2회 swipe).
        </Step>
        <Step n={7} t="입퇴실">
          학생이 키오스크(<code>/kiosk</code>)에서 PIN 4자리 입력 → 자동 입실. 입실 중이면 외출/퇴실 선택.
          입퇴실 시 학부모에게 자동 알림톡 (설정된 경우).
        </Step>
      </>
    ),
  },
  {
    id: 'members',
    title: '👤 회원 관리',
    body: (
      <>
        <H>회원 등록</H>
        <p>[운영 → 회원등록]에서 신규 등록. PIN 4자리는 키오스크 식별용. 생년월일/회원구분/할인등급/보호자 연락처
        포함.</p>
        <H>회원 정보 수정</H>
        <p>[운영 → 회원정보] 또는 [관리 → 회원 관리 → 상세] → 우측 상단 [회원수정] 버튼 → 필드 활성화되고
        [✓ 수정 완료] 눌러야 저장. 안 누르면 변경 안 됨.</p>
        <H>할인 대상 등급</H>
        <p>학생당 <b>없음 / 1과목 / 2과목이상</b> 중 선택. 이용권의 "노출 대상 할인 등급"과 매칭되는 이용권만
        결제 화면에 노출됨.</p>
        <H>일괄 작업</H>
        <p>[관리 → bulk-import (URL 직접 입력)]에서 메시지 수신 일괄 ON/OFF, 60명 회원 일괄 등록 등.</p>
        <H>회원 삭제</H>
        <p>회원 목록 우측 [삭제] 버튼. 해당 회원의 좌석 배정도 함께 해제됨. 이용권/결제 이력은 별도 정리 필요.</p>
      </>
    ),
  },
  {
    id: 'seats',
    title: '🪑 좌석 / 배치도',
    body: (
      <>
        <H>편집 (관리탭)</H>
        <p>[관리 → 배치도 관리 → 좌석 배치]에서 픽셀 단위 자유 배치. 좌측 팔레트에서 도형(좌석/책상/구역/벽/문) 선택
        후 배치도 클릭. 우측 인스펙터에서 좌석번호·분류·X/Y/너비/높이 편집. 드래그로 이동, 우하단 핸들로 리사이즈.</p>
        <H>기본값 저장 / 복원</H>
        <p>[★ 기본값으로 저장] 한 번 누르면 그 상태가 기준점. 실수로 망가뜨려도 [↺ 기본값으로 복원]으로 되돌림.
        [⬇ 내보내기]로 JSON 백업, [⬆ 가져오기]로 다른 환경에서 가져오기.</p>
        <H>좌석 카드 색</H>
        <ul className="ml-5 list-disc">
          <li>헤더: 입실=연두 / 외출=노랑 / 퇴실/미입실=회색</li>
          <li>D-day 줄: D-3 이하=주황(강조), D-7 이하=주황(약), D-14 이하=황색, 그 외=회색</li>
        </ul>
        <H>운영 (운영탭)</H>
        <p>[운영 → 배치도]에서 좌석 클릭하면 컨텍스트 메뉴: 회원 정보 / 회원 배정 / 배석 해제 / 메모 / 타입 변경 /
        히스토리. 입퇴실 변경은 키오스크에서 자동, 또는 회원정보 페이지에서 수동.</p>
      </>
    ),
  },
  {
    id: 'plans',
    title: '🎫 이용권',
    body: (
      <>
        <H>이용권 추가</H>
        <p>[관리 → 좌석 이용권 관리]에서 "+ 이용권 추가". 기간권(일수)/시간권(시간)/회차권(횟수) 중 선택.
        메인/서브 사업자 금액 분리 입력 (예: 메인 169,670 + 서브 320,330 = 490,000).</p>
        <H>순서 변경</H>
        <p>행을 드래그해서 위/아래로 이동. 같은 카테고리(좌석권끼리)만 가능.</p>
        <H>숨김 / 노출</H>
        <p>"숨김" 버튼으로 이용권 비활성화 (목록에서 숨김 처리, 데이터는 보존). "보임"으로 토글하면 다시 활성.
        결제 화면에서는 [숨긴 이용권 보기] 체크박스로 숨긴 것도 표시 가능.</p>
        <H>할인 대상 필터</H>
        <p>이용권 폼의 "노출 대상 할인 등급" 체크박스 — 체크 안 하면 전체 노출, 체크하면 해당 등급 학생에게만
        결제 화면에 표시. (예: 1과목 학생 전용 할인권)</p>
        <H>시즌 제한 (월별 노출)</H>
        <p>이용권 폼의 "노출 월" 카드 — 1~12월 체크박스로 어느 달에 판매할지 지정. 프리셋 버튼: <b>전체</b> /
        <b>여름방학 (7,8월)</b> / <b>겨울방학 (12,1,2월)</b> / <b>학기 (방학 제외)</b>. 예시:
        "방학 이용권"은 7,8월만 체크 → 7월 진입 시 회원정보 결제 화면에 자동 노출, 9월부터 자동 숨김.
        일반 정기권은 "학기" 프리셋으로 → 방학기간엔 자동 숨김.</p>
        <H>갱신 결제 (큐잉)</H>
        <p>이용권 만료 전 미리 새 이용권 결제하면 기존 종료일 다음날부터 자동 시작. 두 이용권 모두 active 로
        보관되고 D-day 는 가장 늦은 종료일 기준.</p>
      </>
    ),
  },
  {
    id: 'payment',
    title: '💳 결제',
    body: (
      <>
        <H>주문 → 결제 흐름</H>
        <p>회원정보 → 이용권 선택 [+ 추가] → 주문 정보 테이블에 누적 → 합계금액 자동 계산 → 결제수단 선택 → 결제하기.</p>
        <H>결제수단</H>
        <ul className="ml-5 list-disc">
          <li><b>카드</b>: 결제선생 API 호출 (현재 시연 모드 — 가짜 응답)</li>
          <li><b>현금</b>: 단말기 없이 그냥 기록</li>
          <li><b>비대면 / 성남사랑</b>: 외부 결제 — 단말기 거치지 않고 기록만</li>
        </ul>
        <H>분할 결제</H>
        <p>[+ 분할결제] 버튼으로 결제수단 행 추가. 합계와 결제금액 합이 일치해야 [결제하기] 활성.</p>
        <H>메인/서브 자동 분할</H>
        <p>이용권에 메인/서브 금액 분리해 두면 카드 결제 시 자동으로 메인(독서실 가맹점) + 서브(교습소 가맹점)
        2회 호출 → 단말기 2번 swipe.</p>
        <H>기타결제 / 할인</H>
        <p>주문 정보 우측의 [💰 기타결제] / [% 할인] 으로 임시 항목 추가. 할인은 음수로 기록됨.</p>
      </>
    ),
  },
  {
    id: 'kiosk',
    title: '🖥️ 키오스크 (입퇴실)',
    body: (
      <>
        <H>접근</H>
        <p>주소: <code>https://passplace.space/kiosk</code>. 키오스크 PC/태블릿 브라우저에 띄워두기.
        전체화면 모드(F11) 권장.</p>
        <H>학생 사용법</H>
        <p>키패드로 본인 PIN 4자리 입력 → 4번째 누르면 자동 식별 → 자동 입실. 입실 중에 다시 PIN 입력하면
        "외출 / 퇴실" 선택 화면. 외출 중에 PIN 입력 → 자동 복귀.</p>
        <H>관리자 출입</H>
        <p>[관리 → 매장 관리 → 관리자 계정]에서 관리자별 [PIN 설정] → 키오스크에서 그 PIN 입력 → 활성 이용권
        체크 없이 통과. "관리자" 라벨로 표시되고 출입 기록은 학생과 분리 (admin_ prefix).</p>
        <H>지문 인식 (Bridge 연결 시)</H>
        <p>BioStar 2 + BioLite N2 연결 후 손가락 인식 → 같은 식별 흐름. Bridge 앱이 PC에서 실행되어야 함.</p>
        <H>안내 메시지</H>
        <ul className="ml-5 list-disc">
          <li>활성 이용권 없는 학생 → "활성 이용권이 없습니다. 카운터에 문의하세요."</li>
          <li>PIN 불일치 → "일치하는 회원/관리자가 없습니다."</li>
          <li>30초 무입력 → 자동 초기화</li>
        </ul>
      </>
    ),
  },
  {
    id: 'messages',
    title: '💬 알림톡 / SMS',
    body: (
      <>
        <H>설정</H>
        <p>[관리 → 메시지 발송 관리 → 뿌리오 설정]에서 채널(SMS / 카카오 알림톡) 선택, 알림톡 템플릿 코드,
        공통 공지 입력.</p>
        <H>자동 발송 시점</H>
        <ul className="ml-5 list-disc">
          <li>입실 시 → 학생 본인 + 학부모 (수신 토글 ON 시)</li>
          <li>퇴실 시 → 동일</li>
          <li>미입실 (예정 시간 지남) → 학부모만 (parentLateMiss 토글 ON 시)</li>
        </ul>
        <H>수신 거부</H>
        <p>회원정보의 "메시지 수신" 체크박스(본인용 + 학부모용) 각각 토글. [bulk-import]에서 일괄 변경도 가능.</p>
        <H>발송 이력</H>
        <p>[관리 → 메시지 발송 관리 → 발송 이력]에서 최근 발송 200건 조회. 3초마다 자동 갱신.
        상태: <span className="rounded bg-emerald-100 px-1 text-xs">sent</span> 성공 /
        <span className="ml-1 rounded bg-amber-100 px-1 text-xs">mock</span> 키 미설정/실패 /
        <span className="ml-1 rounded bg-rose-100 px-1 text-xs">failed</span> 에러.</p>
      </>
    ),
  },
  {
    id: 'discount',
    title: '🏷 할인 등급 시스템',
    body: (
      <>
        <H>개념</H>
        <p>학원·외부 제휴 학생에게 차등 할인 이용권을 노출하기 위한 필터.</p>
        <H>학생 측 설정</H>
        <p>회원정보 → [회원수정] → "할인 대상" 드롭다운에서 <b>없음 / 1과목 / 2과목이상</b> 선택.</p>
        <H>이용권 측 설정</H>
        <p>이용권 폼 → "노출 대상 할인 등급" 체크박스 그룹. 예:</p>
        <ul className="ml-5 list-disc">
          <li>"분두 비원생 정상가(0%)" → 없음 체크</li>
          <li>"분두 1과목 할인(5%)" → 1과목 체크</li>
          <li>"분두 2과목 이상 할인(10%)" → 2과목이상 체크</li>
        </ul>
        <p>아무것도 안 체크하면 전체 학생에게 노출.</p>
        <H>동작</H>
        <p>회원정보의 이용권 선택 dropdown에 학생의 등급에 맞는 이용권만 나타남. 다른 등급 전용 이용권은 숨김.</p>
      </>
    ),
  },
  {
    id: 'troubleshoot',
    title: '🛠 자주 묻는 문제',
    body: (
      <>
        <Q q="모바일에서 글자가 깨져 보임">
          브라우저 강력 새로고침 (Chrome: Ctrl+Shift+R / Safari: 길게 누르고 새로고침). 그래도 안 되면 캐시 비우기.
        </Q>
        <Q q="좌석 배치한 게 새로고침하면 사라짐">
          [★ 기본값으로 저장] 누르지 않은 상태. 만들고 저장 한 번 눌러야 영구 보관. 또는 [⬇ 내보내기]로
          JSON 백업 후 다른 도메인에서 [⬆ 가져오기].
        </Q>
        <Q q="결제 시 시연 모드로 동작">
          상단 노랑 띠 ("결제선생 API 키 미설정") = 실제 결제 안 됨. 영업 통해 결제선생 API 키 발급 후
          Vercel env <code>PAYMENTTEACHER_API_KEY</code> 등록하면 자동 전환.
        </Q>
        <Q q="알림톡이 mock으로만 응답">
          뿌리오 환경변수 확인 — 키/sender/proxy 모두 설정되어야. [관리 → 메시지 발송 관리 → 잔여 캐시/포인트]에서 테스트.
        </Q>
        <Q q="키오스크에서 PIN 안 됨">
          ① 학생 PIN 미설정 — 회원 등록 시 4자리 입력 필수. ② 활성 이용권 없음 — 안내 메시지 뜸.
          ③ 관리자라면 [관리자 계정 → PIN 설정] 후 시도.
        </Q>
        <Q q="이용권 선택 화면에 일부가 안 보임">
          ① 그 이용권에 "노출 대상 할인 등급"이 설정돼 있는데 학생 등급이 일치 안 함 →
          회원수정에서 할인 등급 변경. ② 이용권이 "숨김" 상태 — 옆 [숨긴 이용권 보기] 체크.
        </Q>
        <Q q="Bridge 앱이 안 떠짐">
          PC에 Node.js 설치 (https://nodejs.org LTS). 그 후 bridge\start.bat 더블클릭.
          상세 가이드는 GitHub 레포의 bridge/README.md 참고.
        </Q>
      </>
    ),
  },
];

export function HelpPage() {
  const [activeId, setActiveId] = useState(SECTIONS[0].id);
  return (
    <>
      <PageHeader title="사용 설명서" desc="합격공간 관리 프로그램 운영 가이드" />
      <div className="flex flex-col gap-4 p-4 sm:p-6 lg:flex-row">
        <aside className="card sticky top-2 h-fit p-3 lg:w-56">
          <ul className="space-y-0.5 text-sm">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={() => setActiveId(s.id)}
                  className={`block rounded-md px-3 py-2 transition ${
                    activeId === s.id ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </aside>
        <main className="flex-1 space-y-6">
          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="card scroll-mt-4 p-6">
              <h2 className="mb-4 text-xl font-bold text-slate-900">{s.title}</h2>
              <div className="space-y-3 text-sm leading-relaxed text-slate-700">{s.body}</div>
            </section>
          ))}
          <p className="pt-4 text-center text-xs text-slate-400">
            최종 업데이트: 2026-06-26 · 문의: GitHub jaehee05/pp
          </p>
        </main>
      </div>
    </>
  );
}

function Step({ n, t, children }: { n: number; t: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-xs text-white">{n}</span>
        {t}
      </div>
      <div className="ml-7 text-sm text-slate-700">{children}</div>
    </div>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-3 text-sm font-bold text-slate-900">{children}</h3>;
}

function Q({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="mb-1 font-semibold text-slate-900">Q. {q}</div>
      <div className="text-slate-600">{children}</div>
    </div>
  );
}
