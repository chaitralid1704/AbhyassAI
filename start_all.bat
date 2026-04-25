@echo off
echo ===================================================
echo Starting AbhyasAI Project Services...
echo ===================================================

echo [1/2] Starting FastAPI Backend on port 8000...
start "FastAPI Backend" cmd /k "cd backend && venv\Scripts\activate.bat && python main.py"

echo [2/2] Starting Next.js Frontend on port 3000...
start "NextJS Frontend" cmd /k "cd AI-Flashcard\AI-Flashcard && npm run dev"

echo All services are starting in separate windows!
echo You can close this window now.
pause
