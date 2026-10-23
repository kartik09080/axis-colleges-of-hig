@echo off
rem ==========================================================================
rem  AXIS COLLEGES WEBSITE - ONE-CLICK START (Windows)
rem  Double-click this file. It starts a small local server in this folder
rem  and opens the website in your browser at http://localhost:8000
rem  Needs Python 3 (https://www.python.org/downloads/ - tick "Add to PATH").
rem  If Python is not found, the home page simply opens directly instead.
rem ==========================================================================

title Axis Colleges Website Server
cd /d "%~dp0"
set PORT=8000

rem --- Find Python (the "py" launcher or "python") ---
set PY=
where py >nul 2>nul && set PY=py -3
if not defined PY (
  where python >nul 2>nul && set PY=python
)

if not defined PY (
  echo.
  echo  Python was not found on this computer.
  echo  Opening the website directly from the file instead...
  echo  ^(Admin panel and all features still work in this mode.^)
  start "" "%~dp0index.html"
  pause
  exit /b 0
)

echo.
echo  ============================================================
echo   Axis Colleges Website is starting...
echo   Open this address in your browser:  http://localhost:%PORT%
echo   Staff admin panel:                  http://localhost:%PORT%/admin.html
echo   Admin password (default):           axis@2026
echo   To STOP the website, close this window.
echo  ============================================================
echo.

rem Open the browser after 2 seconds (gives the server time to start)
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:%PORT%"

%PY% -m http.server %PORT% --bind 127.0.0.1
pause
