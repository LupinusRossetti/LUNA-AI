param([string]$TitlePattern)

Add-Type @"
    using System;
    using System.Runtime.InteropServices;
    public class Win32 {
        [DllImport("user32.dll")]
        public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
        [DllImport("user32.dll")]
        public static extern bool SetForegroundWindow(IntPtr hWnd);
    }
"@

$maximized = 3
$retryCount = 20
$found = $false

Write-Host "Waiting for window with title like '*$TitlePattern*'..."

for ($i = 0; $i -lt $retryCount; $i++) {
    $processes = Get-Process | Where-Object { $_.MainWindowTitle -like "*$TitlePattern*" }
    
    if ($processes) {
        foreach ($p in $processes) {
            [Win32]::ShowWindow($p.MainWindowHandle, $maximized)
            [Win32]::SetForegroundWindow($p.MainWindowHandle)
            Write-Host "Maximized window: $($p.MainWindowTitle)"
        }
        $found = $true
        # Don't break immediately, keep checking for a bit in case multiple windows open slowly
        if ($i -gt 5) { break } 
    }
    Start-Sleep -Seconds 1
}

if (-not $found) {
    Write-Host "Window with title pattern '$TitlePattern' not found."
}
