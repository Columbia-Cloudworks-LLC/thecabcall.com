$ErrorActionPreference = "Stop"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " THE CAB CALL // DEFENSIVE HARDENING POWERSHELL TEST HARNESS" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

Write-Host "`n[Step 1/3] Running TypeScript strict compiler check (npx tsc --noEmit)..." -ForegroundColor Yellow
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) {
    Write-Error "TypeScript compilation check failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}
Write-Host "  -> TypeScript check passed with zero errors." -ForegroundColor Green

Write-Host "`n[Step 2/3] Auditing src/ for forbidden 'SELECT *' pass-through queries..." -ForegroundColor Yellow
$selectStarMatches = Get-ChildItem -Path "src" -Recurse -Include *.ts,*.tsx | Select-String -Pattern "SELECT\s+\*\s+FROM"
if ($null -ne $selectStarMatches -and $selectStarMatches.Count -gt 0) {
    Write-Error "Found forbidden 'SELECT * FROM' queries in src/:"
    $selectStarMatches | ForEach-Object { Write-Host $_.Line -ForegroundColor Red }
    exit 1
}
Write-Host "  -> Zero 'SELECT *' queries found across src/." -ForegroundColor Green

Write-Host "`n[Step 3/3] Executing automated defensive hardening verification suite..." -ForegroundColor Yellow
node --import ./scripts/register-ts-resolver.mjs scripts/verify-defensive-hardening.ts
if ($LASTEXITCODE -ne 0) {
    Write-Error "Defensive hardening verification suite failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}

Write-Host "`n==================================================================" -ForegroundColor Green
Write-Host " ALL DEFENSIVE HARDENING CHECKS PASSED SUCCESSFULLY" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
exit 0
