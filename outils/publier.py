# Publie une nouvelle version de BL Studio sur GitHub : l'installeur et les mises à jour automatiques la récupèrent.
#   python outils/publier.py 1.1.0 "Nouveautés : …"        (ajoute --local pour seulement construire le zip)
# Le zip contient le code suivi par git + hub/node_modules + les transitions sans marque (../BL-Studio-build/transitions)
# + le logo par défaut. Les données perso (hub/data, logo.png, branding/) n'y sont jamais.
import json, os, re, subprocess, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(os.path.dirname(ROOT), "BL-Studio-build")
args = [a for a in sys.argv[1:] if a != "--local"]
LOCAL = "--local" in sys.argv
if not args or not re.fullmatch(r"\d+\.\d+\.\d+", args[0]):
    sys.exit('usage : python outils/publier.py 1.2.3 "notes de version" [--local]')
version, notes = args[0], (args[1] if len(args) > 1 else f"BL Studio {args[0]}")
run = lambda *c: subprocess.run(c, cwd=ROOT, check=True, capture_output=True, text=True, encoding="utf-8").stdout

json.dump({"version": version}, open(os.path.join(ROOT, "version.json"), "w", encoding="utf-8"), indent=2)
subprocess.run([sys.executable, os.path.join(ROOT, "outils", "build_app.py")], check=True)
subprocess.run([sys.executable, os.path.join(ROOT, "outils", "build_media.py")], check=True)   # lecteur de musique (hub/media/bl-media.exe)

files = [f for f in run("git", "ls-files", "--cached", "--others", "--exclude-standard").splitlines() if os.path.isfile(os.path.join(ROOT, f))]
os.makedirs(BUILD, exist_ok=True)
out = os.path.join(BUILD, f"bl-studio-{version}.zip")
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for f in files:
        z.write(os.path.join(ROOT, f), f)
    for base, rel in ((os.path.join(ROOT, "hub", "node_modules"), "hub/node_modules"), (os.path.join(BUILD, "transitions"), "transitions")):
        for d, _, fs in os.walk(base):
            for name in fs:
                p = os.path.join(d, name)
                z.write(p, rel + "/" + os.path.relpath(p, base).replace("\\", "/"))
    z.write(os.path.join(ROOT, "assets", "logo-defaut.png"), "logo.png")
    z.write(os.path.join(ROOT, "hub", "media", "bl-media.exe"), "hub/media/bl-media.exe")

# garde-fous : aucune donnée perso ni aucun jeton dans le zip
names = zipfile.ZipFile(out).namelist()
assert not any(n.startswith(("hub/data/", "branding/")) for n in names), "données perso dans le zip"
secrets = []
try:
    cfg = json.load(open(os.path.join(ROOT, "hub", "data", "config.json"), encoding="utf-8"))
    secrets = [v for v in (cfg.get("twitch", {}).get("token"), cfg.get("streamelements", {}).get("jwt")) if v and len(v) > 8]
except Exception:
    pass
with zipfile.ZipFile(out) as z:
    for n in names:
        if n.startswith("hub/node_modules/") or not n.endswith((".js", ".html", ".json", ".py", ".lua", ".ps1", ".css", ".md")):
            continue
        txt = z.read(n).decode("utf-8", "ignore")
        assert not any(s in txt for s in secrets), f"jeton trouvé dans {n}"
print(f"zip prêt : {out} ({os.path.getsize(out) // 1048576} Mo, {len(names)} fichiers)")

# installeur Windows : compilé avec le csc.exe fourni avec Windows
FW = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Microsoft.NET", "Framework64", "v4.0.30319")
exe = os.path.join(BUILD, "BL-Studio-Setup.exe")
subprocess.run([os.path.join(FW, "csc.exe"), "-nologo", "-target:winexe", "-platform:x64", "-codepage:65001", "-optimize",
                "-win32icon:" + os.path.join(ROOT, "assets", "bl-studio.ico"),
                "-r:" + os.path.join(FW, "System.IO.Compression.dll"), "-r:" + os.path.join(FW, "System.IO.Compression.FileSystem.dll"),
                "-r:System.Windows.Forms.dll", "-r:System.Drawing.dll", "-out:" + exe, os.path.join(ROOT, "installer", "Setup.cs")], check=True)
print(f"installeur prêt : {exe}")
if LOCAL:
    sys.exit(0)

run("git", "add", "-A")
if run("git", "status", "--porcelain").strip():
    run("git", "commit", "-m", f"BL Studio {version}")
run("git", "tag", f"v{version}")
run("git", "push", "origin", "HEAD", "--tags")
run("gh", "release", "create", f"v{version}", exe, out, os.path.join(ROOT, "installer", "install.ps1"), "--title", f"BL Studio {version}", "--notes", notes)
print(f"Version {version} publiée : les installations BL Studio la récupéreront toutes seules.")
