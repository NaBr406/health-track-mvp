$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $PSScriptRoot
$mobileDir = Join-Path $rootDir "mobile"
$androidUserDir = Join-Path $rootDir ".android-user"
$localAvdDir = Join-Path $androidUserDir "avd"
$sdkCandidates = @()

if ($env:ANDROID_HOME) {
  $sdkCandidates += $env:ANDROID_HOME
}

if ($env:ANDROID_SDK_ROOT) {
  $sdkCandidates += $env:ANDROID_SDK_ROOT
}

$sdkCandidates += @(
  "C:\Users\$env:USERNAME\AppData\Local\Android\Sdk",
  "C:\Users\NaBr\AppData\Local\Android\Sdk",
  "D:\Android\Sdk"
)

if (Test-Path "C:\Users") {
  $sdkCandidates += Get-ChildItem "C:\Users" -Directory -ErrorAction SilentlyContinue |
    ForEach-Object { Join-Path $_.FullName "AppData\Local\Android\Sdk" }
}

$sdkRoot = $sdkCandidates |
  Select-Object -Unique |
  Where-Object { $_ -and (Test-Path $_) } |
  Select-Object -First 1

if (-not $sdkRoot) {
  throw "Android SDK not found. Checked common install locations and environment variables."
}

$javaCandidates = @()

if ($env:JAVA_HOME) {
  $javaCandidates += $env:JAVA_HOME
}

$javaCandidates += @(
  "D:\Program Files\Android\Android Studio\jbr",
  "C:\Program Files\Android\Android Studio\jbr"
)

$javaHome = $javaCandidates |
  Select-Object -Unique |
  Where-Object { $_ -and (Test-Path $_) } |
  Select-Object -First 1

if (-not $javaHome) {
  throw "Android Studio bundled JBR was not found. Set JAVA_HOME and try again."
}

$adbPath = Join-Path $sdkRoot "platform-tools\adb.exe"
$emulatorPath = Join-Path $sdkRoot "emulator\emulator.exe"
$gradleWrapperPath = Join-Path $mobileDir "android\gradlew.bat"
$avdName = "HealthTrack_Pixel_35"
$packageName = "com.healthtrack.mobile"
$metroPort = 8081
$mobileEnvPath = Join-Path $mobileDir ".env"
$mobileEnvExamplePath = Join-Path $mobileDir ".env.example"
$packageJsonPath = Join-Path $mobileDir "package.json"
$packageLockPath = Join-Path $mobileDir "package-lock.json"
$debugApkPath = Join-Path $mobileDir "android\app\build\outputs\apk\debug\app-debug.apk"
$metroOutLog = Join-Path $rootDir ".codex-mobile.out.log"
$metroErrLog = Join-Path $rootDir ".codex-mobile.err.log"

if (-not (Test-Path $androidUserDir)) {
  New-Item -ItemType Directory -Path $androidUserDir -Force | Out-Null
}

$avdHomeCandidates = @()

if ($env:ANDROID_AVD_HOME) {
  $avdHomeCandidates += $env:ANDROID_AVD_HOME
}

if (Test-Path "C:\Users") {
  $avdHomeCandidates += Get-ChildItem "C:\Users" -Directory -ErrorAction SilentlyContinue |
    ForEach-Object { Join-Path $_.FullName ".android\avd" }
}

$avdHome = $avdHomeCandidates |
  Select-Object -Unique |
  Where-Object { $_ -and (Test-Path (Join-Path $_ "$avdName.ini")) } |
  Select-Object -First 1

if (-not $avdHome) {
  $avdHome = $localAvdDir
}

if (-not (Test-Path $avdHome)) {
  New-Item -ItemType Directory -Path $avdHome -Force | Out-Null
}

$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:ANDROID_SDK_HOME = $androidUserDir
$env:ANDROID_USER_HOME = $androidUserDir
$env:ANDROID_EMULATOR_HOME = $androidUserDir
$env:ANDROID_AVD_HOME = $avdHome
$env:JAVA_HOME = $javaHome
$env:HOME = $androidUserDir
$env:USERPROFILE = $androidUserDir

$pathEntries = @(
  (Join-Path $sdkRoot "platform-tools"),
  (Join-Path $sdkRoot "emulator"),
  (Join-Path $sdkRoot "cmdline-tools\latest\bin"),
  (Join-Path $javaHome "bin")
)

foreach ($entry in $pathEntries) {
  if (($env:Path -split ";") -notcontains $entry) {
    $env:Path += ";$entry"
  }
}

function Wait-ForEmulator {
  & $adbPath wait-for-device | Out-Null

  for ($i = 0; $i -lt 60; $i++) {
    $bootCompleted = (& $adbPath shell getprop sys.boot_completed 2>$null).Trim()
    if ($bootCompleted -eq "1") {
      return
    }

    Start-Sleep -Seconds 2
  }

  throw "Android emulator did not finish booting in time."
}

