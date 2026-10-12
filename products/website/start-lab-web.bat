@echo off
REM ALEPHY: persistent launcher for the website dev server (Node, port 8080).
REM Started by scheduled task "AlephyLabWeb" (trigger: at logon) so the server
REM survives shell sessions instead of being reaped at the end of each command.
cd /d "%~dp0"
"C:\Program Files\nodejs\node.exe" "C:\Users\DELL\Desktop\alephy\products\website\config\server.js"
