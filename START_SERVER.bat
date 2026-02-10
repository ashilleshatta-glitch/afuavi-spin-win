@echo off
echo ========================================
echo   Spin & Win - Starting Server
echo ========================================
echo.
echo Server will start on http://localhost:3000
echo.
echo Main Page: http://localhost:3000
echo Admin Page: http://localhost:3000/admin
echo Test Page: http://localhost:3000/test-admin.html
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

cd /d "%~dp0"
npm start
