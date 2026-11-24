# Lance l'Agent Local Windows pour OpenClaudeDesktop
param(
  [string]$Root = (Get-Location).Path,
  [int]$Port = 4789
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js 18+ est requis. Installez Node.js depuis https://nodejs.org/"
  exit 1
}

if (-not $env:LOCAL_AGENT_TOKEN) {
  $bytes = New-Object byte[] 24
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $env:LOCAL_AGENT_TOKEN = ([BitConverter]::ToString($bytes) -replace '-', '').ToLower()
}

$env:LOCAL_AGENT_ROOT = $Root
$env:LOCAL_AGENT_PORT = "$Port"

Write-Host "Démarrage de l'agent local Windows sur http://127.0.0.1:$Port ..." -ForegroundColor Cyan
node "$PSScriptRoot\windows-agent.mjs"
