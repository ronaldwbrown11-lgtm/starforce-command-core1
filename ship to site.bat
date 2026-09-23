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
rem ship-to-site.bat (v5) - pull the CURRENT source package from the build
rem sandbox and push it to GitHub (GitHub Actions builds and deploys).
rem
rem This file is NEVER shipped inside the package. The running script must not
rem overwrite itself: cmd.exe reads batch files line by line by byte offset,
rem and a mid-run overwrite derails the rest of the script. Get script updates
rem from https://crisp-turtles-fall.freebuff.dev/ship-to-site.bat
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

set "BASE_URL=https://crisp-turtles-fall.freebuff.dev"
set "ARCHIVE_URL=%BASE_URL%/starforce-source-latest.tar.gz"
set "SIDECAR_URL=%BASE_URL%/starforce-source-latest.tar.gz.sha256"
set "ARCHIVE=%TEMP%\starforce-source-latest.tar.gz"
set "SIDECAR=%TEMP%\starforce-source-latest.tar.gz.sha256"
set "PART=%ARCHIVE%.part"
set "BUILTAT_FILE=%TEMP%\sf-builtat.txt"
set "LAST_SHIP_FILE=%LOCALAPPDATA%\starforce-last-ship.txt"
set "PS=powershell -NoProfile -ExecutionPolicy Bypass -Command"
set "SCRIPT_NAME=ship-to-site.bat"

echo ============================================================
echo  Star Force Base 1198 - ship to site (v5)
echo ============================================================

rem ---------------------------------------------------------------------------
echo [1/7] Waking the build sandbox (it idles to sleep between sessions)...
rem ---------------------------------------------------------------------------
rem A suspended sandbox answers every request with HTTP 502 - including the
rem package download below. Poll the site root for up to 2 minutes; any
rem response other than 502/503 means the serving layer is back.
set /a WAKE_N=0
:wake_loop
set /a WAKE_N+=1
%PS% "$ErrorActionPreference='Stop'; $t=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); try { $r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 15 -Uri ('%BASE_URL%'+'/?wake='+$t) -Headers @{ 'Cache-Control'='no-cache'; 'Pragma'='no-cache' }; exit 0 } catch { $code = $null; if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }; if ($code -eq 502 -or $code -eq 503) { exit 1 } else { exit 0 } }"
if not errorlevel 1 goto :wake_ok
if %WAKE_N% GEQ 12 goto :wake_dead
echo        Sandbox not answering yet - attempt %WAKE_N% of 12, waiting 10s...
timeout /t 10 /nobreak >nul
goto :wake_loop
:wake_dead
echo ERROR: Sandbox did not wake up after 2 minutes of polling.
echo        The platform is not serving the preview host right now.
echo        Reliable fix: open the project preview in your browser once,
echo        wait about a minute, then re-run this script.
goto :fail
:wake_ok
echo        Sandbox is awake.

rem ---------------------------------------------------------------------------
echo [2/7] Downloading fingerprint + package...
rem ---------------------------------------------------------------------------
rem -UseBasicParsing is required: without it, PowerShell 5.1 uses the IE engine
rem and can fail silently on machines where IE first-run config never ran.
set "SIDECAR_OK=0"
set /a SC_N=0
:sc_loop
set /a SC_N+=1
%PS% "$ErrorActionPreference='Stop'; $t=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 30 -Uri ('%SIDECAR_URL%'+'?v='+$t) -Headers @{ 'Cache-Control'='no-cache'; 'Pragma'='no-cache' } -OutFile '%SIDECAR%.part'; if ((Get-Item '%SIDECAR%.part').Length -lt 32) { throw 'fingerprint file suspiciously small' }; Move-Item -Force '%SIDECAR%.part' '%SIDECAR%' } catch { exit 1 }"
if not errorlevel 1 set "SIDECAR_OK=1"
if "%SIDECAR_OK%"=="1" goto :sc_ok
if %SC_N% GEQ 3 goto :sc_dead
echo        Fingerprint download attempt %SC_N% failed, retrying...
timeout /t 3 /nobreak >nul
goto :sc_loop
:sc_dead
echo WARNING: Could not download the fingerprint file after 3 attempts.
echo          Continuing with the build-stamp freshness check only.
del /q /f "%SIDECAR%" 2>nul
goto :sc_done
:sc_ok
echo        Fingerprint downloaded.
:sc_done

set "DL_OK=0"
set /a DL_N=0
:dl_loop
set /a DL_N+=1
%PS% "$ErrorActionPreference='Stop'; $t=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); Remove-Item -Force -ErrorAction SilentlyContinue '%PART%'; try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 120 -Uri ('%ARCHIVE_URL%'+'?v='+$t) -Headers @{ 'Cache-Control'='no-cache'; 'Pragma'='no-cache' } -OutFile '%PART%' } catch { exit 1 }; if (-not (Test-Path '%PART%')) { throw 'Download did not create an archive.' }"
if not errorlevel 1 set "DL_OK=1"
if "%DL_OK%"=="1" goto :dl_ok
if %DL_N% GEQ 4 goto :dl_dead
echo        Package download attempt %DL_N% failed - retrying in 10s...
timeout /t 10 /nobreak >nul
goto :dl_loop
:dl_dead
echo ERROR: Could not download the source package after 4 attempts.
%PS% "try { $r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 15 -Uri ('%BASE_URL%'+'/?probe='+[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()); Write-Host ('        Site root responds HTTP ' + [int]$r.StatusCode + ' - the package route itself is failing.') } catch { $code = $null; if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }; if ($code) { Write-Host ('        Site root responds HTTP ' + $code + ' - the sandbox serving layer is DOWN (rebuild or outage). Wait a few minutes and re-run; nothing was changed.') } else { Write-Host '        Site root unreachable (network or DNS) - check your connection. Nothing was changed.' } }"
goto :fail
:dl_ok
for %%A in ("%PART%") do echo        Downloaded %%~zA bytes.

