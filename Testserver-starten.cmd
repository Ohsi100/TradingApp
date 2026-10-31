@echo off
rem Startet den Testserver fuer die Trading-Lernapp. Fenster offen lassen, solange du testest.
powershell -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port 8080
pause
