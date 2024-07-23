param (
    [string]$Source,
    [string]$Destination
)

$copiedFilesCount = 0
$copiedBytes = 0
$totalBytes = 0

# Start robocopy
robocopy $Source $Destination /E /NDL /NJH /NJS /BYTES | ForEach-Object {
    $line = $_
    # Match lines that contain file copy information
    if ($line -match '^\s*(\d+)\s+(\d+)\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+(\d+)') {
        $copiedFilesCount = [int]$matches[1]
        $copiedBytes = [int]$matches[2]
        $totalBytes = [int]$matches[3]

        # Update progress
        Write-Progress -Activity "Robocopy" -Status "Copied $($copiedFilesCount.ToString('N0')) files ($(($copiedBytes / 1MB).ToString('N2')) MB)" -CurrentOperation "$($copiedFilesCount) files copied"
    }
    elseif ($line -match '^\s*Bytes:\s*(\d+)\s+(\d+)') {
        $copiedBytes = [int]$matches[1]
        $totalBytes = [int]$matches[2]
        
        Write-Progress -Activity "Robocopy" -Status "Copied $(($copiedBytes / 1MB).ToString('N2')) MB of $(($totalBytes / 1MB).ToString('N2')) MB" -PercentComplete ($copiedBytes / $totalBytes * 100)
    }
    else {
        Write-Output $_
    }
}

Write-Progress -Activity "Robocopy" -Completed
