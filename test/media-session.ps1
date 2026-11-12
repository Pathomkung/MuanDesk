# SPDX-License-Identifier: GPL-3.0-only
param([string]$Action = 'inspect', [string]$ExpectedTitle = 'YT Music integration test', [string]$Source = '')
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime]
function Await-Operation($Operation, $ResultType) {
    $method = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
    $task = $method.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
    if (-not $task.Wait(10000)) { throw 'Windows media operation timed out' }
    return $task.Result
}
$manager = Await-Operation ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
foreach ($session in $manager.GetSessions()) {
    if ($Source -and $session.SourceAppUserModelId -ne $Source) { continue }
    $properties = Await-Operation ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
    if ($ExpectedTitle -ne '*' -and $properties.Title -ne $ExpectedTitle) { continue }
    $result = $true
    switch ($Action) {
        'pause' { $result = Await-Operation ($session.TryPauseAsync()) ([bool]) }
        'play' { $result = Await-Operation ($session.TryPlayAsync()) ([bool]) }
        'next' { $result = Await-Operation ($session.TrySkipNextAsync()) ([bool]) }
        'previous' { $result = Await-Operation ($session.TrySkipPreviousAsync()) ([bool]) }
    }
    @{ title = $properties.Title; artist = $properties.Artist; status = $session.GetPlaybackInfo().PlaybackStatus.ToString(); result = $result; source = $session.SourceAppUserModelId } | ConvertTo-Json -Compress
    exit 0
}
throw 'Test session missing from Windows media controls'

