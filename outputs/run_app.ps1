$Python = "C:\Users\Vaishnavi Nautiyal\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
$AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $AppDir
& $Python app.py
