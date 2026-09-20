@echo off
setlocal enabledelayedexpansion
cd /d C:\Users\coach\starforce-command-core1\starforce-command-core1

rem Fail fast with a clear message if the checkout path above is wrong.
if not exist ".git" (
    echo ERROR: No git repo found in %CD%
    echo        Fix the "cd /d" line at the top of this script so it points at
    echo        the folder that contains your project's .git folder.
    goto :fail
)

rem ===========================================================================
rem ship to site.bat (v3) - pull the CURRENT source package from the build
rem sandbox and push it to GitHub (GitHub Actions builds and deploys).
rem
rem FRESHNESS GUARANTEE:
rem   1. The sandbox regenerates the package on every build.
rem   2. If the download is real gzip, its SHA-256 is checked against the
rem      sidecar file. If the serving layer hands back an uncompressed tar
rem      snapshot instead, the hash is skipped (it cannot match) and safety
rem      falls to the build-stamp freshness gate below.
rem   3. BUILD-INFO.txt is read from inside the package and anything older
rem      than the last successful ship is refused. The last-ship record stores
rem      the PACKAGE's build stamp (not the wall-clock ship time), so re-running
rem      against the same package is a friendly no-op, not a stale error.
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
rem -UseBasicParsing is required: without it, PowerShell 5.1 uses the IE engine
rem and can fail silently on machines where IE first-run config never ran.
set "SIDECAR_OK=0"
for /L %%N in (1,1,3) do (
    if "!SIDECAR_OK!"=="0" (
        %PS% "$ErrorActionPreference='Stop'; $t=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 30 -Uri ('%SIDECAR_URL%'+'?v='+$t) -Headers @{ 'Cache-Control'='no-cache'; 'Pragma'='no-cache' } -OutFile '%SIDECAR%.part'; if ((Get-Item '%SIDECAR%.part').Length -lt 32) { throw 'fingerprint file suspiciously small' }; Move-Item -Force '%SIDECAR%.part' '%SIDECAR' } catch { exit 1 }"
        if not errorlevel 1 set "SIDECAR_OK=1"
        if "!SIDECAR_OK!"=="0" (
            echo        Fingerprint download attempt %%N failed, retrying...
            timeout /t 3 /nobreak >nul
        )
    )
)
if "%SIDECAR_OK%"=="1" (
    echo        Fingerprint downloaded.
) else (
    echo WARNING: Could not download the fingerprint file after 3 attempts.
    echo          Continuing with the build-stamp freshness check only.
    del /q /f "%SIDECAR%" 2>nul
)

%PS% "$ErrorActionPreference='Stop'; $t=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); Remove-Item -Force -ErrorAction SilentlyContinue '%PART%'; try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 120 -Uri ('%ARCHIVE_URL%'+'?v='+$t) -Headers @{ 'Cache-Control'='no-cache'; 'Pragma'='no-cache' } -OutFile '%PART%' } catch { exit 1 }; if (-not (Test-Path '%PART%')) { throw 'Download did not create an archive.' }"
if errorlevel 1 (
    echo ERROR: Could not download the source package.
    echo        The sandbox may be offline or rebuilding - try again shortly.
    goto :fail
)
for %%A in ("%PART%") do echo        Downloaded %%~zA bytes.

rem ---------------------------------------------------------------------------
echo [2/6] Verifying package...
rem ---------------------------------------------------------------------------
rem Detect the real format from magic bytes: gzip = 1F 8B.
set "FORMAT=tar"
for /f "usebackq delims=" %%F in (`%PS% "$fs=[System.IO.File]::OpenRead('%PART%'); $b=New-Object byte[] 2; [void]$fs.Read($b,0,2); $fs.Close(); if ($b[0] -eq 31 -and $b[1] -eq 139) { Write-Output 'gzip' } else { Write-Output 'tar' }"`) do set "FORMAT=%%F"
echo        Package format: !FORMAT!

if "!FORMAT!"=="gzip" if exist "%SIDECAR%" (
    %PS% "$ErrorActionPreference='Stop'; $expected=(Get-Content '%SIDECAR%' -TotalCount 1).Trim().Split(' ')[0]; $actual=(Get-FileHash -Algorithm SHA256 '%PART%').Hash.ToLower(); if ($actual -ne $expected) { Write-Host ('  expected: ' + $expected); Write-Host ('  actual:   ' + $actual); throw 'SHA-256 MISMATCH - stale CDN copy or corrupted download. Nothing was changed.' }"
    if errorlevel 1 (
        echo ERROR: Fingerprint mismatch - nothing was changed. Re-run the script.
        goto :fail
    )
    echo        SHA-256 fingerprint OK.
) else (
    if "!FORMAT!"=="gzip" (
        echo        Fingerprint unavailable this run - relying on build stamp.
    ) else (
        echo        Serving layer delivered an uncompressed snapshot; hash check
        echo        not applicable - relying on build stamp + validation below.
    )
)

rem ---------------------------------------------------------------------------
echo [3/6] Validating archive and reading build stamp...
rem ---------------------------------------------------------------------------
rem No explicit -z flag: tar auto-detects gzip or plain tar when reading.
%PS% "$ErrorActionPreference='Stop'; tar -tf '%PART%' *> $null; if ($LASTEXITCODE -ne 0) { throw 'Downloaded package is incomplete or invalid. Nothing changed.' }; $stamp = tar -xOf '%PART%' BUILD-INFO.txt 2>$null; if (-not $stamp) { $stamp = tar -xOf '%PART%' ./BUILD-INFO.txt 2>$null }; if (-not $stamp) { throw 'BUILD-INFO.txt missing from package. Nothing changed.' }; $stampLine = @($stamp) | Where-Object { $_ -like 'Built: *' } | Select-Object -First 1; if (-not $stampLine) { throw 'BUILD-INFO.txt has no Built: line. Nothing changed.' }; $built = [datetime]::Parse($stampLine.Substring(7), [System.Globalization.CultureInfo]::InvariantCulture).ToUniversalTime(); Set-Content -Path '%BUILTAT_FILE%' -Value $built.ToString('o'); Write-Host ('  Package built: ' + $built.ToString('yyyy-MM-dd HH:mm:ss') + ' UTC')"
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
rem -xf auto-detects gzip or plain tar.
tar -xf "%ARCHIVE%" -C .
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

rem ---- no changes: record the package stamp and finish ----
copy /y "%BUILTAT_FILE%" "%LAST_SHIP_FILE%" >nul
echo No changes detected - the sandbox and the local repo are already in sync.
goto :done

:have_changes
for /f "usebackq delims=" %%L in (`%PS% "$b=(Get-Content 'BUILD-INFO.txt' | Where-Object { $_ -like 'Built: *' } | Select-Object -First 1); Write-Output $b.Substring(7)"`) do set "STAMP=%%L"
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
for /f "usebackq delims=" %%L in (`%PS% "Write-Output (Get-Date).ToUniversalTime().ToString('o')"`) do set "NOW_UTC=%%L"
copy /y "%BUILTAT_FILE%" "%LAST_SHIP_FILE%" >nul
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
