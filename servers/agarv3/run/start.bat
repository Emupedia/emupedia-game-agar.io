@echo off
REM start.bat - Restart the Node.js application if it crashes

REM Check if the node_modules folder exists one level up. If not, run npm install.
IF NOT EXIST "..\node_modules" (
    echo node_modules folder not found. Running npm install...
    npm install
    IF %ERRORLEVEL% NEQ 0 (
        echo npm install failed, exiting.
        exit /b %ERRORLEVEL%
    )
)

REM Set the command to run Node.js
set "COMMAND=node --trace-deprecation --max-old-space-size=2048 ../src/index.js"

:loop
echo Starting command: %COMMAND%
%COMMAND%
set EXIT_CODE=%ERRORLEVEL%
echo Command crashed with exit code %EXIT_CODE%. Restarting in 1 second...
timeout /t 1 >nul
goto loop