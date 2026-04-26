@echo off
echo 🚀 Lancement FORCE de RIHLA Enterprise Platform...

:: Nettoyage
taskkill /F /IM node.exe /T >nul 2>&1
taskkill /F /IM python.exe /T >nul 2>&1

:: Lancement Backend
start "RIHLA BACKEND" cmd /k "cd backend && python -m uvicorn app.main:app --reload --port 8000"

:: Lancement Frontend avec NPX (plus robuste)
start "RIHLA FRONTEND" cmd /k "cd frontend && npx vite --port 5173"

echo ✅ Tentative de lancement via NPX...
echo Attendez que la fenêtre RIHLA FRONTEND affiche un lien bleu.
pause