function Stop-NodeProcessOnPort([int]$Port) {
  $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if (-not $connections) {
    return
  }

  foreach ($connection in $connections) {
    try {
      $process = Get-Process -Id $connection.OwningProcess -ErrorAction Stop
    } catch {
      continue
    }

    if ($process.ProcessName -eq "node") {
      Write-Host "[health-track] Stopping existing Metro process on port $Port (PID $($process.Id))..." -ForegroundColor Yellow
      Stop-Process -Id $process.Id -Force
    }
  }
}

function Get-LatestNativeDependencyTimestamp {
  $paths = @($packageJsonPath, $packageLockPath) | Where-Object { Test-Path $_ }

  if (-not $paths) {
    return $null
  }

  return ($paths | Get-Item | Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime
}

function Should-InstallDebugApp([string]$InstalledPackage) {
  if (-not ($InstalledPackage | Select-String $packageName)) {
    return $true
  }

  if (-not (Test-Path $debugApkPath)) {
    return $true
  }

  $latestNativeDependencyChange = Get-LatestNativeDependencyTimestamp
  if (-not $latestNativeDependencyChange) {
    return $false
  }

  $apkTimestamp = (Get-Item $debugApkPath).LastWriteTime
  return $latestNativeDependencyChange -gt $apkTimestamp
}

if (-not (Test-Path $mobileEnvPath) -and (Test-Path $mobileEnvExamplePath)) {
  Copy-Item $mobileEnvExamplePath $mobileEnvPath
}

if (-not (Test-Path (Join-Path $mobileDir "node_modules"))) {
  Push-Location $mobileDir
  try {
    npm install
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path $adbPath)) {
  throw "adb not found at $adbPath"
}

if (-not (Test-Path $emulatorPath)) {
  throw "emulator not found at $emulatorPath"
}

if (-not (Test-Path $gradleWrapperPath)) {
  throw "Missing Gradle wrapper at $gradleWrapperPath"
}

try {
  & $adbPath kill-server | Out-Null
} catch {
}

$connectedDevices = & $adbPath devices | Select-String "^emulator-\d+\s+device$"
if (-not $connectedDevices) {
  Write-Host "[health-track] Starting Android emulator..." -ForegroundColor Cyan
  Write-Host "[health-track] Using emulator home: $env:ANDROID_EMULATOR_HOME" -ForegroundColor DarkGray
  Write-Host "[health-track] Using AVD home: $env:ANDROID_AVD_HOME" -ForegroundColor DarkGray
  Start-Process -FilePath $emulatorPath -ArgumentList "-avd", $avdName, "-gpu", "swiftshader_indirect", "-no-snapshot-load"

  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 5
    $connectedDevices = & $adbPath devices | Select-String "^emulator-\d+\s+device$"
    if ($connectedDevices) {
      break
    }
  }
}

if (-not $connectedDevices) {
  throw "Android emulator is not connected."
}

Wait-ForEmulator

$installedPackage = & $adbPath shell pm list packages $packageName
if (Should-InstallDebugApp -InstalledPackage $installedPackage) {
  Write-Host "[health-track] Installing Android debug app..." -ForegroundColor Cyan
  Push-Location (Join-Path $mobileDir "android")
  try {
    & $gradleWrapperPath app:installDebug
  } finally {
    Pop-Location
  }
}

Stop-NodeProcessOnPort -Port $metroPort

if (Test-Path $metroOutLog) {
  Remove-Item $metroOutLog -Force
}

if (Test-Path $metroErrLog) {
  Remove-Item $metroErrLog -Force
}

Write-Host "[health-track] Starting Metro on port $metroPort..." -ForegroundColor Cyan
Start-Process -FilePath "npm.cmd" `
  -ArgumentList "run", "start:dev-client" `
  -WorkingDirectory $mobileDir `
  -RedirectStandardOutput $metroOutLog `
  -RedirectStandardError $metroErrLog | Out-Null

for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 2
  $metroListening = Get-NetTCPConnection -LocalPort $metroPort -State Listen -ErrorAction SilentlyContinue
  if ($metroListening) {
    break
  }
}

$metroListening = Get-NetTCPConnection -LocalPort $metroPort -State Listen -ErrorAction SilentlyContinue
if (-not $metroListening) {
  throw "Metro did not start successfully. Check $metroOutLog and $metroErrLog"
}

& $adbPath reverse "tcp:$metroPort" "tcp:$metroPort" | Out-Null
& $adbPath shell am force-stop $packageName | Out-Null
& $adbPath shell monkey -p $packageName -c android.intent.category.LAUNCHER 1 | Out-Null

Write-Host "[health-track] Mobile dev environment is ready." -ForegroundColor Green
Write-Host "[health-track] Metro logs: $metroOutLog" -ForegroundColor DarkGray
