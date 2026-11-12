# SPDX-License-Identifier: GPL-3.0-only
param([Parameter(Mandatory=$true)][string]$Source, [Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$sourcePath = (Resolve-Path -LiteralPath $Source).Path
$destinationPath = [System.IO.Path]::GetFullPath($Destination)
if (Test-Path -LiteralPath $destinationPath) { throw 'Archive already exists. Use a new version or remove that exact archive first.' }
$archive = [System.IO.Compression.ZipFile]::Open($destinationPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    $prefix = [System.IO.Path]::GetFileName($sourcePath.TrimEnd('\', '/')) + '/'
    foreach ($file in [System.IO.Directory]::GetFiles($sourcePath, '*', [System.IO.SearchOption]::AllDirectories)) {
        $relative = $file.Substring($sourcePath.TrimEnd('\', '/').Length + 1).Replace('\', '/')
        [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file, $prefix + $relative, [System.IO.Compression.CompressionLevel]::Optimal)
    }
} finally { $archive.Dispose() }

