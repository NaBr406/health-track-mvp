param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$MavenArgs = @("test")
)

$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $PSScriptRoot
$serverDir = Join-Path $rootDir "server"
$wrapperPropsPath = Join-Path $serverDir ".mvn\wrapper\maven-wrapper.properties"
$defaultJavaHome = "D:\Program Files\Android\Android Studio\jbr"
$projectMavenSettingsPath = Join-Path $rootDir ".codex-maven-settings.xml"

if (-not (Test-Path $wrapperPropsPath)) {
  throw "Missing Maven wrapper properties: $wrapperPropsPath"
}

$distributionUrl = (
  Get-Content $wrapperPropsPath |
    Where-Object { $_ -like "distributionUrl=*" } |
    Select-Object -First 1
) -replace "^distributionUrl=", ""

if (-not $distributionUrl) {
  throw "Unable to resolve distributionUrl from $wrapperPropsPath"
}

$distDir = Join-Path $serverDir ".mvn\dist"
$zipName = Split-Path $distributionUrl -Leaf
$zipPath = Join-Path $distDir $zipName
$extractName = [System.IO.Path]::GetFileNameWithoutExtension($zipName) -replace "-bin$", ""
$mavenHome = Join-Path $distDir $extractName
$mvnCmd = Join-Path $mavenHome "bin\mvn.cmd"
$globalWrapperRoot = Join-Path $env:USERPROFILE ".m2\wrapper\dists"

New-Item -ItemType Directory -Force -Path $distDir | Out-Null

if (-not (Test-Path $mvnCmd) -and (Test-Path $globalWrapperRoot)) {
  $existingMvnCmd = Get-ChildItem -Path $globalWrapperRoot -Recurse -Filter "mvn.cmd" -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -like "*$extractName*" } |
    Select-Object -First 1

  if ($existingMvnCmd) {
    $existingMavenHome = Split-Path -Parent (Split-Path -Parent $existingMvnCmd.FullName)
    if (Test-Path $existingMavenHome) {
      Write-Host "[health-track] Reusing existing Maven distribution: $existingMavenHome" -ForegroundColor DarkGray
      Remove-Item -LiteralPath $mavenHome -Recurse -Force -ErrorAction SilentlyContinue
      Copy-Item -LiteralPath $existingMavenHome -Destination $mavenHome -Recurse -Force
    }
  }
}

if (-not (Test-Path $zipPath)) {
  Write-Host "[health-track] Downloading Maven distribution..." -ForegroundColor Cyan
  & curl.exe -L --fail --retry 5 --retry-delay 2 $distributionUrl -o $zipPath
}

if (-not (Test-Path $mvnCmd)) {
  Write-Host "[health-track] Extracting Maven distribution..." -ForegroundColor Cyan
  Expand-Archive -LiteralPath $zipPath -DestinationPath $distDir -Force
}

if (-not (Test-Path $mvnCmd)) {
  throw "Unable to bootstrap Maven at $mvnCmd"
}

if (-not $env:JAVA_HOME -and (Test-Path $defaultJavaHome)) {
  $env:JAVA_HOME = $defaultJavaHome
}

if ($env:JAVA_HOME) {
  $javaBin = Join-Path $env:JAVA_HOME "bin"
  if (($env:Path -split ";") -notcontains $javaBin) {
    $env:Path = "$javaBin;$env:Path"
  }
}

$resolvedMavenArgs = @()
if (Test-Path $projectMavenSettingsPath) {
  $resolvedMavenArgs += @("-s", $projectMavenSettingsPath)
}
$resolvedMavenArgs += $MavenArgs

Push-Location $serverDir
try {
  & $mvnCmd @resolvedMavenArgs
} finally {
  Pop-Location
}
