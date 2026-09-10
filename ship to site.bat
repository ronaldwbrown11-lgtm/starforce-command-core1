@echo off
setlocal enabledelayedexpansion
cd /d C:\Users\coach\starforce-command-core1\starforce-command-core1

rem ===========================================================================
rem ship to site.bat - pull the CURRENT source package from the build sandbox
rem and push it to GitHub (GitHub Actions builds and deploys to Hostinger).
rem
rem FRESHNESS GUARANTEE:
rem   1. The sandbox regenerates the package on every build
rem      (bun run build / build:ci both end with package:source).
rem   2. This script downloads a tiny .sha256 sidecar, then the archive, and
rem      hashes the archive locally - a stale/cached download aborts here.
rem   3. It reads BUILD-INFO.txt from inside the archive and refuses anything
rem      older than the last successful ship (recorded in the user profile).
rem ===========================================================================

set "ARCHIVE_URL=https://crisp-turtles-fall.freebuff.dev/starforce-source-latest.tar.gz"
set "SIDECAR_URL=https://crisp-turtles-fall.freebuff.dev/starforce-source-latest.tar.gz.sha256"
set "ARCHIVE=%TEMP%\starforce-source-latest.tar.gz"
set "SIDECAR=%TEMP%\starforce-source-latest.tar.gz.sha256"
set "PART=%ARCHIVE%.part"
set "BUILTAT_FILE=%TEMP%\sf-builtat.txt"
set "LAST_SHIP_FILE=%LOCALAPPDATA%\starforce-last-ship.txt"
set "PS=powershell -NoProfile -ExecutionPolicy Bypass -Command"

echo ============================================================
echo  Star Force Base 1198 - ship to site
echo ============================================================

rem ---------------------------------------------------------------------------
echo [1/6] Downloading fingerprint + package...
rem ---------------------------------------------------------------------------
%PS% "$ErrorActionPreference='Stop'; $t=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); Invoke-WebRequest -Uri ('%SIDECAR_URL%'+'?v='+$t) -Headers @{ 'Cache-Control'='no-cache'; 'Pragma'='no-cache' } -OutFile '%SIDECAR%.part'; Move-Item -Force '%SIDECAR%.part' '%SIDECAR'"
if errorlevel 1 (
    echo ERROR: Could not download the fingerprint file.
    echo        The sandbox build may not have produced a package yet.
    echo        Run a build in the sandbox first, then re-run this script.
    goto :fail
)
%PS% "$ErrorActionPreference='Stop'; $t=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); Remove-Item -Force -ErrorAction SilentlyContinue '%PART%'; Invoke-WebRequest -Uri ('%ARCHIVE_URL%'+'?v='+$t) -Headers @{ 'Cache-Control'='no-cache'; 'Pragma'='no-cache' } -OutFile '%PART%'; if (-not (Test-Path '%PART%')) { throw 'Download did not create an archive.' }"
if errorlevel 1 (
    echo ERROR: Could not download the source package.
    goto :fail
)
for %%A in ("%PART%") do echo        Downloaded %%~zA bytes.

rem ---------------------------------------------------------------------------
echo [2/6] Verifying SHA-256 fingerprint...
rem ---------------------------------------------------------------------------
%PS% "$ErrorActionPreference='Stop'; $expected=(Get-Content '%SIDECAR%' -TotalCount 1).Trim().Split(' ')[0]; $actual=(Get-FileHash -Algorithm SHA256 '%PART%').Hash.ToLower(); if ($actual -ne $expected) { Write-Host ('  expected: ' + $expected); Write-Host ('  actual:   ' + $actual); throw 'SHA-256 MISMATCH - stale CDN copy or corrupted download. Nothing was changed.' }"
if errorlevel 1 (
    echo ERROR: Fingerprint mismatch - nothing was changed. Re-run the script.
    goto :fail
)
echo        Fingerprint OK.

rem ---------------------------------------------------------------------------
echo [3/6] Validating archive and reading build stamp...
rem ---------------------------------------------------------------------------
%PS% "$ErrorActionPreference='Stop'; tar -tzf '%PART%' *> $null; if ($LASTEXITCODE -ne 0) { throw 'Downloaded package is incomplete or invalid. Nothing changed.' }; $stamp = tar -xOzf '%PART%' BUILD-INFO.txt 2>$null; if (-not $stamp) { $stamp = tar -xOzf '%PART%' ./BUILD-INFO.txt 2>$null }; if (-not $stamp) { throw 'BUILD-INFO.txt missing from package. Nothing changed.' }; $stampLine = @($stamp) | Where-Object { $_ -like 'Built: *' } | Select-Object -First 1; if (-not $stampLine) { throw 'BUILD-INFO.txt has no Built: line. Nothing changed.' }; $built = [datetime]::Parse($stampLine.Substring(7), [System.Globalization.CultureInfo]::InvariantCulture).ToUniversalTime(); Set-Content -Path '%BUILTAT_FILE%' -Value $built.ToString('o'); Write-Host ('  Package built: ' + $built.ToString('yyyy-MM-dd HH:mm:ss') + ' UTC')"
if errorlevel 1 (
    echo ERROR: Archive validation failed - nothing was changed.
    goto :fail
)

