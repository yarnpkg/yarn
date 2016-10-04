$ErrorActionPreference = 'Stop'

if (-not (Test-Path 'dist/bin/yarn.js')) {
  throw 'Hey! Listen! You need to build dist with scripts/build-dist.ps1 first!'
}

# Create a temporary working directory and copy over the dist files
$temp_path = Join-Path $env:TEMP 'yarn-tmp-portable'
Write-Output "Using $temp_path for temporary storage"
if (Test-Path $temp_path) {
  # Temp directory already exists, clean it up
  Remove-Item $temp_path -Recurse
}
# Remove any existing built ZIPs
Remove-Item "portable-yarn-*.zip" -ErrorAction Ignore

Write-Output "Copying files"
Copy-Item -Path dist -Destination $temp_path -Recurse
Write-Output "Downloading node.exe"
Start-BitsTransfer -Source https://nodejs.org/dist/latest-v6.x/win-x64/node.exe -Destination (Join-Path $temp_path 'bin')

$nodejs_version = &"$temp_path\bin\node.exe" --version
if ($LASTEXITCODE -ne 0) {
  throw 'Something broke while downloading Node.js'
}
Write-Output "Node.js version: $nodejs_version"

# Update yarn.cmd to execute this version of Node
"@echo off`nnode.exe ""%~dp0\yarn.js"" %*" | Set-Content "$temp_path/bin/yarn.cmd"

# Ensure it works
$yarn_dist_version = node dist\bin\yarn --version
$yarn_version = &"$temp_path\bin\yarn.cmd" --version
$yarn_version2 = &"$temp_path\bin\node.exe" "$temp_path\bin\yarn.js" --version
if ($yarn_version -ne $yarn_dist_version -or $yarn_version2 -ne $yarn_dist_version) {
  throw "Something went wrong, $yarn_version != $yarn_version2 != $yarn_dist_version"
}

# Package it all up :D
$zip_file = "portable-yarn-$yarn_version-win-x64.zip"
Compress-Archive -Path "$temp_path\*" -DestinationPath $zip_file
Write-Output "Saved to $zip_file"

# Clean up
Remove-Item $temp_path -Recurse