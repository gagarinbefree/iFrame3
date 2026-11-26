param(
    [Parameter(Mandatory = $true)][string]$Device,
    [string]$Suite = 'D:\windows\libimobile-suite-latest_w64'
)
$ErrorActionPreference = 'Stop'
$python = (Get-Command python.exe).Source
$worker = Join-Path $PSScriptRoot 'update.py'
$arguments = '"{0}" --device "{1}" --suite "{2}"' -f $worker, $Device, $Suite
$action = New-ScheduledTaskAction -Execute $python -Argument $arguments
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 4) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$user = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'iFrame3 USB update' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
