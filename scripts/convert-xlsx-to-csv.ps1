# Define paths for input and output files 
$inputFile = "input-file"
$outputFile = "output-file"

# Resolve the full path for the input file
$inputFileFullPath = (Resolve-Path $inputFile).Path

# Create an instance of Excel
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false 

# Open the Excel file
$workbook = $excel.Workbooks.Open($inputFileFullPath)

# Save the workbook as a CSV file 
$workbook.SaveAs((Get-Item $outputFile).FullName, [Microsoft.Office.Interop.Excel.XlFileFormat]::xlCSV)

# Close the workbook 
$workbook.Close($false)

# Quit Excel
$excel.Quit() 

# Release COM objects
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($workbook) | Out-Null 
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null

# Clean up
Remove-Variable excel, workbook
[GC]::Collect()
[GC]::WaitForPendingFinalizers()