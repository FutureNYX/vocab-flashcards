# words.csv is the single source of truth. Run this after editing it.
$src  = Join-Path $PSScriptRoot 'words.csv'
$dest = Join-Path $PSScriptRoot 'words.js'

$rows = Import-Csv -Path $src -Encoding UTF8
$json = $rows | Select-Object word, part_of_speech, definition, russian_definition,
                              english_synonyms, russian_synonyms, example |
        ConvertTo-Json -Depth 3

# no BOM: some static hosts serve it literally and it breaks the parse
[System.IO.File]::WriteAllText($dest, "window.WORDS = $json;`r`n", (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Wrote $($rows.Count) words to words.js"
