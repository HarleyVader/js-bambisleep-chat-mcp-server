# 🤖 BambiSleep Multi-Agent Build Script
# Builds all agents in the /agent folder for deployment

Write-Host "🚀 Building BambiSleep Agents..." -ForegroundColor Cyan

$agentFolder = Join-Path $PSScriptRoot "..\agent"
$builtAgents = 0
$failedAgents = @()

if (!(Test-Path $agentFolder)) {
    Write-Host "❌ Agent folder not found: $agentFolder" -ForegroundColor Red
    exit 1
}

Write-Host "📁 Scanning for agents in: $agentFolder" -ForegroundColor Yellow

# Find all agent directories
$agentDirs = Get-ChildItem -Path $agentFolder -Directory | Where-Object { $_.Name -like "js-bambisleep-chat-agent-*" }

if ($agentDirs.Count -eq 0) {
    Write-Host "⚠️ No agents found matching pattern 'js-bambisleep-chat-agent-*'" -ForegroundColor Yellow
    exit 0
}

foreach ($agentDir in $agentDirs) {
    $agentName = $agentDir.Name
    $packageJsonPath = Join-Path $agentDir.FullName "package.json"
    
    Write-Host "`n🤖 Processing agent: $agentName" -ForegroundColor Green
    
    if (!(Test-Path $packageJsonPath)) {
        Write-Host "  ⚠️ No package.json found, skipping..." -ForegroundColor Yellow
        continue
    }
    
    try {
        # Read package.json to get agent info
        $packageJson = Get-Content $packageJsonPath | ConvertFrom-Json
        $agentVersion = $packageJson.version
        Write-Host "  📦 Version: $agentVersion"
        
        # Change to agent directory
        Push-Location $agentDir.FullName
        
        Write-Host "  🔧 Installing dependencies..."
        npm install --silent
        
        if ($LASTEXITCODE -ne 0) {
            throw "npm install failed"
        }
        
        Write-Host "  🏗️ Building agent..."
        npm run build --silent
        
        if ($LASTEXITCODE -ne 0) {
            throw "npm run build failed"
        }
        
        # Check if dist folder was created
        $distPath = Join-Path $agentDir.FullName "dist"
        if (Test-Path $distPath) {
            $distFiles = Get-ChildItem $distPath | Measure-Object
            Write-Host "  ✅ Build successful! Generated $($distFiles.Count) files in dist/" -ForegroundColor Green
            $builtAgents++
        } else {
            throw "Build completed but no dist folder found"
        }
        
    } catch {
        Write-Host "  ❌ Build failed: $($_.Exception.Message)" -ForegroundColor Red
        $failedAgents += $agentName
    } finally {
        Pop-Location
    }
}

Write-Host "`n📊 Build Summary:" -ForegroundColor Cyan
Write-Host "  ✅ Successfully built: $builtAgents agents" -ForegroundColor Green

if ($failedAgents.Count -gt 0) {
    Write-Host "  ❌ Failed builds: $($failedAgents.Count) agents" -ForegroundColor Red
    foreach ($failed in $failedAgents) {
        Write-Host "    - $failed" -ForegroundColor Red
    }
}

Write-Host "`n🚀 Build process completed!" -ForegroundColor Cyan

if ($failedAgents.Count -gt 0) {
    exit 1
} else {
    exit 0
}
