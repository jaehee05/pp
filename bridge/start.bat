@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM ============================================
REM  합격공간 Bridge — Windows 휴대용 실행기
REM  (Node.js 설치 없이 첫 실행 시 자동 셋업)
REM ============================================

cd /d "%~dp0"

set "NODE_VER=v20.18.1"
set "NODE_FOLDER=node-%NODE_VER%-win-x64"
set "NODE_URL=https://nodejs.org/dist/%NODE_VER%/%NODE_FOLDER%.zip"

REM ---- Step 1: Node 휴대용 버전 (없으면 다운로드) ----
if not exist "node\node.exe" (
  echo ============================================
  echo  [1/4] Node.js 휴대용 버전 다운로드
  echo  ^(1회만 - 약 30MB^)
  echo ============================================
  echo URL: %NODE_URL%
  echo.

  powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%NODE_URL%' -OutFile 'node.zip' -UseBasicParsing}"
  if errorlevel 1 (
    echo.
    echo [ERROR] Node 다운로드 실패. 인터넷 연결 확인 후 다시 시도.
    pause
    exit /b 1
  )

  echo [압축 해제 중...]
  powershell -Command "Expand-Archive -Path 'node.zip' -DestinationPath '.' -Force"
  if errorlevel 1 (
    echo [ERROR] 압축 해제 실패.
    pause
    exit /b 1
  )

  if exist "%NODE_FOLDER%" (
    ren "%NODE_FOLDER%" "node"
  )
  del node.zip 2>nul

  echo [Node 준비 완료]
  echo.
)

REM ---- Step 2: PATH 임시 설정 (휴대용 Node 사용) ----
set "PATH=%CD%\node;%PATH%"

REM ---- Step 3: 의존성 설치 (없으면) ----
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

REM ---- Step 4: .env 확인 ----
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
  echo 그 후 start.bat 을 다시 실행하세요.
  pause
  exit /b 1
)

REM ---- Step 5: Bridge 실행 ----
echo ============================================
echo  [4/4] Bridge 실행 중 - 이 창을 닫지 마세요
echo ============================================
echo.
call npm start

echo.
echo [Bridge 종료됨] 아무 키나 누르면 창을 닫습니다.
pause