rem ---------------------------------------------------------------------------
echo [3/7] Verifying package...
rem ---------------------------------------------------------------------------
rem Detect the real format from magic bytes: gzip = 1F 8B.
set "FORMAT=tar"
for /f "usebackq delims=" %%F in (`%PS% "$fs=[System.IO.File]::OpenRead('%PART%'); $b=New-Object byte[] 2; [void]$fs.Read($b,0,2); $fs.Close(); if ($b[0] -eq 31 -and $b[1] -eq 139) { Write-Output 'gzip' } else { Write-Output 'tar' }"`) do set "FORMAT=%%F"
echo        Package format: !FORMAT!

if "!FORMAT!"=="gzip" if exist "%SIDECAR%" goto :hash_check
echo        Fingerprint unavailable or package is not gzip - relying on build stamp.
goto :hash_done
:hash_check
%PS% "$ErrorActionPreference='Stop'; $expected=(Get-Content '%SIDECAR%' -TotalCount 1).Trim().Split(' ')[0]; $actual=(Get-FileHash -Algorithm SHA256 '%PART%').Hash.ToLower(); if ($actual -ne $expected) { Write-Host ('  expected: ' + $expected); Write-Host ('  actual:   ' + $actual); throw 'SHA-256 MISMATCH - stale CDN copy or corrupted download. Nothing was changed.' }"
if errorlevel 1 (
    echo ERROR: Fingerprint mismatch - nothing was changed. Re-run the script.
    goto :fail
)
echo        SHA-256 fingerprint OK.
:hash_done

rem ---------------------------------------------------------------------------
echo [4/7] Validating archive and reading build stamp...
rem ---------------------------------------------------------------------------
rem No explicit -z flag: tar auto-detects gzip or plain tar when reading.
%PS% "$ErrorActionPreference='Stop'; tar -tf '%PART%' *> $null; if ($LASTEXITCODE -ne 0) { throw 'Downloaded package is incomplete or invalid. Nothing changed.' }; $stamp = tar -xOf '%PART%' BUILD-INFO.txt 2>$null; if (-not $stamp) { $stamp = tar -xOf '%PART%' ./BUILD-INFO.txt 2>$null }; if (-not $stamp) { throw 'BUILD-INFO.txt missing from package. Nothing changed.' }; $stampLine = @($stamp) | Where-Object { $_ -like 'Built: *' } | Select-Object -First 1; if (-not $stampLine) { throw 'BUILD-INFO.txt has no Built: line. Nothing changed.' }; $built = [datetime]::Parse($stampLine.Substring(7), [System.Globalization.CultureInfo]::InvariantCulture).ToUniversalTime(); Set-Content -Path '%BUILTAT_FILE%' -Value $built.ToString('o'); Write-Host ('  Package built: ' + $built.ToString('yyyy-MM-dd HH:mm:ss') + ' UTC')"
if errorlevel 1 (
    echo ERROR: Archive validation failed - nothing was changed.
    goto :fail
)

rem ---------------------------------------------------------------------------
echo [5/7] Freshness check...
rem ---------------------------------------------------------------------------
%PS% "$ErrorActionPreference='Stop'; $built=[datetime]::Parse((Get-Content '%BUILTAT_FILE%' -TotalCount 1), [System.Globalization.CultureInfo]::InvariantCulture).ToUniversalTime(); $last=$null; if (Test-Path '%LAST_SHIP_FILE%') { $lastText=(Get-Content '%LAST_SHIP_FILE%' -TotalCount 1).Trim(); if ($lastText) { try { $last=[datetime]::Parse($lastText, [System.Globalization.CultureInfo]::InvariantCulture).ToUniversalTime() } catch { $last=$null } } }; if ($last -and $built -lt $last) { Write-Host ('  Package built: ' + $built.ToString('yyyy-MM-dd HH:mm:ss') + ' UTC'); Write-Host ('  Last shipped:  ' + $last.ToString('yyyy-MM-dd HH:mm:ss') + ' UTC'); throw 'STALE PACKAGE - it is OLDER than the last successful ship. Re-run the sandbox build so the package regenerates, then ship again. Nothing was changed.' }; if ($last) { Write-Host '  Package is newer than the last ship - proceeding.' } else { Write-Host '  No previous ship record - accepting current package.' }"
if errorlevel 1 (
    echo ERROR: Stale package detected - nothing was changed.
    echo        Re-run the sandbox build first, then re-run this script.
    goto :fail
)
move /y "%PART%" "%ARCHIVE%" >nul

rem ---------------------------------------------------------------------------
echo [6/7] Extracting into the checkout...
rem ---------------------------------------------------------------------------
rem -xf auto-detects gzip or plain tar. The script also excludes ITSELF from
rem extraction: overwriting this .bat while cmd.exe is executing it derails
rem the rest of the run. Belt and suspenders - the packager excludes it too.
tar --exclude="%SCRIPT_NAME%" -xf "%ARCHIVE%" -C .
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
echo [7/7] Staging, committing, and pushing...
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
copy /y "%BUILTAT_FILE%" "%LAST_SHIP_FILE%" >nul
echo ============================================================
echo  Pushed! GitHub Actions builds and deploys in about 90 seconds.
echo ============================================================
goto :done

:fail
echo ============================================================
echo  Ship aborted - nothing was changed. See the error above.
echo ============================================================
pause
exit /b 1

:done
pause
exit /b 0
