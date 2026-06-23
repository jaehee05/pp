import { useState } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { useStudents, emptyStudent } from '../../store/students';
import { usePlans } from '../../store/plans';
import { firestoreStorage } from '../../lib/firestoreStorage';
import type { Seat } from '../../lib/types';

// 일회성 데이터 임포트. 페이지에 들어와 [전체 등록] 한 번만 누르면 됨.
// 회원/이용권/좌석 배정/누적 결제를 한 번에 처리.

interface Row {
  kind: 'student' | 'adult';
  gender: 'M' | 'F';
  name: string;
  phone: string;
  pin: string;
  msgReceive: boolean;
  seatLabel: string;        // 좌석 번호
  startDate: string;        // YYYY-MM-DD
  endDate: string;
  totalPaid: number;
}

// 60명 회원 데이터
const ROWS: Row[] = parseRows(`
학생|여성|강주아|010-3194-2579|2579|거부|25|2026-06-15|2026-06-30|0
학생|여성|박예은|010-8543-5657|5657|거부|31|2026-06-16|2026-06-30|0
학생|남성|김이현|010-7294-5811|5811|거부|27|2026-06-11|2026-06-30|0
학생|남성|주영인|010-2624-6561|6561|거부|29|2026-06-07|2026-06-30|0
학생|남성|남정연|010-9109-0569|0569|거부|35|2026-06-01|2026-06-30|0
학생|여성|박가영|010-6851-3470|3470|수신|13|2026-06-01|2026-06-30|0
학생|남성|한준영|010-2732-5579|5579|거부|38|2026-06-01|2026-06-30|140000
학생|여성|정수인|010-3975-6987|6988|거부|20|2026-06-01|2026-06-30|490000
학생|여성|박시우|010-5772-4335|4335|거부|7|2026-06-01|2026-06-30|490000
학생|남성|정현우|010-4849-8640|8640|거부|54|2026-06-01|2026-06-30|0
학생|남성|조하민|010-7329-5735|5735|거부|33|2026-06-01|2026-06-30|0
학생|남성|김재우|010-5662-1028|1028|거부|37|2026-06-01|2026-06-30|0
학생|여성|이서연|010-3149-9518|9518|거부|3|2026-06-01|2026-06-30|178800
학생|남성|백건우|010-2022-6997|6997|거부|39|2026-06-01|2026-06-30|82000
학생|남성|김승찬|010-9773-4929|4929|거부|67|2026-06-01|2026-06-30|0
학생|남성|이상우|010-5808-6196|6196|거부|64|2026-06-01|2026-06-30|0
학생|남성|전준혁|010-5129-1289|1289|거부|65|2026-06-01|2026-06-30|0
학생|남성|박준하|010-3441-2261|2261|거부|52|2026-06-01|2026-06-30|0
학생|남성|김효성|010-3534-3767|3767|거부|58|2026-06-01|2026-06-30|0
학생|남성|김신형|010-6281-3740|3740|거부|42|2026-06-01|2026-06-30|0
학생|여성|하지민|010-8745-6769|6769|거부|22|2026-06-01|2026-06-30|0
학생|여성|정이안|010-3028-3111|3111|거부|1|2026-06-01|2026-06-30|465500
학생|여성|김윤아|010-3919-4243|4243|거부|9|2026-06-01|2026-06-30|0
학생|남성|이성규|010-6510-5942|5942|거부|36|2026-06-01|2026-06-30|650000
학생|남성|최재영|010-3148-5060|5060|거부|68|2026-06-01|2026-06-30|2948570
학생|남성|현동근|010-8732-6167|6167|거부|43|2026-06-01|2026-06-30|2099300
학생|여성|서희윤|041-7141-0541|0541|거부|4|2026-06-01|2026-06-30|879900
학생|여성|남민서|010-5911-6408|6408|거부|21|2026-06-01|2026-06-30|3523000
학생|여성|황우림|010-3455-4206|3455|거부|17|2026-06-01|2026-06-30|344400
학생|남성|배지호|010-8308-6770|6770|거부|66|2026-06-01|2026-06-30|0
학생|남성|박승민|010-9005-5978|5978|거부|61|2026-06-01|2026-06-30|0
학생|여성|김서연|010-7199-2461|2461|거부|19|2026-06-01|2026-06-30|0
학생|남성|윤현승|010-8365-7726|7765|거부|41|2026-06-01|2026-06-30|0
학생|여성|김하은|010-9679-6031|6031|거부|11|2026-06-01|2026-06-30|0
학생|여성|채지우|010-5681-6640|6640|거부|18|2026-06-01|2026-06-30|937830
학생|여성|김민채|010-3968-2325|2325|거부|14|2026-06-01|2026-06-30|490000
학생|여성|이윤하|010-8240-4624|4624|거부|15|2026-06-01|2026-06-30|3203000
학생|남성|이수민|010-7648-7635|7635|거부|59|2026-06-01|2026-06-30|490000
학생|여성|박시윤|010-6216-8569|8569|거부|23|2026-06-01|2026-06-30|2120000
학생|남성|윤지우|010-2265-5410|5410|거부|60|2026-06-01|2026-06-30|1396500
학생|남성|모시현|010-4279-1463|1463|거부|46|2026-06-01|2026-06-30|0
학생|여성|장은지|010-3526-7586|7586|거부|6|2026-06-01|2026-06-30|0
학생|남성|하선재|010-8915-5621|5621|거부|69|2026-06-01|2026-06-30|0
학생|여성|정서윤|010-4241-9276|9276|거부|12|2026-06-01|2026-06-30|0
학생|남성|맹건영|010-3043-8929|8929|거부|51|2026-06-01|2026-06-30|490000
학생|여성|이채은|010-6648-0729|0729|거부|5|2026-06-01|2026-06-30|490000
학생|남성|정규상|010-7107-6204|6204|거부|70|2026-06-01|2026-06-30|490000
학생|남성|김민우|010-5940-0784|0784|거부|56|2026-06-01|2026-06-30|0
학생|남성|박지훈|010-5298-3739|3739|거부|40|2026-06-01|2026-06-30|0
학생|여성|김시연|010-5294-0861|0861|거부|8|2026-06-01|2026-06-30|1465200
학생|남성|김류진|010-9295-2889|2889|거부|62|2026-06-01|2026-06-30|0
학생|여성|김리원|010-8304-3362|3362|거부|16|2026-06-01|2026-06-30|465500
학생|여성|박규나|010-3223-7521|7521|거부|10|2026-06-01|2026-06-30|3029220
학생|남성|김도윤|010-9948-2358|2358|거부|47|2026-06-01|2026-06-30|0
학생|남성|정규진|010-6346-6520|6520|거부|63|2026-06-01|2026-06-30|490000
학생|남성|천지훈|010-9244-0782|0782|거부|53|2026-06-01|2026-06-30|480330
학생|여성|양서진|010-5272-9513|5272|거부|2|2026-06-01|2026-06-30|0
학생|남성|박찬우|010-4079-4426|4426|거부|57|2026-06-01|2026-06-30|0
학생|여성|윤희연|010-6204-9087|9087|거부|24|2026-06-01|2026-06-30|2129670
성인|남성|김재희|010-4151-8306|8306|수신|90|2024-06-25|2038-01-01|0
`);

