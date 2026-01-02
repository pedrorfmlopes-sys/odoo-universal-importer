
$dest = "server/backups/v1_pre_rich_extraction"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item "server/src/modules/catalogEnricher/services/ceEnrichmentService.ts" -Destination $dest
Copy-Item "server/src/modules/catalogEnricher/services/ceCrawlerService.ts" -Destination $dest
Copy-Item "server/src/modules/catalogEnricher/db/ceDatabase.ts" -Destination $dest
Copy-Item "client/src/modules/catalogEnricher/pages/CeJobReportPage.tsx" -Destination $dest
Write-Host "Backup Complete to $dest"
