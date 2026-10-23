@echo off
rem ==========================================================================
rem  AXIS COLLEGES WEBSITE - SIMPLE START (Windows)
rem  Double-click this file to run the website.
rem  Your browser opens http://localhost:8000
rem  Others on the same Wi-Fi can open the address shown below.
rem  Close this window to stop the website.
rem ==========================================================================

title Axis Colleges Website
cd /d "%~dp0"

rem Choose Python (the "python" command or the "py" launcher)
set PY=
where python >nul 2>nul && set PY=python
if "%PY%"=="" where py >nul 2>nul && set PY=py -3

if "%PY%"=="" (
  echo Python is not installed. Opening index.html instead...
  echo ^(To run the full website, install Python from python.org and tick "Add to PATH".^)
  start "" "%~dp0index.html"
  pause
  exit /b
)

echo.
echo  ==============================================
echo   Axis Colleges Website is running
echo  ==============================================
echo   On this computer:    http://localhost:8000
echo   Admin panel:         http://localhost:8000/admin.html
echo   Admin password:      axis@2026
echo.
echo   To show others on the same Wi-Fi, give them
echo   one of these addresses (replace with your IP):
ipconfig | findstr /i "IPv4"
echo.
echo   Close this window to stop the website.
echo  ==============================================
echo.

rem Open the browser after 2 seconds, once the server has started
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:8000"

%PY% -m http.server 8000 --bind 0.0.0.0
pause
