# SPDX-License-Identifier: GPL-3.0-only
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assetDirectory = Join-Path $PSScriptRoot '../assets'
$sourceImage = [System.Drawing.Bitmap]::new((Join-Path $assetDirectory 'icon.png'))
$sizes = @(16, 24, 32, 48, 64, 96, 128, 144, 256)
$frames = @()
try {
    foreach ($size in $sizes) {
        $bitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $memory = [System.IO.MemoryStream]::new()
        try {
            $graphics.Clear([System.Drawing.Color]::Transparent)
            $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $graphics.DrawImage($sourceImage, 0, 0, $size, $size)
            $bitmap.Save($memory, [System.Drawing.Imaging.ImageFormat]::Png)
            $frames += ,$memory.ToArray()
        } finally {
            $memory.Dispose()
            $graphics.Dispose()
            $bitmap.Dispose()
        }
    }
    $file = [System.IO.File]::Create((Join-Path $assetDirectory 'icon.ico'))
    $writer = [System.IO.BinaryWriter]::new($file)
    try {
        $writer.Write([uint16]0)
        $writer.Write([uint16]1)
        $writer.Write([uint16]$frames.Count)
        $offset = 6 + 16 * $frames.Count
        for ($index = 0; $index -lt $frames.Count; $index++) {
            $dimension = if ($sizes[$index] -eq 256) { 0 } else { $sizes[$index] }
            $writer.Write([byte]$dimension)
            $writer.Write([byte]$dimension)
            $writer.Write([byte]0)
            $writer.Write([byte]0)
            $writer.Write([uint16]1)
            $writer.Write([uint16]32)
            $writer.Write([uint32]$frames[$index].Length)
            $writer.Write([uint32]$offset)
            $offset += $frames[$index].Length
        }
        foreach ($frame in $frames) { $writer.Write([byte[]]$frame) }
    } finally { $writer.Dispose() }
} finally { $sourceImage.Dispose() }
Write-Output 'Built transparent Windows icon at 16, 24, 32, 48, 64, 96, 128, 144 and 256 pixels.'

