@echo off
cd /d "%~dp0"
if not exist .env (
  copy .env.example .env >nul
  echo Created .env. Paste your GROQ_API_KEY after the = sign, save, then close Notepad.
  notepad .env
)
start "" http://localhost:3000
node server.js
pause
