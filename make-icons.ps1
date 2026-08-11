# Rasterise icon-src.html into the PNGs iOS and Android ask for.
# Run after changing the icon artwork:  powershell -File make-icons.ps1
# Chrome writes its "bytes written" line to stderr, which a Stop preference
# would treat as fatal after the first icon.
$ErrorActionPreference = 'Continue'
$root   = Split-Path -Parent $MyInvocation.MyCommand.Path
$icons  = Join-Path $root 'icons'
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if(-not (Test-Path $chrome)){ $chrome = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe' }
if(-not (Test-Path $icons)){ New-Item -ItemType Directory -Path $icons | Out-Null }

$src  = 'file:///' + ($root -replace '\\','/') + '/icon-src.html'
$prof = Join-Path $env:TEMP 'vocab-icon-chrome'

# 512 is the artboard size, so each target is a device-scale multiple of it.
foreach($size in 180, 192, 512){
  $out   = Join-Path $icons "icon-$size.png"
  $scale = [math]::Round($size / 512, 4)
  & $chrome --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$prof" `
    --allow-file-access-from-files --virtual-time-budget=4000 `
    --force-device-scale-factor=$scale --window-size=512,512 `
    --screenshot="$out" $src 2>$null | Out-Null
  if(Test-Path $out){
    Add-Type -AssemblyName System.Drawing
    $img = [Drawing.Image]::FromFile($out)
    "icon-$size.png  $($img.Width)x$($img.Height)"
    $img.Dispose()
  } else { "icon-$size.png FAILED" }
}
