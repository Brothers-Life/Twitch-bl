# Compile hub/media/bl-media.exe (lecteur de la musique en cours) avec le csc.exe fourni avec Windows.
#   python outils/build_media.py
import glob, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WIN = os.environ.get("WINDIR", r"C:\Windows")
FW = os.path.join(WIN, "Microsoft.NET", "Framework64", "v4.0.30319")
META = os.path.join(WIN, "System32", "WinMetadata")
# façades .NET (System.Runtime…) nécessaires pour utiliser les API Windows Runtime depuis le C# du Framework
facades = sorted(glob.glob(os.path.join(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)"),
                                        r"Reference Assemblies\Microsoft\Framework\.NETFramework\v4.*\Facades")))
refs = [os.path.join(META, f) for f in ("Windows.Media.winmd", "Windows.Foundation.winmd", "Windows.Storage.winmd")]
if facades:
    refs += [os.path.join(facades[-1], f) for f in ("System.Runtime.dll", "System.Threading.Tasks.dll")]
else:
    refs.append(os.path.join(FW, "System.Runtime.dll"))
out = os.path.join(ROOT, "hub", "media", "bl-media.exe")
cmd = [os.path.join(FW, "csc.exe"), "-nologo", "-target:exe", "-platform:x64", "-codepage:65001", "-optimize", "-out:" + out]
cmd += ["-r:" + r for r in refs] + [os.path.join(ROOT, "hub", "media", "bl-media.cs")]
sys.exit(subprocess.run(cmd).returncode)
