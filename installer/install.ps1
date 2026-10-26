# Installeur BL Studio : installe ce qui manque (OBS, plugins Aitum, Node.js, Python + ffmpeg),
# télécharge la dernière version de BL Studio depuis GitHub et configure OBS (scènes, dock, multistream).
# Relançable sans risque : il met à jour BL Studio et ne touche ni aux réglages ni aux scènes déjà créées.
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Repo = "Brothers-Life/Twitch-bl"
$Dest = Join-Path $env:USERPROFILE "BLStudio"
$ObsExe = Join-Path $env:ProgramFiles "obs-studio\bin\64bit\obs64.exe"
$Tmp = Join-Path $env:TEMP ("bl-studio-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
New-Item -ItemType Directory -Force $Tmp | Out-Null

function Step($t) { Write-Host ""; Write-Host "==> $t" -ForegroundColor Yellow }
function Ok($t) { Write-Host "    $t" -ForegroundColor Green }
function Refresh-Path { $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User") }
function Has($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
function Winget-Install($id, $label) {
  Write-Host "    Installation de $label (une fenêtre Windows peut demander l'autorisation)…"
  winget install --id $id -e --silent --accept-package-agreements --accept-source-agreements --disable-interactivity | Out-Null
  Refresh-Path
}
function Latest-Asset($repo, $pattern) {
  $rel = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest" -Headers @{ "User-Agent" = "BL-Studio-Installer" }
  $asset = $rel.assets | Where-Object { $_.name -like $pattern } | Select-Object -First 1
  if (-not $asset) { throw "Fichier $pattern introuvable dans la dernière version de $repo" }
  return @{ url = $asset.browser_download_url; name = $asset.name; tag = $rel.tag_name }
}

Write-Host ""
Write-Host "  BL Studio : installation" -ForegroundColor Cyan
Write-Host "  Overlays, alertes, bot, chat unifié, mini-jeux, multistream Twitch / TikTok / YouTube"
Write-Host ""

if (-not (Has "winget")) {
  Write-Host "winget est introuvable. Installe « Programme d'installation d'application » depuis le Microsoft Store, puis relance." -ForegroundColor Red
  exit 1
}

# ---------- 1. Logiciels nécessaires ----------
Step "Logiciels nécessaires"
if (Test-Path $ObsExe) { Ok "OBS Studio déjà installé" } else { Winget-Install "OBSProject.OBSStudio" "OBS Studio" }
if ((Has "node") -or (Test-Path "$env:ProgramFiles\nodejs\node.exe")) { Ok "Node.js déjà installé" } else { Winget-Install "OpenJS.NodeJS.LTS" "Node.js" }
if (Has "py") { Ok "Python déjà installé" } else { Winget-Install "Python.Python.3.12" "Python" }
if (Has "ffmpeg") { Ok "ffmpeg déjà installé" } else { Winget-Install "Gyan.FFmpeg" "ffmpeg" }
if (-not (Test-Path $ObsExe)) { throw "OBS Studio n'a pas pu être installé." }
if (-not (Has "py")) { throw "Python n'a pas pu être installé." }
Write-Host "    Module Pillow pour Python (génération des transitions)…"
& py -3 -m pip install --user --quiet --disable-pip-version-check pillow 2>$null | Out-Null
Ok "Logiciels prêts"

# ---------- 2. OBS doit être fermé ----------
$obs = Get-Process obs64 -ErrorAction SilentlyContinue
if ($obs) {
  Step "Fermeture d'OBS"
  Read-Host "    OBS est ouvert : il va être fermé pour être configuré. Appuie sur Entrée pour continuer"
  $obs | ForEach-Object { $null = $_.CloseMainWindow() }
  Start-Sleep 5
  Get-Process obs64 -ErrorAction SilentlyContinue | Stop-Process -Force
  Ok "OBS fermé"
}

# ---------- 3. Plugins Aitum (canevas vertical TikTok + multistream) ----------
Step "Plugins OBS Aitum Vertical et Aitum Multistream"
$userPlugins = Join-Path $env:APPDATA "obs-studio\plugins"
New-Item -ItemType Directory -Force $userPlugins | Out-Null
foreach ($p in @(@{ repo = "Aitum/obs-vertical-canvas"; dir = "vertical-canvas" }, @{ repo = "Aitum/obs-aitum-multistream"; dir = "aitum-multistream" })) {
  $global = Join-Path $env:ProgramData "obs-studio\plugins\$($p.dir)"
  if (Test-Path $global) { Ok "$($p.dir) déjà installé"; continue }
  $a = Latest-Asset $p.repo "*windows-programdata.zip"
  $zip = Join-Path $Tmp $a.name
  Invoke-WebRequest $a.url -OutFile $zip -UseBasicParsing
  Expand-Archive -LiteralPath $zip -DestinationPath $userPlugins -Force
  Ok "$($p.dir) $($a.tag) installé"
}

# ---------- 4. BL Studio ----------
Step "Téléchargement de BL Studio"
$a = Latest-Asset $Repo "bl-studio*.zip"
$zip = Join-Path $Tmp $a.name
Invoke-WebRequest $a.url -OutFile $zip -UseBasicParsing
$unz = Join-Path $Tmp "bl"
Expand-Archive -LiteralPath $zip -DestinationPath $unz -Force
New-Item -ItemType Directory -Force $Dest | Out-Null
# réglages, jetons, points et logo perso déjà présents : conservés
$xf = @("nowplaying.js")
if (Test-Path (Join-Path $Dest "logo.png")) { $xf += "logo.png" }
robocopy $unz $Dest /E /NFL /NDL /NJH /NJS /NP /XD (Join-Path $unz "hub\data") (Join-Path $unz "transitions") /XF $xf | Out-Null
if ($LASTEXITCODE -ge 8) { throw "Copie de BL Studio impossible (code $LASTEXITCODE)" }
# transitions : on ajoute seulement celles qui manquent (celles régénérées avec ton logo restent)
robocopy (Join-Path $unz "transitions") (Join-Path $Dest "transitions") /E /XC /XN /XO /NFL /NDL /NJH /NJS /NP | Out-Null
Ok "BL Studio $($a.tag) installé dans $Dest"

# ---------- 5. Configuration d'OBS ----------
Step "Configuration d'OBS (scènes, dock BL Studio, WebSocket, sorties TikTok et YouTube)"
& py -3 -I (Join-Path $Dest "setup\obs_setup.py") --root $Dest
if ($LASTEXITCODE -ne 0) { throw "La configuration d'OBS a échoué." }

# ---------- 6. Raccourcis ----------
Step "Raccourcis sur le bureau"
$desk = [Environment]::GetFolderPath("Desktop")
$sh = New-Object -ComObject WScript.Shell
$lnk = $sh.CreateShortcut((Join-Path $desk "BL Studio.lnk"))
$lnk.TargetPath = $ObsExe
$lnk.WorkingDirectory = Split-Path $ObsExe
$lnk.Arguments = '--collection "BL Studio" --profile "BL Studio"'
$lnk.IconLocation = "$ObsExe,0"
$lnk.Description = "OBS avec BL Studio"
$lnk.Save()
Set-Content -Path (Join-Path $desk "BL Studio (panneau).url") -Value "[InternetShortcut]`r`nURL=http://localhost:3939/" -Encoding ASCII
Ok "« BL Studio » et « BL Studio (panneau) » ajoutés au bureau"

Remove-Item $Tmp -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "  Installation terminée !" -ForegroundColor Green
Write-Host "  1. OBS s'ouvre avec la collection « BL Studio » et le dock BL Studio."
Write-Host "  2. Dans le dock : onglet Identité (logo, nom, réseaux) puis Connexions (Twitch, TikTok, YouTube)."
Write-Host "  3. Onglet Diffusion : colle ta clé TikTok ; la clé YouTube va dans le dock Aitum Multistream."
Write-Host "  4. OBS > Paramètres > Stream : connecte ton compte Twitch."
Write-Host "  Les mises à jour de BL Studio s'installent ensuite toutes seules (jamais pendant un live)."
Write-Host ""
Start-Process -FilePath $ObsExe -WorkingDirectory (Split-Path $ObsExe) -ArgumentList '--collection "BL Studio" --profile "BL Studio"'
