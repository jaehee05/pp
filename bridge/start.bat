@echo off
REM 합격공간 Bridge 실행 스크립트 (Windows)
REM 처음 한 번만: npm install
REM 일상 실행: 이 .bat 파일을 더블클릭

cd /d "%~dp0"

if not exist node_modules (
  echo [install] node_modules 없음 - npm install 실행
  call npm install
)

if not exist .env (
  echo [config] .env 파일이 없습니다. .env.example 을 .env 로 복사한 뒤 값 채워주세요.
  pause
  exit /b 1
)

call npm start
pause
