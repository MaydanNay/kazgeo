# Start KazGEO services on Windows

Write-Host ""
Write-Host "Starting KazGEO Backend..." -ForegroundColor Cyan
$backend = Start-Process -FilePath ".\backend\venv\Scripts\python.exe" `
    -ArgumentList "-m uvicorn backend.main:app --host 0.0.0.0 --port 8000" `
    -PassThru -NoNewWindow

Write-Host "Starting KazGEO Frontend..." -ForegroundColor Cyan
$frontend = Start-Process -FilePath "npx" `
    -ArgumentList "serve src -l 3000" `
    -PassThru -NoNewWindow

Write-Host ""
Write-Host "--------------------------------------------------" -ForegroundColor Green
Write-Host "[x] KAZGEOMINER is running!" -ForegroundColor Green
Write-Host ""
Write-Host "[*] Main Page:       http://localhost:3000" -ForegroundColor Yellow
Write-Host "[*] User Dashboard:  http://localhost:3000/profile.html" -ForegroundColor Yellow
Write-Host "[*] Admin Panel:     http://localhost:3000/admin.html" -ForegroundColor Yellow
Write-Host "[*] API Docs:        http://localhost:8000/docs" -ForegroundColor Yellow
Write-Host "--------------------------------------------------" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop all services." -ForegroundColor Gray
Write-Host ""

try {
    Wait-Process -Id $backend.Id, $frontend.Id
} finally {
    Write-Host ""
    Write-Host "Stopping KazGEO services..." -ForegroundColor Red
    Stop-Process -Id $backend.Id -ErrorAction SilentlyContinue
    Stop-Process -Id $frontend.Id -ErrorAction SilentlyContinue
}
