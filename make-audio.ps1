# Pre-render every headword to an MP3 so the app never has to rely on the
# phone's own speech engine, which on iOS is a compact voice that sounds
# robotic unless the user goes and downloads a better one in Settings.
#
# Needs Piper (https://github.com/rhasspy/piper/releases) and ffmpeg on PATH.
#
#   powershell -File make-audio.ps1 -Piper C:\tools\piper\piper.exe `
#                                   -Model C:\tools\voices\en_GB-jenny_dioco-medium.onnx
#
# Only missing clips are rendered; pass -Force to redo the lot after a voice
# change. Clip filenames are slugs of the word, so words.csv stays the source
# of truth and a renamed entry simply gets a new clip.
param(
  [string]$Piper = 'C:\tools\piper\piper.exe',
  [string]$Model = 'C:\tools\voices\en_GB-jenny_dioco-medium.onnx',
  [switch]$Force
)
$ErrorActionPreference = 'Continue'
$root  = Split-Path -Parent $MyInvocation.MyCommand.Path
$outDir = Join-Path $root 'audio'
$tmp    = Join-Path $env:TEMP 'vocab-audio-tmp.wav'
if(-not (Test-Path $outDir)){ New-Item -ItemType Directory -Path $outDir | Out-Null }
foreach($p in $Piper, $Model){ if(-not (Test-Path $p)){ throw "not found: $p" } }

function Slug([string]$s){
  $x = $s.ToLower() -replace '[^a-z0-9]+', '-'
  return $x.Trim('-')
}

$rows = Import-Csv (Join-Path $root 'words.csv') -Encoding UTF8
$made = 0; $skipped = 0; $failed = @()
foreach($r in $rows){
  $slug = Slug $r.word
  $mp3  = Join-Path $outDir "$slug.mp3"
  if((Test-Path $mp3) -and -not $Force){ $skipped++; continue }
  Remove-Item $tmp -Force -ErrorAction SilentlyContinue
  # Piper reads the line from stdin. A trailing full stop stops the voice
  # rising as though the word were a question.
  ($r.word + '.') | & $Piper -m $Model -f $tmp 2>$null | Out-Null
  if(Test-Path $tmp){
    # mono 22.05k VBR: a single word lands around 8 KB
    ffmpeg -y -loglevel error -i $tmp -ac 1 -codec:a libmp3lame -q:a 6 $mp3 2>$null
  }
  if(Test-Path $mp3){ $made++ } else { $failed += $r.word }
}
Remove-Item $tmp -Force -ErrorAction SilentlyContinue

# The service worker cannot list a directory, so hand it the list.
$names = (Get-ChildItem $outDir -Filter *.mp3 | Sort-Object Name | ForEach-Object { $_.Name })
$manifest = @{ clips = $names } | ConvertTo-Json -Compress
[IO.File]::WriteAllText((Join-Path $root 'audio-manifest.json'), $manifest, (New-Object Text.UTF8Encoding($false)))

$size = (Get-ChildItem $outDir -Filter *.mp3 | Measure-Object -Property Length -Sum).Sum
"rendered $made, kept $skipped, total $((Get-ChildItem $outDir -Filter *.mp3).Count) clips, $([math]::Round($size/1MB,2)) MB"
if($failed.Count){ "FAILED: " + ($failed -join ', ') }

# Anything in audio/ with no matching row is left over from a deleted word.
$live = @{}; $rows | ForEach-Object { $live[(Slug $_.word)] = $true }
$orphans = Get-ChildItem $outDir -Filter *.mp3 | Where-Object { -not $live[$_.BaseName] }
if($orphans){ "orphans (delete by hand if the word is gone for good): " + (($orphans | ForEach-Object { $_.Name }) -join ', ') }
