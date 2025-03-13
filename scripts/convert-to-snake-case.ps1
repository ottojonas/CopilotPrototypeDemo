$directoryPath="../demo_data/example-quotes/"

function To-SnakeCase {
    param (
        [string]$str
    )
    return $str -replace '\s+', '_' -replace '[A-Z]', { $_.ToLower() }
}

$files = Get-ChildItem -Path $directoryPath

foreach ($file in $files) {
    $oldPath = $file.FullName
    $newName = To-SnakeCase -str $file.Name 
    $newPath = Join-Path -Path $directoryPath -ChildPath $newName

    Rename-Item -Path $oldPath -NewName $newPath 
    Write-Host "Renamed: ($file.Name)  -> $newName"
}


