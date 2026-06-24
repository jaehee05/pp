# 합격공간 Bridge

PC 로컬에서 도는 작은 Node.js 앱. 브라우저(`passplace.space`)와 다음 두 하드웨어를 연결한다.

| 장치 | 역할 |
|---|---|
| **NICE VAN 카드 단말기** | 이용권 결제 (가맹점: 3285619001 메인 / 3285620001 서브) |
| **Suprema BioLite N2** (BioStar 2 경유) | 학생 입퇴실 지문 인식 + 지문 등록 |

브라우저는 `ws://localhost:7421`로 명령을 보내고(`src/lib/deviceAgent.ts`), 이 Bridge가 실제 SDK 호출을 대행한다.

## 사전 요구사항

- **Windows 10/11** (Node.js 설치 불필요 — start.bat이 자동 다운로드)
- **NICE VAN 미들웨어** (NICEPAY POS Connector 등) — VAN사 영업담당 설치. 보통 `127.0.0.1:9188` 또는 비슷한 로컬 포트로 listening
- **Suprema BioStar 2** 서버 + BioMini/N2 등록 완료

## 설치

폴더 받아서 운영자 PC에 복사 (GitHub Code → Download ZIP → bridge 폴더만 추출):

```cmd
cd bridge
copy .env.example .env
notepad .env
```

`.env` 에 실제 값 채우기:
- `NICE_HOST` / `NICE_PORT` — NICE 미들웨어 주소
- `BIOSTAR_BASE_URL` — `https://<biostar2-서버-IP>` (보통 같은 PC면 `https://127.0.0.1`)
- `BIOSTAR_USERNAME` / `BIOSTAR_PASSWORD` — BioStar 2 관리자 계정
- `BIOSTAR_DEVICE_ID` — BioStar 2 콘솔의 Device → BioLite N2 → ID

## 실행

**`start.bat` 더블클릭**.

- 첫 실행: Node.js 휴대용 버전 자동 다운로드 (~30MB) + 의존성 설치. 3~5분 소요
- 이후 실행: 즉시 시작
- 콘솔창에 "listening on ws://0.0.0.0:7421" 뜨면 성공
- **창 닫지 말 것**. 닫으면 Bridge 종료됨

cmd에서 직접 실행하려면 (Node 별도 설치 시):
```cmd
npm start
```

브라우저(passplace.space)가 자동으로 `ws://localhost:7421`에 연결. 키오스크 / 회원정보 페이지에서 카드결제·지문등록 누르면 이 Bridge로 명령 전달.

## 자동 시작 (옵션)

Windows 부팅 시 자동 실행:
1. `Win + R` → `shell:startup` → 시작 프로그램 폴더 열림
2. `start.bat` 바로가기를 그 폴더에 넣기

## 알려진 한계 / TODO

### NICE VAN 패킷 포맷
`src/nice-van.ts` 의 `nicePacket()` 함수는 일반적인 NICE 규격 골격으로 작성됨.
**실제 발급받은 "POS-VAN 연동규격서"** 와 비교해 필드 인덱스/구분자/길이 조정 필요.
일반적으로 NICE 영업담당이 PDF로 줌. 받으면 그대로 코드에 매핑하면 동작.

테스트 방법:
1. NICE 미들웨어가 떠 있는 상태에서 작은 금액(100원)으로 `npm start`
2. 브라우저에서 결제 시도
3. 콘솔 로그의 `rawResponse` 확인 → 응답 필드 위치 파악

### Suprema BioStar 2
- BioStar 2 New Local API 사용. 셀프 사이닝 인증서면 `BIOSTAR_INSECURE_TLS=true`
- 이벤트는 폴링 방식 (3초마다 `/api/events/search`). 더 빠른 실시간이 필요하면 BioStar SSE/WebSocket 으로 전환 가능
- 지문 등록은 운영자 PC에서: 회원정보 페이지 → "지문 등록" → BioLite N2 LED 점등 → 손가락 인식

### 입실/퇴실 매핑
브라우저의 학생 ID와 BioStar 의 `user_id` 매핑이 일치해야 함. 이 Bridge는
- 지문 등록 시 학생 ID 그대로 BioStar 사용자 ID 로 만들고
- 인식 이벤트의 `user_id` 를 그대로 브라우저로 전달

브라우저는 `student.fingerprintId === user_id` 로 매칭한다(Seats/Kiosk 로직).

## 배포 패키징 (선택)

단일 .exe 로 묶고 싶으면:
```cmd
npm install -g pkg
npm run build:exe
```
→ `dist/passplace-bridge.exe` 생성. Node 없이도 실행 가능.

## 로그 보기

콘솔에 실시간 출력. 파일로 남기고 싶으면:
```cmd
npm start > bridge.log 2>&1
```
