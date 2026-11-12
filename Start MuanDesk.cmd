@echo off
if exist "%~dp0dist\MuanDesk-win32-x64\MuanDesk.exe" (
  start "" "%~dp0dist\MuanDesk-win32-x64\MuanDesk.exe"
) else (
  echo Please run npm ci and npm run package first.
  pause
)
