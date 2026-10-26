# Génère les transitions stinger (WebM VP9 avec transparence) : 6 styles, par thème et par format.
# Le BL Hub l'appelle à la demande quand on choisit un style dans l'appli BL Studio.
import os, random, re, shutil, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
THEMES_JS = os.path.join(ROOT, "theme.js")
# --out / --logo : dossier de sortie et logo (par défaut transitions/ et le logo de la chaîne)
_a = sys.argv
OUT = _a[_a.index("--out") + 1] if "--out" in _a else os.path.join(ROOT, "transitions")
LOGO = None if "--nologo" in _a else Image.open(_a[_a.index("--logo") + 1] if "--logo" in _a else os.path.join(ROOT, "logo.png")).convert("RGBA")
FONT = r"C:/Windows/Fonts/impact.ttf"
FPS, FRAMES = 60, 60          # 1 s ; écran entièrement couvert à 500 ms
os.makedirs(OUT, exist_ok=True)

themes = {}
for m in re.finditer(r'(\w+):\s*\{\s*label:[^}]*?c1:\s*"(#\w+)",\s*c2:\s*"(#\w+)",\s*c3:\s*"(#\w+)",\s*bg1:\s*"(#\w+)",\s*bg2:\s*"(#\w+)"', open(THEMES_JS, encoding="utf-8").read()):
    themes[m[1]] = [tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in m.groups()[1:]]

def ease(x):
    x = min(1, max(0, x))
    return x * x * (3 - 2 * x)

# Chaque style dessine sa « couverture » à l'instant t (0 → 1) : l'écran doit être entièrement couvert à t = 0.5.

def cover_bandes(d, t, W, H, colors, rnd):
    c1, c2, c3, bg1, bg2 = colors
    k = int(H * 0.45)                         # inclinaison des bandes
    span = W + k * 2
    # (couleur, retard entrée, retard sortie) : la bande sombre arrive en dernier et part en premier
    for color, din, dout in [(c2, 0.00, 0.12), (c3, 0.05, 0.08), (c1, 0.10, 0.04), (bg2, 0.15, 0.00)]:
        lead = -k + ease((t - din) / 0.35) * span        # bord avant
        trail = -k + ease((t - 0.5 - dout) / 0.35) * span  # bord arrière
        if lead > trail:
            d.polygon([(trail - k, H), (trail, 0), (lead, 0), (lead - k, H)], fill=color + (255,))

def cover_volets(d, t, W, H, colors, rnd):
    c1, c2, c3, bg1, bg2 = colors
    n = 8
    w = W / n
    edge = max(4, H // 90)
    for i in range(n):
        delay = i * 0.02
        bot = ease((t - delay) / 0.3) * H                 # le volet descend…
        top = ease((t - 0.52 - delay) / 0.3) * H          # …puis repart vers le bas
        if bot <= top:
            continue
        x0, x1 = i * w, (i + 1) * w + 1
        d.rectangle([x0, top, x1, bot], fill=bg2 + (255,))
        d.rectangle([x0, bot - edge, x1, bot], fill=(c2 if i % 2 else c3) + (255,))
        if top > 0:
            d.rectangle([x0, top, x1, top + edge], fill=c1 + (255,))

def cover_iris(d, t, W, H, colors, rnd):
    c1, c2, c3, bg1, bg2 = colors
    R = (W * W + H * H) ** 0.5 / 2 + 10
    cx, cy = W / 2, H / 2
    if t <= 0.5:   # anneaux qui grossissent depuis le centre
        for color, delay in [(c2, 0.0), (c3, 0.05), (bg2, 0.10)]:
            r = ease((t - delay) / 0.38) * R
            if r > 0:
                d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color + (255,))
    else:          # un trou s'ouvre au centre et dévoile la nouvelle scène
        d.rectangle([0, 0, W, H], fill=bg2 + (255,))
        for color, delay in [(c3, 0.0), (c2, 0.04), (None, 0.08)]:
            r = ease((t - 0.52 - delay) / 0.36) * R
            if r > 0:
                d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(color + (255,)) if color else (0, 0, 0, 0))

def cover_glitch(d, t, W, H, colors, rnd):
    c1, c2, c3, bg1, bg2 = colors
    n = 14
    h = H / n
    for i in range(n):
        side = 1 if i % 2 else -1
        jit = rnd[i] * 0.1
        a = ease((t - jit) / 0.32)
        b = ease((t - 0.52 - jit / 2) / 0.32)
        if a <= 0 or b >= 1:
            continue
        # la tranche arrive d'un côté et repart de l'autre
        x0 = (1 - a) * W * side - b * W * side
        y0, y1 = i * h, (i + 1) * h + 1
        off = int(W * 0.03 * (1 - min(1, abs(t - 0.5) * 2.2)) * (rnd[i + 20] - 0.5) * 2)
        d.rectangle([x0 - off - 6, y0, x0 + W - off, y1], fill=c3 + (255,))
        d.rectangle([x0 + off, y0, x0 + W + off + 6, y1], fill=c2 + (255,))
        d.rectangle([x0, y0 + 2, x0 + W, y1 - 2], fill=bg2 + (255,))

