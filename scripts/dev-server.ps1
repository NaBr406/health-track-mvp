$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $PSScriptRoot
$serverDir = Join-Path $rootDir "server"
$wrapperPropsPath = Join-Path $serverDir ".mvn\wrapper\maven-wrapper.properties"
$defaultJavaHome = "D:\Program Files\Android\Android Studio\jbr"

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

New-Item -ItemType Directory -Force -Path $distDir | Out-Null

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

if (-not $env:SPRING_PROFILES_ACTIVE) {
  $env:SPRING_PROFILES_ACTIVE = "local"
}

Push-Location $serverDir
try {
  & $mvnCmd spring-boot:run
} finally {
  Pop-Location
}
