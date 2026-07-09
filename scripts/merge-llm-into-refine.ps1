$ErrorActionPreference = "Continue"
$Repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (Test-Path (Join-Path $PSScriptRoot "..\frontend\package.json")) {
  $Repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}
Set-Location $Repo

Write-Host "=== repo: $Repo ===" -ForegroundColor Cyan
Write-Host "=== git status -sb ===" -ForegroundColor Cyan
git status -sb

Write-Host "`n=== git merge feat/llm-model-tiering ===" -ForegroundColor Cyan
git merge feat/llm-model-tiering -m "merge: feat/llm-model-tiering into refine/dashboard-compact"
$mergeExit = $LASTEXITCODE

if ($mergeExit -ne 0) {
  Write-Host "`n=== conflicts (if any) ===" -ForegroundColor Yellow
  git diff --name-only --diff-filter=U
  Write-Host "`nResolve conflicts, then re-run with -ContinueOnly" -ForegroundColor Yellow
  exit $mergeExit
}

Write-Host "`n=== git push ===" -ForegroundColor Cyan
git push origin refine/dashboard-compact

Write-Host "`n=== done ===" -ForegroundColor Green
git log -3 --oneline
git status -sb
