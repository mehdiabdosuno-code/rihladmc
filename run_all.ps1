Write-Host "🚀 Lancement de RIHLA Enterprise Platform..." -ForegroundColor Cyan

# 1. Nettoyage des ports
Write-Host "🧹 Nettoyage des processus existants..."
taskkill /F /IM node.exe 2>$null
taskkill /F /IM python.exe 2>$null

# 2. Lancement Backend en arrière-plan
Write-Host "⚙️ Démarrage du Backend (Port 8000)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; python -m uvicorn app.main:app --reload --port 8000"

# 3. Lancement Frontend en arrière-plan
Write-Host "🎨 Démarrage du Frontend (Port 5173)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host "✅ Terminé ! Attendez 5 secondes et ouvrez http://localhost:5173" -ForegroundColor Green
