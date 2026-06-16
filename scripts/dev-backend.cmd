@echo off
cd /d "%~dp0..\backend"
"%~dp0..\.venv\Scripts\python.exe" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
