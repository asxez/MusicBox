const {spawnSync} = require('child_process');

function firstNonEmptyLine(value) {
    return String(value || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .find(Boolean) || '';
}

function runPowerShell(command, timeout = 5000) {
    const result = spawnSync('powershell', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        command
    ], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout
    });

    if (result.status !== 0) return '';
    return firstNonEmptyLine(result.stdout);
}

function detectDefaultAudioRenderEndpoint() {
    const script = `
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
[Windows.Media.Devices.MediaDevice,Windows.Media.Devices,ContentType=WindowsRuntime] | Out-Null
$id = [Windows.Media.Devices.MediaDevice]::GetDefaultAudioRenderId([Windows.Media.Devices.AudioDeviceRole]::Default)
if (-not $id) { exit 0 }
$match = [regex]::Match($id, '\\{[0-9a-fA-F-]{36}\\}')
$endpointGuid = if ($match.Success) { $match.Value } else { '' }
if ($endpointGuid) {
    $propertiesPath = "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Render\\$endpointGuid\\Properties"
    $props = Get-ItemProperty -Path $propertiesPath
    $endpointName = $props.'{a45c254e-df1c-4efd-8020-67d146a850e0},14'
    if (-not $endpointName) { $endpointName = $props.'{a45c254e-df1c-4efd-8020-67d146a850e0},2' }
    $deviceName = $props.'{b3f8fa53-0004-438e-9003-51a46e139bfc},6'
    if ($endpointName -and $deviceName) {
        "$endpointName ($deviceName)"
    } elseif ($endpointName) {
        "$endpointName"
    } elseif ($deviceName) {
        "$deviceName"
    } else {
        "$id"
    }
} else {
    "$id"
}
`;

    return runPowerShell(script);
}

function detectFirstOkSoundDevice() {
    return runPowerShell(
        'Get-CimInstance -ClassName Win32_SoundDevice | Where-Object {$_.Status -eq "OK"} | Select-Object -First 1 -ExpandProperty Name'
    );
}

function detectAudioDeviceName() {
    if (process.platform !== 'win32') return process.platform;
    return detectDefaultAudioRenderEndpoint()
        || detectFirstOkSoundDevice()
        || 'unknown-device';
}

module.exports = {
    detectAudioDeviceName
};