rem ---------------------------------------------------------------------------
echo [4/6] Freshness check...
rem ---------------------------------------------------------------------------
%PS% "$ErrorActionPreference='Stop'; $built=[datetime]::Parse((Get-Content '%BUILTAT_FILE%' -TotalCount 1), [System.Globalization.CultureInfo]::InvariantCulture).ToUniversalTime(); $last=$null; if (Test-Path '%LAST_SHIP_FILE%') { $lastText=(Get-Content '%LAST_SHIP_FILE%' -TotalCount 1).Trim(); if ($lastText) { try { $last=[datetime]::Parse($lastText, [System.Globalization.CultureInfo]::InvariantCulture).ToUniversalTime() } catch { $last=$null } } }; if ($last -and $built -lt $last) { Write-Host ('  Package built: ' + $built.ToString('yyyy-MM-dd HH:mm:ss') + ' UTC'); Write-Host ('  Last shipped:  ' + $last.ToString('yyyy-MM-dd HH:mm:ss') + ' UTC'); throw 'STALE PACKAGE - it is OLDER than the last successful ship. Re-run the sandbox build so the package regenerates, then ship again. Nothing was changed.' }; if ($last) { Write-Host '  Package is newer than the last ship - proceeding.' } else { Write-Host '  No previous ship record - accepting current package.' }"
if errorlevel 1 (
    echo ERROR: Stale package detected - nothing was changed.
    echo        Re-run the sandbox build first, then re-run this script.
    goto :fail
)
move /y "%PART%" "%ARCHIVE%" >nul

rem ---------------------------------------------------------------------------
echo [5/6] Extracting into the checkout...
rem ---------------------------------------------------------------------------
tar -xzf "%ARCHIVE%" -C .
if errorlevel 1 (
    echo ERROR: Extract failed - nothing was changed.
    echo        The archive is kept at %ARCHIVE% for inspection.
    goto :fail
)

rem Defensive cleanup: the package must never carry archives.
del /q /f "public\starforce-source-latest.tar.gz" 2>nul
del /q /f "public\starforce-source.tar.gz" 2>nul
del /q /f "public\starforce-source-20260826.tar.gz" 2>nul

rem ---------------------------------------------------------------------------
echo [6/6] Staging, committing, and pushing...
rem ---------------------------------------------------------------------------
git add -A
git diff --cached --quiet
if errorlevel 1 goto :have_changes

rem ---- no changes: record the ship timestamp and finish ----
for /f "usebackq delims=" %%L in (`%PS% "Write-Host (Get-Date).ToUniversalTime().ToString('o')"`) do set "NOW_UTC=%%L"
echo !NOW_UTC!> "%LAST_SHIP_FILE%"
echo No changes detected - the sandbox and the local repo are already in sync.
goto :done

:have_changes
for /f "usebackq delims=" %%L in (`%PS% "$b=(Get-Content 'BUILD-INFO.txt' | Where-Object { $_ -like 'Built: *' } | Select-Object -First 1); Write-Host $b.Substring(7)"`) do set "STAMP=%%L"
echo Committing package built !STAMP!
git commit -m "Deploy current source (package built !STAMP!)"
if errorlevel 1 (
    echo ERROR: Commit failed - changes are staged but not committed.
    goto :fail
)
git push origin main
if errorlevel 1 (
    echo ERROR: Push failed - check your GitHub login.
    echo        The commit is safe locally; re-run after fixing auth.
    goto :fail
)
for /f "usebackq delims=" %%L in (`%PS% "Write-Host (Get-Date).ToUniversalTime().ToString('o')"`) do set "NOW_UTC=%%L"
echo !NOW_UTC!> "%LAST_SHIP_FILE%"
echo ============================================================
echo  Pushed! GitHub Actions builds and deploys in ~90 seconds.
echo ============================================================
pause
exit /b 0

:fail
echo ============================================================
echo  Ship aborted - nothing was changed. See the error above.
echo ============================================================
pause
exit /b 1

:done
pause
exit /b 0
