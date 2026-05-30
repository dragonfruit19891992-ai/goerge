@echo off
echo ==============================================
echo Installing George Local Core Daemon...
echo ==============================================
echo.

:: Check for Node.js
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please download and install Node.js from https://nodejs.org/
    pause
    exit /b
)

echo [1/3] Installing dependencies...
call npm install

echo [2/3] Installing PM2 to run George in the background...
call npm install -g pm2

echo [3/3] Starting George Daemon...
call pm2 start server.js --name "GeorgeCore"

echo.
echo ==============================================
echo INSTALLATION COMPLETE!
echo George is now running permanently in the background.
echo You can safely close this window.
echo ==============================================
pause