def cover_eclat(d, t, W, H, colors, rnd):
    c1, c2, c3, bg1, bg2 = colors
    a = ease(t / 0.44)
    b = ease((t - 0.55) / 0.4)
    if a <= 0 or b >= 1:
        return
    # lame haut-gauche et lame bas-droite qui se rejoignent sur la diagonale, puis se retirent en ouvrant une faille
    ox, oy = (1 - a) * W + b * W, (1 - a) * H + b * H
    tl = [(-ox, -oy), (W * 1.02 - ox, -oy), (-ox, H * 1.02 - oy)]
    br = [(W + ox, H + oy), (-W * 0.02 + ox, H + oy), (W + ox, -H * 0.02 + oy)]
    sh = max(W, H) * 0.025
    d.polygon([(x - sh, y - sh) for x, y in tl], fill=c2 + (255,))
    d.polygon([(x + sh, y + sh) for x, y in br], fill=c3 + (255,))
    d.polygon(tl, fill=bg2 + (255,))
    d.polygon(br, fill=bg2 + (255,))
    w = max(3, H // 120)
    d.line([tl[1], tl[2]], fill=c1 + (255,), width=w)
    d.line([br[1], br[2]], fill=c1 + (255,), width=w)

def cover_pixels(d, t, W, H, colors, rnd):
    c1, c2, c3, bg1, bg2 = colors
    size = max(W, H) // 16
    cols, rows = W // size + 1, H // size + 1
    for j in range(rows):
        for i in range(cols):
            r = rnd[(j * cols + i) % len(rnd)] * 0.8
            if t < 0.5:
                p = t * 2.1 - r
                if p < 0:
                    continue
                fresh = p < 0.1
            else:
                p = (t - 0.52) * 2.1 - r
                if p > 0:
                    continue
                fresh = p > -0.06
            col = (c2 if (i + j) % 3 else c3) if fresh else bg2
            d.rectangle([i * size, j * size, (i + 1) * size, (j + 1) * size], fill=col + (255,))

STYLES = ["bandes", "volets", "iris", "glitch", "eclat", "pixels"]

def render(name, colors, W, H, style="bandes", text=""):
    c1 = colors[0]
    rng = random.Random(7)
    rnd = [rng.random() for _ in range(2000)]
    s = min(W, H) / 1080
    logo_base = LOGO.resize((int(240 * s), int(240 * s)), Image.LANCZOS) if LOGO else None
    size = int((120 if LOGO else 240) * s)   # sans logo, le texte prend toute la place
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    while text and size > 40 and probe.textlength(text, font=ImageFont.truetype(FONT, size)) > W * 0.9:
        size -= 6
    font = ImageFont.truetype(FONT, size)
    tmp = os.path.join(OUT, f"_frames_{name}")
    os.makedirs(tmp, exist_ok=True)
    for f in range(FRAMES):
        t = f / (FRAMES - 1)
        img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        globals()["cover_" + style](d, t, W, H, colors, rnd)
        # logo + nom au centre, autour du point de coupe (500 ms)
        a = 1 - min(1, abs(t - 0.5) / 0.17)
        if a > 0:
            sc = 0.85 + 0.15 * ease(a)
            if logo_base:
                lg = logo_base.resize((max(1, int(logo_base.width * sc)),) * 2, Image.LANCZOS)
                lg.putalpha(lg.getchannel("A").point(lambda v: int(v * ease(a))))
                img.alpha_composite(lg, (W // 2 - lg.width // 2, int(H / 2 - lg.height * 0.75)))
            if text:
                tw = d.textlength(text, font=font)
                ty = H / 2 + 40 * s if logo_base else H / 2 - font.size / 2
                d.text((W / 2 - tw / 2, ty), text, font=font, fill=c1 + (int(255 * ease(a)),))
        img.save(os.path.join(tmp, f"{f:03d}.png"), compress_level=1)
    out = os.path.join(OUT, f"stinger_{name}.webm")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", os.path.join(tmp, "%03d.png"),
                    "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "32", "-row-mt", "1", out], check=True)
    shutil.rmtree(tmp)
    print(out, os.path.getsize(out) // 1024, "Ko", flush=True)

# usage :
#   stinger.py [thème …]                                   style bandes, tous les thèmes
#   stinger.py --style iris [--text "MA CHAÎNE"] [thème …]
#   stinger.py --name custom_xxx --colors c1,c2,c3,bg1,bg2 [--style iris] [--text …]   (hexa sans #)
# fichiers : transitions/stinger_<nom>_16x9.webm (bandes) ou stinger_<style>_<nom>_16x9.webm
args = sys.argv[1:]
def opt(k, default=None):
    if k in args:
        i = args.index(k)
        v = args[i + 1]
        del args[i:i + 2]
        return v
    return default
opt("--out"); opt("--logo")
if "--nologo" in args:
    args.remove("--nologo")
style = opt("--style", "bandes")
text = opt("--text", "").upper()
name = opt("--name")
colors_arg = opt("--colors")
if style not in STYLES:
    sys.exit(f"style inconnu : {style}")
prefix = "" if style == "bandes" else style + "_"
if name:
    jobs = [(name, [tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) for h in colors_arg.split(",")])]
else:
    jobs = [(n, themes[n]) for n in (args or list(themes))]
for n, colors in jobs:
    render(f"{prefix}{n}_16x9", colors, 1920, 1080, style, text)
    render(f"{prefix}{n}_9x16", colors, 1080, 1920, style, text)
