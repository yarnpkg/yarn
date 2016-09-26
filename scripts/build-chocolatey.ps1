# build-chocolatey.ps1: Builds a Chocolatey package for Yarn

$ErrorActionPreference = 'Stop'; # stop on all errors

$version = node dist/bin/yarn --version
$installer_file = "yarn-$version.msi"
if (-not (Test-Path $installer_file)) {
  throw 'Hey! Listen! You need to build the installer with scripts/build-windows-installer.bat before building the Chocolatey package'
}

$hash = (Get-FileHash -Path $installer_file -Algorithm SHA256).Hash

# Replace placeholders in chocolateyInstall.ps1
(Get-Content .\resources\win-chocolatey\tools\chocolateyinstall.ps1.in) `
  -replace '{VERSION}', $version `
  -replace '{CHECKSUM}', $hash | 
  Set-Content .\resources\win-chocolatey\tools\chocolateyinstall.ps1
  
choco pack .\resources\win-chocolatey\yarn.nuspec --version $version