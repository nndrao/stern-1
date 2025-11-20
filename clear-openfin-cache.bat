@echo off
echo Clearing OpenFin cache...
echo.

echo Killing OpenFin processes...
taskkill /F /IM openfin.exe 2>nul
taskkill /F /IM OpenFinRVM.exe 2>nul
timeout /t 2 /nobreak > nul

echo.
echo Deleting cache directory...
rmdir /s /q "%LOCALAPPDATA%\OpenFin\cache" 2>nul

echo.
echo OpenFin cache cleared!
echo.
echo You can now launch OpenFin with: launch-openfin.bat
echo.
pause