function parseRows(blob: string): Row[] {
  return blob.trim().split('\n').map((line) => {
    const [kind, gender, name, phone, pin, msg, seat, start, end, paid] = line.split('|');
    return {
      kind: kind === '성인' ? 'adult' : 'student',
      gender: gender === '남성' ? 'M' : 'F',
      name, phone, pin,
      msgReceive: msg === '수신',
      seatLabel: seat,
      startDate: start, endDate: end,
      totalPaid: +paid || 0,
    };
  });
}

const SEAT_STORE_KEY = 'pp.seatLayout.v3';

export function BulkImportPage() {
  const addStudent = useStudents((s) => s.add);
  const removeStudent = useStudents((s) => s.remove);
  const updateStudent = useStudents((s) => s.update);
  const studentList = useStudents((s) => s.list);
  const { plans, addSubscription, addPayment, subs, removeSubscription } = usePlans();

  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  function append(line: string) {
    setLog((prev) => [...prev, line]);
  }

  async function clearImported() {
    const targetNames = new Set(ROWS.map((r) => `${r.name}|${r.phone}`));
    const toDelete = studentList.filter((s) => targetNames.has(`${s.name}|${s.phone}`));
    if (toDelete.length === 0) {
      alert('삭제할 회원 없음 (이미 비어있음).');
      return;
    }
    if (!confirm(`임포트 데이터와 일치하는 회원 ${toDelete.length}명을 삭제합니다.\n이용권·결제 내역도 함께 정리되고 좌석 배정도 해제됩니다.\n진행할까요?`)) return;

    setRunning(true); setLog([]); setDone(false);

    const idSet = new Set(toDelete.map((s) => s.id));

    // 1) 이용권 삭제
    let subCount = 0;
    for (const s of subs) {
      if (idSet.has(s.studentId)) { removeSubscription(s.id); subCount++; }
    }
    append(`🗑 이용권 ${subCount}건 삭제`);

    // 2) 좌석 배정 해제
    let seatCleared = 0;
    try {
      const raw = await firestoreStorage.getItem(SEAT_STORE_KEY);
      if (raw) {
        const layout = JSON.parse(raw) as { seats?: Seat[] };
        if (layout.seats) {
          for (const seat of layout.seats) {
            if (seat.assignedStudentId && idSet.has(seat.assignedStudentId)) {
              seat.assignedStudentId = null;
              seatCleared++;
            }
          }
          await firestoreStorage.setItem(SEAT_STORE_KEY, JSON.stringify(layout));
          append(`🪑 좌석 ${seatCleared}석 배정 해제`);
        }
      }
    } catch (e) {
      append(`⚠️ 좌석 정리 실패: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 3) 회원 삭제
    for (const s of toDelete) removeStudent(s.id);
    append(`👤 회원 ${toDelete.length}명 삭제`);
    append('');
    append('완료. "▶ 전체 등록" 다시 누르면 새로 등록됩니다.');
    setRunning(false);
  }

  function bulkSetMsgReceive(target: 'student' | 'parent', value: boolean) {
    const label = target === 'parent' ? '학부모' : '본인';
    if (!confirm(`전체 회원(${studentList.length}명)의 ${label} 메시지 수신을 ${value ? 'ON' : 'OFF'} 으로 일괄 변경합니다. 진행할까요?`)) return;
    setLog([]);
    let changed = 0;
    for (const s of studentList) {
      const cur = target === 'parent' ? s.parentMsgReceive : s.msgReceive;
      if (cur === value) continue;
      updateStudent(s.id, target === 'parent' ? { parentMsgReceive: value } : { msgReceive: value });
      changed++;
    }
    setLog([`✅ ${label} 메시지 수신 ${value ? 'ON' : 'OFF'} — ${changed}명 변경 (이미 같은 값이었던 ${studentList.length - changed}명 스킵)`]);
  }

  async function runImport() {
    if (!confirm(`${ROWS.length}명 회원 + 이용권 + 좌석 배정 + 누적 결제를 등록합니다.\n중복 등록되지 않게 기존 동일 이름·전화 회원은 건너뜁니다.\n진행할까요?`)) return;

    setRunning(true);
    setLog([]);
    setDone(false);

    // 1) 기본 플랜 보장: '고정석 기간권 1개월' 이 없으면 자동 생성하지 않고, 기존 '1개월 기본' 사용.
    const basicPlan = plans.find((p) => p.id === 'p_1m_basic') ?? plans.find((p) => p.category === 'seat' && p.type === 'period');
    if (!basicPlan) {
      append('❌ 기본 이용권(기간권) 없음. /admin/seat-plans 에서 먼저 1개월 기간권 추가하세요.');
      setRunning(false);
      return;
    }

    // 2) 좌석 레이아웃 로드
    let seats: Seat[] = [];
    let layoutRaw: { seats?: Seat[] } | null = null;
    try {
      const raw = await firestoreStorage.getItem(SEAT_STORE_KEY);
      if (raw) {
        layoutRaw = JSON.parse(raw);
        seats = layoutRaw?.seats ?? [];
      }
    } catch { /* */ }
    append(`📋 현재 배치도: 좌석 ${seats.filter((s) => s.type === 'seat').length}개`);

    let created = 0; let skipped = 0; let seatAssigned = 0; let seatMissing = 0;
    for (const r of ROWS) {
      // 기존 회원 중복 체크 (이름 + 전화 동일)
      const exists = studentList.find((s) => s.name === r.name && s.phone === r.phone);
      if (exists) {
        append(`⏭  ${r.name} (이미 등록됨)`);
        skipped++;
        continue;
      }

      const base = emptyStudent();
      const studentId = addStudent({
        ...base,
        name: r.name,
        gender: r.gender,
        phone: r.phone,
        pin: r.pin,
        memberKind: r.kind,
        memberState: 'normal',
        msgReceive: r.msgReceive,
        parentMsgReceive: r.msgReceive,
      });

      // 이용권 (Subscription)
      const startAt = new Date(r.startDate).getTime();
      const endAt = new Date(r.endDate).getTime();
      const durationDays = Math.max(1, Math.round((endAt - startAt) / 86400000) + 1);
      addSubscription({
        studentId, planId: basicPlan.id,
        planSnapshot: {
          name: basicPlan.name, type: basicPlan.type,
          durationDays, hours: basicPlan.hours, counts: basicPlan.counts,
          price: basicPlan.price,
        },
        startAt, endAt,
        status: 'active',
      });

      // 누적 결제 (있으면 단일 Payment로 기록)
      if (r.totalPaid > 0) {
        addPayment({
          studentId, planId: basicPlan.id,
          amount: r.totalPaid, method: 'card', status: 'approved',
          approvedAt: startAt,
        });
      }

      // 좌석 매칭 (label을 숫자로 정규화 — "01"과 "1" 동일 취급)
      const targetNum = parseInt(r.seatLabel, 10);
      const seat = seats.find((s) =>
        s.type === 'seat' && !s.assignedStudentId &&
        !isNaN(targetNum) && parseInt(s.label, 10) === targetNum,
      );
      if (seat) {
        seat.assignedStudentId = studentId;
        const history = seat.assignmentHistory ?? [];
        history.push({ studentId, assignedAt: startAt });
        seat.assignmentHistory = history;
        seatAssigned++;
      } else {
        seatMissing++;
      }

      append(`✅ ${r.name} (좌석 ${r.seatLabel}${seat ? '' : ' — 배치도에 없음'})`);
      created++;
    }

    // 좌석 레이아웃 저장
    if (layoutRaw && seatAssigned > 0) {
      layoutRaw.seats = seats;
      try {
        await firestoreStorage.setItem(SEAT_STORE_KEY, JSON.stringify(layoutRaw));
        append(`💾 배치도 업데이트 (${seatAssigned}석 배정)`);
      } catch (e) {
        append(`⚠️ 배치도 저장 실패: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    append('');
    append(`완료: 신규 ${created}명 / 스킵 ${skipped}명 / 좌석 매칭 ${seatAssigned} / 좌석 못찾음 ${seatMissing}`);
    setDone(true);
    setRunning(false);
  }

  return (
    <>
      <PageHeader
        title="일괄 회원 등록 (60명)"
        desc="제공된 회원 목록을 한 번에 등록합니다. 기존 동일 이름·전화 회원은 스킵."
      />
      <div className="p-6">
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-700">
                대상: <b>{ROWS.length}명</b> · 기존 등록: <b>{studentList.length}명</b>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                기본 이용권: 고정석 기간권 (시작일/종료일은 행별 데이터, 가격 0원 또는 누적금액 적용).
                좌석은 좌석번호(label)로 자동 매칭. 배치도에 해당 번호 없으면 좌석만 미배정.
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="rounded-md bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-500"
                onClick={clearImported}
                disabled={running}
                title="임포트 데이터와 일치하는 회원만 삭제 (이용권·좌석 정리)"
              >
                ⊝ 기존 데이터 삭제
              </button>
              <button
                className="rounded-md bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-500"
                onClick={runImport}
                disabled={running || done}
              >
                {done ? '✅ 완료' : running ? '진행 중…' : '▶ 전체 등록'}
              </button>
            </div>
          </div>
          {log.length > 0 && (
            <pre className="max-h-[600px] overflow-y-auto rounded-md bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
              {log.join('\n')}
            </pre>
          )}
        </div>

        <div className="card mt-4 p-6">
          <h3 className="mb-3 font-semibold">📨 메시지 수신 일괄 토글</h3>
          <p className="mb-4 text-xs text-slate-500">
            현재 등록된 모든 회원({studentList.length}명)의 메시지 수신 설정을 한 번에 변경합니다.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-md border border-slate-200 p-4">
              <div className="mb-2 text-sm font-semibold text-slate-700">학부모 메시지 수신</div>
              <div className="flex gap-2">
                <button className="flex-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                  onClick={() => bulkSetMsgReceive('parent', true)} disabled={running}>
                  전체 ON
                </button>
                <button className="flex-1 rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
                  onClick={() => bulkSetMsgReceive('parent', false)} disabled={running}>
                  전체 OFF
                </button>
              </div>
            </div>
            <div className="rounded-md border border-slate-200 p-4">
              <div className="mb-2 text-sm font-semibold text-slate-700">본인(학생) 메시지 수신</div>
              <div className="flex gap-2">
                <button className="flex-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                  onClick={() => bulkSetMsgReceive('student', true)} disabled={running}>
                  전체 ON
                </button>
                <button className="flex-1 rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
                  onClick={() => bulkSetMsgReceive('student', false)} disabled={running}>
                  전체 OFF
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
