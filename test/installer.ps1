# SPDX-License-Identifier: GPL-3.0-only
param([string]$SetupPath)
$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$manifest = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
if (-not $SetupPath) { $SetupPath = Join-Path $root ("dist/releases/MuanDesk-Setup-" + $manifest.version + '-x64.exe') }
$SetupPath = (Resolve-Path -LiteralPath $SetupPath).Path
$registryRoot = 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Uninstall'
$existing = Get-ChildItem -LiteralPath $registryRoot -ErrorAction SilentlyContinue | Get-ItemProperty | Where-Object { $_.DisplayName -eq 'MuanDesk' }
if ($existing) { throw 'An installed MuanDesk already exists. Run this test on a clean Windows user or VM.' }
$shortcuts = @((Join-Path ([Environment]::GetFolderPath('Desktop')) 'MuanDesk.lnk'), (Join-Path ([Environment]::GetFolderPath('Programs')) 'MuanDesk.lnk'))
foreach ($shortcut in $shortcuts) { if (Test-Path -LiteralPath $shortcut) { throw 'An existing MuanDesk shortcut would be overwritten. Use a clean Windows user or VM.' } }
$temporaryRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$testDirectory = [System.IO.Path]::GetFullPath((Join-Path $temporaryRoot ('MuanDesk-Installer-Test-' + [Guid]::NewGuid().ToString('N'))))
if (-not $testDirectory.StartsWith($temporaryRoot, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe installation test path' }
function Run-Installer([string]$File, [string]$Arguments) {
    $info = [System.Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $File
    $info.Arguments = $Arguments
    $info.UseShellExecute = $false
    $info.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
    $process = [System.Diagnostics.Process]::Start($info)
    if (-not $process.WaitForExit(60000)) { throw 'Installer exceeded test timeout' }
    if ($process.ExitCode -ne 0) { throw ('Installer failed with code ' + $process.ExitCode) }
}
function Get-ReleaseHash([string]$File) {
    $stream = [System.IO.File]::OpenRead($File)
    $algorithm = [System.Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($algorithm.ComputeHash($stream)) } finally { $algorithm.Dispose(); $stream.Dispose() }
}
Run-Installer $SetupPath ('/S /currentuser /D=' + $testDirectory)
try {
$executables = @(Get-ChildItem -LiteralPath $testDirectory -Filter 'MuanDesk.exe' -File -Recurse)
if ($executables.Count -ne 1) { throw 'Installed executable missing or ambiguous' }
$installedDirectory = $executables[0].DirectoryName
if (-not $installedDirectory.StartsWith($testDirectory, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Installed path escaped the test directory' }
$sourceAsar = Join-Path $root 'dist/MuanDesk-win32-x64/resources/app.asar'
$installedAsar = Join-Path $installedDirectory 'resources/app.asar'
if ((Get-ReleaseHash $sourceAsar) -ne (Get-ReleaseHash $installedAsar)) { throw 'Installed application differs from audited payload' }
foreach ($shortcut in $shortcuts) { if (-not (Test-Path -LiteralPath $shortcut)) { throw 'Setup did not create its shortcuts' } }
$registration = Get-ChildItem -LiteralPath $registryRoot | Get-ItemProperty | Where-Object { $_.DisplayName -eq 'MuanDesk' }
if (-not $registration) { throw 'Windows uninstall entry missing' }
Write-Output 'PASS: real setup installs the audited ASAR, Desktop/Start Menu shortcuts and Windows uninstall entry'
$launch = [System.Diagnostics.ProcessStartInfo]::new()
$launch.FileName = $executables[0].FullName
$launch.UseShellExecute = $false
$launched = [System.Diagnostics.Process]::Start($launch)
try {
    $opened = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 500
        $launched.Refresh()
        if ($launched.HasExited) { throw 'Installed application exited before opening a window' }
        if ($launched.MainWindowTitle -eq 'MuanDesk') { $opened = $true; break }
    }
    if (-not $opened) { throw 'Installed application did not open its main window' }
    Write-Output 'PASS: installed executable opens the MuanDesk window'
} finally {
    foreach ($process in [System.Diagnostics.Process]::GetProcessesByName('MuanDesk')) {
        try { if ($process.MainModule.FileName -eq $executables[0].FullName) { $process.Kill() } } catch [System.ComponentModel.Win32Exception] {} catch [System.InvalidOperationException] {}
    }
}
$uninstaller = Join-Path $installedDirectory 'Uninstall MuanDesk.exe'
if (-not (Test-Path -LiteralPath $uninstaller)) { throw 'Uninstaller missing' }
} finally {
    $uninstallers = @(Get-ChildItem -LiteralPath $testDirectory -Filter 'Uninstall MuanDesk.exe' -File -Recurse -ErrorAction SilentlyContinue)
    if ($uninstallers.Count -eq 1) {
        $cleanupDirectory = [System.IO.Path]::GetFullPath($uninstallers[0].DirectoryName)
        if (-not $cleanupDirectory.StartsWith($testDirectory, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe test uninstall target' }
        Run-Installer $uninstallers[0].FullName ('/S _?=' + $cleanupDirectory)
    }
}
if (Test-Path -LiteralPath (Join-Path $installedDirectory 'MuanDesk.exe')) { throw 'Uninstall did not remove the application' }
foreach ($shortcut in $shortcuts) { if (Test-Path -LiteralPath $shortcut) { throw 'Uninstall did not remove its shortcuts' } }
$registration = Get-ChildItem -LiteralPath $registryRoot | Get-ItemProperty | Where-Object { $_.DisplayName -eq 'MuanDesk' }
if ($registration) { throw 'Uninstall entry was not removed' }
Write-Output 'PASS: real uninstaller removes app, shortcuts and registration from the isolated test installation'

