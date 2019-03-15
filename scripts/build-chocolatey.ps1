# build-chocolatey.ps1: Builds a Chocolatey package for Yarn, and optionally pushes it to 
# Chocolatey.org (if the -Publish flag is passed).

param(
  [switch] $Publish = $false
)

$ErrorActionPreference = 'Stop'; # stop on all errors

# Enforce usage of TLS 1.2, as GitHub requires it. PowerShell uses TLS 1.0 by 
# default, which causes "Could not create SSL/TLS secure channel" errors
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12;

if ($Env:YARN_RC -eq 'true') {
  Write-Output 'This is an RC release; Chocolatey will not be updated'
  Exit
}

# See if YARN_VERSION was passed in the environment, otherwise get version
# number from Yarn site
if ($Env:YARN_VERSION) {
  $latest_version = $Env:YARN_VERSION
} else {
  Write-Output 'Getting Yarn version from https://yarnpkg.com/latest-version'
  $latest_version = [String](Invoke-WebRequest -Uri https://yarnpkg.com/latest-version -UseBasicParsing)
}

Write-Output "Checking if $latest_version is already on Chocolatey..."
$choco_output = choco list yarn --exact --version $latest_version | Out-String
if ($choco_output -notmatch '0 packages found') {
  Write-Output 'Already on Chocolatey. Nothing to do!'
  Exit
}

if (-Not (Test-Path artifacts)) {
  mkdir artifacts
}
# Remove any existing Chocolatey packages, we don't care about them any more
rm artifacts/*.nupkg

# Download the installer so we can compute its hash
# Keep this in sync with chocolateyInstall.ps1.in
# This is intentionally not using /latest.msi to ensure the URL used by the Chocolatey package is valid.
$url = "https://yarnpkg.com/downloads/$latest_version/yarn-$latest_version.msi"
$installer_file = [IO.Path]::GetTempFileName()
Invoke-WebRequest -Uri $url -OutFile $installer_file

$hash = (Get-FileHash -Path $installer_file -Algorithm SHA256).Hash

# Replace placeholders in chocolateyInstall.ps1
(Get-Content $PSScriptRoot\..\resources\win-chocolatey\tools\chocolateyinstall.ps1.in) `
  -replace '{VERSION}', $latest_version `
  -replace '{CHECKSUM}', $hash | 
  Set-Content $PSScriptRoot\..\resources\win-chocolatey\tools\chocolateyinstall.ps1
  
choco pack $PSScriptRoot\..\resources\win-chocolatey\yarn.nuspec --version $latest_version
mv *.nupkg artifacts

if (!$Publish) {
  Write-Output 'Not publishing the package - Use "-Publish" flag if you want to publish it'
  Exit
}

$filename = ls artifacts\*.nupkg | % FullName
choco push $filename
