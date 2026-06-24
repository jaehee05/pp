@echo off
setlocal enabledelayedexpansion

REM ============================================
REM  passplace Bridge - Windows runner
REM ============================================

cd /d "%~dp0"

set "NODE_VER=v20.18.1"
set "NODE_FOLDER=node-%NODE_VER%-win-x64"
set "NODE_URL=https://nodejs.org/dist/%NODE_VER%/%NODE_FOLDER%.zip"

REM ---- 0. Use system Node if available ----
where node >nul 2>&1
if not errorlevel 1 (
  echo [info] Using system Node.js
  goto INSTALL_DEPS
)

REM ---- 1. Use portable Node if already present ----
if exist "node\node.exe" (
  echo [info] Using portable Node at .\node\node.exe
  set "PATH=%CD%\node;%PATH%"
  goto INSTALL_DEPS
)

REM ---- 2. Download portable Node ----
echo ============================================
echo  [1/4] Downloading portable Node.js
echo  (one-time, ~30MB)
echo ============================================
echo URL: %NODE_URL%
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%NODE_URL%' -OutFile 'node.zip' -UseBasicParsing; exit 0 } catch { Write-Host $_.Exception.Message; exit 1 }"

if not exist "node.zip" (
  echo.
  echo ============================================
  echo  [ERROR] Node download failed
  echo ============================================
  echo.
  echo Possible causes:
  echo  - No internet or firewall block
  echo  - PowerShell execution blocked
  echo.
  echo Solutions:
  echo.
  echo  A. Install Node.js officially:
  echo     1. Open https://nodejs.org
  echo     2. Click green LTS button, install
  echo     3. Re-run this start.bat
  echo.
  echo  B. Manual ZIP download:
  echo     1. Open %NODE_URL%
  echo     2. Extract, rename folder to 'node'
  echo     3. Move into %CD%
  echo        so %CD%\node\node.exe exists
  echo     4. Re-run this start.bat
  echo.
  pause
  exit /b 1
)

echo [Extracting...]
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Expand-Archive -Path 'node.zip' -DestinationPath '.' -Force; exit 0 } catch { Write-Host $_.Exception.Message; exit 1 }"

if not exist "%NODE_FOLDER%\node.exe" (
  echo [ERROR] Extraction failed. Unzip node.zip manually and rename folder to 'node'.
  pause
  exit /b 1
)

ren "%NODE_FOLDER%" "node"
del node.zip 2>nul
echo [Node ready]
echo.

set "PATH=%CD%\node;%PATH%"

:INSTALL_DEPS
REM ---- 3. Install dependencies ----
if not exist "node_modules" (
  echo ============================================
  echo  [2/4] Installing dependencies (one-time, 1-2 min)
  echo ============================================
  call npm install --no-audit --no-fund --loglevel=error
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
  echo [Dependencies installed]
  echo.
)

REM ---- 4. Check .env ----
if not exist ".env" (
  echo ============================================
  echo  [3/4] .env file not found
  echo ============================================
  echo.
  echo Copy .env.example and edit values:
  echo.
  echo    copy .env.example .env
  echo    notepad .env
  echo.
  pause
  exit /b 1
)

REM ---- 5. Run Bridge ----
echo ============================================
echo  [4/4] Bridge running - DO NOT close this window
echo ============================================
echo.
call npm start

echo.
echo [Bridge stopped] Press any key to close.
pause
