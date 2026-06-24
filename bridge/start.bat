@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM ============================================
REM  합격공간 Bridge — Windows 휴대용 실행기
REM ============================================

cd /d "%~dp0"

set "NODE_VER=v20.18.1"
set "NODE_FOLDER=node-%NODE_VER%-win-x64"
set "NODE_URL=https://nodejs.org/dist/%NODE_VER%/%NODE_FOLDER%.zip"

REM ---- 0. 시스템에 Node 이미 설치되어 있는지 확인 ----
where node >nul 2>&1
if not errorlevel 1 (
  echo [info] 시스템에 Node 가 이미 설치되어 있습니다. 그대로 사용합니다.
  goto INSTALL_DEPS
)

REM ---- 1. 휴대용 Node 폴더 확인 ----
if exist "node\node.exe" (
  echo [info] 휴대용 Node 발견 ^(.\node\node.exe^)
  set "PATH=%CD%\node;%PATH%"
  goto INSTALL_DEPS
)

REM ---- 2. 다운로드 시도 ----
echo ============================================
echo  [1/4] Node.js 휴대용 버전 다운로드
echo  ^(1회만 - 약 30MB^)
echo ============================================
echo URL: %NODE_URL%
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%NODE_URL%' -OutFile 'node.zip' -UseBasicParsing; exit 0 } catch { Write-Host $_.Exception.Message; exit 1 }"

if not exist "node.zip" (
  echo.
  echo ============================================
  echo  [ERROR] Node 다운로드 실패
  echo ============================================
  echo.
  echo 원인 추정:
  echo  - 인터넷 연결 불가 또는 회사/학교 방화벽
  echo  - PowerShell 권한 차단
  echo.
  echo 해결책 2가지 중 택1:
  echo.
  echo  A^) Node 정식 설치 ^(권장^)
  echo     1. 브라우저로 https://nodejs.org 접속
  echo     2. 초록 LTS 버튼 → 더블클릭 → 다음 다음 다음
  echo     3. 설치 완료 후 이 start.bat 다시 더블클릭
  echo.
  echo  B^) Node ZIP 수동 다운로드
  echo     1. 브라우저로 %NODE_URL% 다운로드
  echo     2. 압축 해제 → 폴더 이름을 'node' 로 변경
  echo     3. 이 폴더 ^(%CD%^) 안에 통째로 이동
  echo        즉 %CD%\node\node.exe 가 되어야 함
  echo     4. start.bat 다시 실행
  echo.
  pause
  exit /b 1
)

echo [압축 해제 중...]
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Expand-Archive -Path 'node.zip' -DestinationPath '.' -Force; exit 0 } catch { Write-Host $_.Exception.Message; exit 1 }"

if not exist "%NODE_FOLDER%\node.exe" (
  echo [ERROR] 압축 해제 실패. 수동으로 풀어주세요:
  echo   node.zip 더블클릭 → 압축 해제 → 폴더명을 'node' 로 변경
  pause
  exit /b 1
)

ren "%NODE_FOLDER%" "node"
del node.zip 2>nul
echo [Node 준비 완료]
echo.

set "PATH=%CD%\node;%PATH%"

:INSTALL_DEPS
REM ---- 3. 의존성 설치 ----
if not exist "node_modules" (
  echo ============================================
  echo  [2/4] 의존성 설치 ^(1회만 - 약 1~2분^)
  echo ============================================
  call npm install --no-audit --no-fund --loglevel=error
  if errorlevel 1 (
    echo [ERROR] npm install 실패.
    pause
    exit /b 1
  )
  echo [의존성 설치 완료]
  echo.
)

REM ---- 4. .env 확인 ----
if not exist ".env" (
  echo ============================================
  echo  [3/4] .env 설정 파일이 없습니다
  echo ============================================
  echo.
  echo .env.example 을 복사한 뒤 값을 채워주세요:
  echo.
  echo    copy .env.example .env
  echo    notepad .env
  echo.
  pause
  exit /b 1
)

REM ---- 5. Bridge 실행 ----
echo ============================================
echo  [4/4] Bridge 실행 중 - 이 창을 닫지 마세요
echo ============================================
echo.
call npm start

echo.
echo [Bridge 종료됨] 아무 키나 누르면 창을 닫습니다.
pause
