# PowerShell script to fix the re-render loop
# Run this script to apply all necessary fixes to useDataProvider.ts

$filePath = "client\src\components\widgets\blotters\simpleblotter\hooks\useDataProvider.ts"

Write-Host "Applying re-render loop fix to $filePath..." -ForegroundColor Yellow

# Read the file
$content = Get-Content $filePath -Raw

# Fix 1: Line 67 - Remove gridApi and onRowCount from snapshot handler dependencies
$content = $content -replace '  }, \[adapter, gridApi, onRowCount\]\);', '  }, [adapter]); // gridApi captured in closure'

# Fix 2: Line 91 - Remove gridApi from update handler dependencies
$content = $content -replace '  }, \[adapter, gridApi\]\);', '  }, [adapter]); // gridApi captured in closure'

# Fix 3: Line 134 - Add onRowCount, keep onLoading
$content = $content -replace '  }, \[adapter, onLoading\]\);(\s+// ============================================================================\s+// Error Handler)', '  }, [adapter, onLoading, onRowCount]); // gridApi captured in closure$1'

# Fix 4: Line 236 - Remove gridApi from auto-connect dependencies
$content = $content -replace '  }, \[providerId, gridApi, adapter\.isConfigLoaded\]\);', '  }, [providerId, adapter.isConfigLoaded]); // gridApi captured in closure'

# Write back
Set-Content $filePath -Value $content -NoNewline

Write-Host "✓ Fix applied successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Changes made:" -ForegroundColor Cyan
Write-Host "1. Removed 'gridApi' and 'onRowCount' from snapshot handler dependencies" -ForegroundColor White
Write-Host "2. Removed 'gridApi' from update handler dependencies" -ForegroundColor White
Write-Host "3. Added 'onRowCount' to snapshot complete handler dependencies" -ForegroundColor White
Write-Host "4. Removed 'gridApi' from auto-connect dependencies" -ForegroundColor White
Write-Host ""
Write-Host "The re-render loop should now be fixed!" -ForegroundColor Green
