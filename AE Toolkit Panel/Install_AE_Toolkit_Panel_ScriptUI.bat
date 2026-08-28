@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title AE Toolkit Panel - ScriptUI Panel Installer
color 0b

net session >nul 2>&1
if not "%errorlevel%"=="0" (
    echo Requesting administrator permission...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo =======================================================
echo      AE TOOLKIT PANEL - SCRIPTUI PANEL INSTALLER
echo =======================================================
echo.
echo This installs the standalone .jsx panel (no CEP required).
echo.

set "SOURCE_FILE=%~dp0AE Toolkit Panel.jsx"

if not exist "%SOURCE_FILE%" (
    echo [ERROR] "AE Toolkit Panel.jsx" was not found next to this installer.
    echo Keep this file in the same folder as the script.
    echo.
    pause
    exit /b 1
)

set "FOUND=0"

echo [1/2] Looking for After Effects installations...
for /d %%D in ("C:\Program Files\Adobe\Adobe After Effects *") do (
    set "PANELS=%%~fD\Support Files\Scripts\ScriptUI Panels"
    if exist "!PANELS!" (
        echo       Found: %%~nxD
        set "FOUND=1"
    )
)

if "%FOUND%"=="0" (
    echo [ERROR] No After Effects installation was found under
    echo         C:\Program Files\Adobe
    echo.
    pause
    exit /b 1
)
echo.

echo [2/2] Installing AE Toolkit Panel.jsx...
for /d %%D in ("C:\Program Files\Adobe\Adobe After Effects *") do (
    set "PANELS=%%~fD\Support Files\Scripts\ScriptUI Panels"
    if exist "!PANELS!" (
        rem Remove the previous version first so an old copy - or a
        rem development symlink - is never left behind.
        if exist "!PANELS!\AE Toolkit Panel.jsx" del /F /Q "!PANELS!\AE Toolkit Panel.jsx" >nul 2>&1
        copy /Y "%SOURCE_FILE%" "!PANELS!\AE Toolkit Panel.jsx" >nul
        if errorlevel 1 (
            echo       [FAILED] %%~nxD
        ) else (
            echo       [OK] %%~nxD
        )
    )
)
echo.

echo =======================================================
echo              INSTALLATION COMPLETE
echo =======================================================
echo.
echo Restart After Effects, then open:
echo Window ^> AE Toolkit Panel.jsx
echo.
pause
exit /b 0
