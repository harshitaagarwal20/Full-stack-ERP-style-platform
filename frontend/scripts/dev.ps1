$ErrorActionPreference = "Stop"

$frontendDir = Split-Path -Parent $PSScriptRoot
$targetDir = $frontendDir
$mappedDrive = $null

if ($frontendDir.StartsWith('\\')) {
  $preferred = @('Z','Y','X','W','V')
  foreach ($d in $preferred) {
    if (-not (Get-PSDrive -Name $d -ErrorAction SilentlyContinue)) {
      New-PSDrive -Name $d -PSProvider FileSystem -Root $frontendDir | Out-Null
      $mappedDrive = $d
      $targetDir = "$d`:\"
      break
    }
  }

  if (-not $mappedDrive) {
    throw "No free drive letter available to map UNC path for Vite startup."
  }
}

try {
  Set-Location -LiteralPath $targetDir
  $env:CHOKIDAR_USEPOLLING = '1'
  $env:CHOKIDAR_INTERVAL = '800'
  & node .\node_modules\vite\bin\vite.js --host --port 5174 --strictPort
}
finally {
  if ($mappedDrive) {
    Remove-PSDrive -Name $mappedDrive -ErrorAction SilentlyContinue
  }
}
