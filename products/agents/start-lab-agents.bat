@echo off
REM ALEPHY: persistent launcher for the Lab agent server (Flask, port 5000).
REM Started by scheduled task "AlephyLabAgents" (trigger: at logon) so the server
REM survives shell sessions instead of being reaped at the end of each command.
cd /d "%~dp0"
"C:\Users\DELL\AppData\Local\Python\pythoncore-3.14-64\python.exe" -u server.py --host 127.0.0.1 --port 5000 --no-browser >> "C:\Users\DELL\Desktop\alephy\.agent-server.log" 2>&1
