@echo off
rem Axis Drive - one-click local launcher for Windows.
rem Double-click this file. First run sets things up (about a minute); later runs start at once.
rem Your files are kept in the data_store folder next to this file.
setlocal
cd /d "%~dp0"
if "%PORT%"=="" set PORT=8000

set PY=
where py >nul 2>nul && py -3 -c "import sys" >nul 2>nul && set PY=py -3
if "%PY%"=="" (
  where python >nul 2>nul && python -c "import sys" >nul 2>nul && set PY=python
)
if "%PY%"=="" (
  echo Python 3.9 or newer is needed.
  echo Install it from https://www.python.org/downloads/ ^(tick "Add python.exe to PATH"^), then run this again.
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo Setting up Axis Drive for the first time. This takes a minute...
  %PY% -m venv .venv
  if errorlevel 1 goto :fail
  ".venv\Scripts\python.exe" -m pip install --quiet --upgrade pip
  ".venv\Scripts\python.exe" -m pip install --quiet -r requirements.txt
  if errorlevel 1 goto :fail
)

echo.
echo Axis Drive is starting at http://localhost:%PORT%
echo Keep this window open while you use the app. Close it to stop.
echo.
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:%PORT%"
set PORT=%PORT%
".venv\Scripts\python.exe" app.py
goto :end

:fail
echo.
echo Setup failed. Check your internet connection and try again.
pause
exit /b 1

:end
pause
