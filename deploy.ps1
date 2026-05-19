# deploy.ps1
Write-Host "🔨 Building..." -ForegroundColor Cyan
npm run build

Write-Host "⚙️ Adding nodejs_compat flag..." -ForegroundColor Cyan
$w = Get-Content "dist/client/wrangler.json" | ConvertFrom-Json
$w.compatibility_flags = @("nodejs_compat")
$w | ConvertTo-Json -Depth 10 | Set-Content "dist/client/wrangler.json"

Write-Host "🚀 Deploying to Cloudflare..." -ForegroundColor Cyan
npx wrangler deploy --config dist/client/wrangler.json --script dist/server/server.js

Write-Host "✅ Deploy concluído!" -ForegroundColor Green