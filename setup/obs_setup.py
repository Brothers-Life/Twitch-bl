# Configure OBS pour BL Studio sur n'importe quel PC (appelé par l'installeur, OBS fermé) :
#   - collection de scènes « BL Studio » : scènes 16:9 (Twitch / YouTube) en dossiers + scènes verticales « V · … » (TikTok),
#     overlays du Hub sur toutes les scènes, transitions (stinger + intégrées), script OBS qui lance le Hub,
#   - profil « BL Studio » (1080p60), dock « BL Studio », serveur WebSocket activé,
#   - sortie TikTok (Aitum Vertical) et sortie YouTube (Aitum Multistream) prêtes, il ne reste qu'à coller les clés.
# Ne touche jamais aux collections et profils existants.
#   python -I setup/obs_setup.py [--root DOSSIER_BL_STUDIO] [--force]
import copy, json, os, re, secrets, shutil, subprocess, sys, uuid
from urllib.parse import quote

args = sys.argv[1:]
ROOT = os.path.abspath(args[args.index("--root") + 1] if "--root" in args else os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
FORCE = "--force" in args
DIR = ROOT.replace("\\", "/").rstrip("/") + "/"
URL = "file:///" + quote(DIR, safe=":/")
OBS = os.path.join(os.environ["APPDATA"], "obs-studio")
SCENES_DIR = os.path.join(OBS, "basic", "scenes")
PROFILE_DIR = os.path.join(OBS, "basic", "profiles", "BL_Studio")
PLUGIN_CFG = os.path.join(OBS, "plugin_config")
FILE, NAME, PROFILE = "BL_Studio.json", "BL Studio", "BL Studio"
MAIN = "6c69626f-6273-4c00-9d88-c5136d61696e"      # canevas principal d'OBS (identifiant fixe)
THEME, STYLE = "sunset", "carte"
for d in (SCENES_DIR, PROFILE_DIR, PLUGIN_CFG):
    os.makedirs(d, exist_ok=True)

def read_json(p, default=None):
    try:
        return json.load(open(p, encoding="utf-8-sig"))
    except Exception:
        return default

def write_json(p, data):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    if os.path.exists(p) and not os.path.exists(p + ".avant-bl-studio.bak"):
        shutil.copy(p, p + ".avant-bl-studio.bak")
    json.dump(data, open(p, "w", encoding="utf-8"), indent=4, ensure_ascii=False)

coll_path = os.path.join(SCENES_DIR, FILE)
existing = read_json(coll_path, {})
if existing and not FORCE:
    print("La collection « BL Studio » existe déjà : scènes conservées (relance avec --force pour la recréer).")
VCANVAS = next((c["info"]["uuid"] for c in existing.get("canvases", []) if "Vertical" in c["info"]["name"]), None) or str(uuid.uuid4())

WHITE, CREAM = 0xFFFFFFFF, 0xFFD0E6F3
YELLOW, AMBER, BLACK = 0xFF64E6FA, 0xFF2594DE, 0xFF000000

def src(name, sid, settings, vid=None, mixers=0):
    return {"name": name, "uuid": str(uuid.uuid4()), "id": sid, "versioned_id": vid or sid,
            "settings": settings, "mixers": mixers, "sync": 0, "flags": 0, "volume": 1.0,
            "balance": 0.5, "enabled": True, "muted": False, "hotkeys": {},
            "deinterlace_mode": 0, "deinterlace_field_order": 0, "monitoring_type": 0, "private_settings": {}}

def image(name, file):
    return src(name, "image_source", {"file": DIR + file})

def text(name, txt, size, face="Impact", style="Regular", color=WHITE, gradient=None, outline=6):
    st = {"text": txt, "font": {"face": face, "size": size, "style": style, "flags": 0}, "color": color, "align": "center",
          "outline": outline > 0, "outline_size": outline, "outline_color": BLACK}
    if gradient:
        st.update({"gradient": True, "gradient_color": gradient, "gradient_dir": 90.0})
    return src(name, "text_gdiplus", st, vid="text_gdiplus_v3")

def browser(name, width, height, page="widget.html", restart=False, **params):
    base = {"theme": THEME} if page == "fond-anime.html" else {"theme": THEME, "style": STYLE}
    params = {**base, **params}
    url = URL + page + "?" + "&".join(f"{k}={quote(str(v))}" for k, v in params.items())
    return src(name, "browser_source", {"is_local_file": False, "url": url, "width": width, "height": height,
        "fps_custom": False, "reroute_audio": False, "shutdown": False, "restart_when_active": restart, "css": ""})

def audio(name, sid):
    s = src(name, sid, {"device_id": "default"}, mixers=255)
    s["hotkeys"] = {"libobs.mute": [], "libobs.unmute": [], "libobs.push-to-mute": [], "libobs.push-to-talk": []}
    return s

REF = [1920, 1080]

# alignements OBS : 0 centre, 1 gauche, 2 droite, 4 haut, 8 bas
def item(s, x=0, y=0, align=5, bounds=None, btype=2, visible=True, crop=False, locked=False):
    # coordonnées absolues + relatives : sans les relatives, OBS place mal les éléments du canevas vertical
    cw, ch = REF
    half = ch / 2
    bx, by = (float(bounds[0]), float(bounds[1])) if bounds else (0.0, 0.0)
    return {"name": s["name"], "source_uuid": s["uuid"], "visible": visible, "locked": locked, "rot": 0.0, "align": align,
            "bounds_type": btype if bounds else 0, "bounds_align": 0, "bounds_crop": crop,
            "crop_left": 0, "crop_top": 0, "crop_right": 0, "crop_bottom": 0,
            "scale_ref": {"x": float(cw), "y": float(ch)},
            "pos": {"x": float(x), "y": float(y)}, "pos_rel": {"x": (x - cw / 2) / half, "y": (y - ch / 2) / half},
            "scale": {"x": 1.0, "y": 1.0}, "scale_rel": {"x": 1.0, "y": 1.0},
            "bounds": {"x": bx, "y": by}, "bounds_rel": {"x": bx / half, "y": by / half},
            "scale_filter": "disable", "blend_method": "default", "blend_type": "normal",
            "group_item_backup": False, "private_settings": {}}

def number(items):
    for i, it in enumerate(items, 1):
        it["id"] = i
    return items

sources, groups, scenes, vscenes = [], [], [], []
def A(s):
    sources.append(s)
    return s

W, H = 1920, 1080
frame = A(src("Repère dossier (ne pas supprimer)", "color_source", {"color": 0, "width": W, "height": H}, vid="color_source_v3"))

def group(name, items):
    # dossier à la taille du canevas (le repère transparent empêche OBS de le recadrer et de tout décaler)
    g = src(name, "group", {"id_counter": len(items) + 1, "custom_size": True, "cx": W, "cy": H,
                            "items": number([item(frame, locked=True)] + items)})
    groups.append(g)
    return item(g)

def scene(name, folders, top=()):
    items = [group(f"{name} · {f}", it) for f, it in folders if it] + list(top)
    s = src(name, "scene", {"id_counter": len(items), "custom_size": False, "items": number(items)})
    s["hotkeys"] = {"OBSBasic.SelectScene": []}
    s["canvas_uuid"] = MAIN
    scenes.append(s)
    return s

def vscene(name, items):
    s = src(f"V · {name}", "scene", {"id_counter": len(items), "custom_size": False, "items": number(items), "order": len(vscenes)})
    if not vscenes:
        s["settings"]["canvas_active"] = True
    s["hotkeys"] = {"OBSBasic.SelectScene": []}
    s["canvas_uuid"] = VCANVAS
    vscenes.append(s)
    return s

# ---------- Sources partagées ----------
fond, bandes = A(image("Fond", "fond_16x9.png")), A(image("Bandes déco", "bandes_16x9.png"))
fondV = A(image("Fond (vertical)", "fond_9x16.png"))
jeu = A(src("Capture du jeu", "game_capture", {"capture_mode": "any_fullscreen", "capture_cursor": False,
                                                 "allow_transparency": False, "capture_overlays": False}))
cam = A(src("Webcam", "dshow_input", {}, mixers=255))
logo = A(image("Logo", "logo.png"))
ANIM = dict(anim="formes", traits=1, bandes=1, eclairs=1, grain=1, vitesse=1, densite=1)
anime = A(browser("Fond animé", W, H, page="fond-anime.html", **ANIM))
animeV = A(browser("Fond animé (vertical)", 1080, 1920, page="fond-anime.html", **ANIM))
musique = A(browser("Widget Musique", 700, 130, w="music", label="En écoute"))
badge = A(browser("Widget Badge serveur", 560, 140, w="badge", title="MA CHAÎNE", sub="Live", dot=1, logo=1))
horloge = A(browser("Widget Horloge", 300, 110, w="clock", date=1))
ticker = A(browser("Widget Bandeau défilant", W, 70, w="ticker", tag="INFO",
                   msgs="Bienvenue sur le live|N'oublie pas le follow|Tape !commandes dans le chat", speed=1))
socials = A(browser("Widget Réseaux sociaux", 620, 120, w="socials", items="TWITCH:ton_pseudo|TIKTOK:@ton_pseudo|YOUTUBE:@ton_pseudo", every=5))
perso = A(browser("Widget Carte perso RP", 560, 150, w="perso", titre="Personnage", nom="Mon perso", metier="Métier", info="Ville"))
goal = A(browser("Widget Objectif", 600, 130, w="goal", label="Objectif followers", cur=0, max=100))
camframe = A(browser("Widget Cadre webcam", 1280, 720, w="camframe", nom=""))
alertes = A(browser("Hub · Alertes", 1000, 400, page="alertes.html", anim="glisse"))
minijeux = A(browser("Hub · Mini-jeux", W, H, page="minijeux.html"))
minijeuxV = A(browser("Hub · Mini-jeux (vertical)", 1080, 1920, page="minijeux.html"))
chatU = A(browser("Hub · Chat unifié", 520, 700, page="chat-unifie.html", evenements=1, max=10, fade=40))
soutiens = A(browser("Hub · Derniers soutiens", 620, 120, page="soutiens.html", every=5))
# lecteur de la soundboard : audio géré par OBS et entendu dans le casque (écoute + sortie)
sons = A(src("Hub · Sons", "browser_source", {"is_local_file": False, "url": URL + "sons.html", "width": 16, "height": 16,
    "reroute_audio": True, "shutdown": False, "restart_when_active": False, "css": ""}, mixers=255))
sons["monitoring_type"] = 2

# alertes + mini-jeux, imbriqués en haut de chaque scène
glob = src("⚡ Overlays (toutes les scènes)", "scene", {"id_counter": 3, "custom_size": False, "items": number([
    item(minijeux), item(alertes, 960, 40, align=4), item(sons)])})
glob["hotkeys"] = {"OBSBasic.SelectScene": []}; glob["canvas_uuid"] = MAIN
TOP = lambda: [item(glob, locked=True)]

# ---------- Scènes 16:9 ----------
def ecran(nom, titre, sous_titre, minutes=None, done="00:00", extra=()):
    t = A(text(f"{nom} - Titre", titre, 150, color=YELLOW, gradient=AMBER, outline=8))
    st = A(text(f"{nom} - Sous-titre", sous_titre, 46, face="Segoe UI", style="Bold", color=CREAM, outline=0))
    widgets = []
    if minutes is not None:
        cd = A(browser(f"{nom} - Compte à rebours", 640, 200, restart=True, w="countdown", min=minutes, done=done, bar=1))
        widgets.append(item(cd, 960, 740, align=0))
    widgets.append(item(musique, 960, 930, align=0))
    widgets += list(extra)
    scene(nom, [("Fond", [item(fond, bounds=(W, H)), item(anime)]),
                ("Textes", [item(logo, 960, 290, align=0, bounds=(200, 200)), item(t, 960, 490, align=0), item(st, 960, 590, align=0)]),
                ("Widgets", widgets)], TOP())

ecran("Début", "MA CHAÎNE", "LE LIVE COMMENCE BIENTÔT", 5, "J'arrive !", [item(ticker, 0, H, align=9)])
scene("En jeu", [
    ("Jeu", [item(jeu, bounds=(W, H))]),
    ("Webcam", [item(cam, 1890, 1050, align=10, bounds=(480, 270), visible=False), item(camframe, 1900, 1060, align=10, bounds=(500, 290), visible=False)]),
    ("Widgets", [item(badge, 30, 30), item(socials, 30, 190, visible=False), item(horloge, 1890, 30, align=6),
                 item(perso, 1890, 160, align=6, visible=False), item(goal, 960, 30, align=4, visible=False),
                 item(musique, 30, 1050, align=9), item(ticker, 0, H, align=9, visible=False)]),
    ("Hub", [item(chatU, 30, 960, align=9, visible=False), item(soutiens, 1890, 1050, align=10, visible=False)]),
], TOP())
scene("Discussion", [
    ("Fond", [item(fond, bounds=(W, H)), item(anime)]),
    ("Webcam", [item(cam, 80, 150, bounds=(1220, 686)), item(camframe, 70, 140, bounds=(1240, 706))]),
    ("Widgets", [item(badge, 80, 30, bounds=(480, 120)), item(musique, 80, 1050, align=9, bounds=(600, 111)), item(perso, 1300, 1050, align=10, bounds=(480, 128), visible=False)]),
    ("Hub", [item(chatU, 1850, 150, align=6, bounds=(520, 700)), item(soutiens, 1850, 1050, align=10, bounds=(520, 100))]),
], TOP())
mt = A(text("Mini-jeux - Titre", "MINI-JEUX", 110, color=YELLOW, gradient=AMBER, outline=8))
mst = A(text("Mini-jeux - Sous-titre", "JOUE DANS LE CHAT : TWITCH · TIKTOK · YOUTUBE", 36, face="Segoe UI", style="Bold", color=CREAM, outline=0))
scene("Mini-jeux", [
    ("Fond", [item(fond, bounds=(W, H)), item(anime)]),
    ("Textes", [item(logo, 80, 50, bounds=(120, 120)), item(mt, 960, 90, align=0), item(mst, 960, 170, align=0)]),
    ("Hub", [item(chatU, 1850, 230, align=6, bounds=(440, 600)), item(soutiens, 1850, 1050, align=10, bounds=(440, 85))]),
    ("Widgets", [item(musique, 70, 1050, align=9, bounds=(600, 111))]),
], TOP())
ecran("Pause", "PAUSE", "ON REVIENT TRÈS VITE", 5, extra=[item(ticker, 0, H, align=9)])
ecran("Problème technique", "PROBLÈME TECHNIQUE", "ON REVIENT DANS UN INSTANT")
ecran("Fin", "MERCI D'AVOIR REGARDÉ", "À TRÈS VITE POUR UN PROCHAIN LIVE", extra=[item(socials, 960, 760, align=0)])

# ---------- Scènes verticales (TikTok, canevas Aitum Vertical) ----------
VW, VH = 1080, 1920
REF[:] = [VW, VH]
vglob = src("V · ⚡ Overlays", "scene", {"id_counter": 2, "custom_size": False, "order": 0, "items": number([
    item(minijeuxV), item(alertes, 540, 150, align=4, bounds=(1000, 400))])})
vglob["hotkeys"] = {"OBSBasic.SelectScene": []}; vglob["canvas_uuid"] = VCANVAS
VTOP = lambda: item(vglob, locked=True)

def vecran(nom, titre, sous_titre, minutes=None, done="00:00"):
    t = A(text(f"V · {nom} - Titre", titre, 120 if len(titre) < 14 else 92, color=YELLOW, gradient=AMBER, outline=8))
    st = A(text(f"V · {nom} - Sous-titre", sous_titre, 40, face="Segoe UI", style="Bold", color=CREAM, outline=0))
    items = [item(fondV, bounds=(VW, VH)), item(animeV), item(logo, 540, 560, align=0, bounds=(260, 260)),
             item(t, 540, 790, align=0), item(st, 540, 890, align=0)]
    if minutes is not None:
        cd = A(browser(f"V · {nom} - Compte à rebours", 640, 200, restart=True, w="countdown", min=minutes, done=done, bar=1))
        items.append(item(cd, 540, 1040, align=0))
    items += [item(musique, 540, 1230, align=0, bounds=(760, 141)), VTOP()]
    vscene(nom, items)

vecran("Début", "MA CHAÎNE", "LE LIVE COMMENCE BIENTÔT", 5, "J'arrive !")
vscene("En jeu", [item(jeu, bounds=(VW, VH), btype=3, crop=True),
    item(badge, 540, 140, align=4, bounds=(600, 150)), item(musique, 540, 310, align=4, bounds=(760, 141)),
    item(perso, 540, 470, align=4, bounds=(600, 160), visible=False), item(soutiens, 540, 470, align=4, bounds=(700, 135), visible=False),
    item(chatU, 540, 1250, align=4, bounds=(800, 500), visible=False), VTOP()])
vscene("Discussion", [item(fondV, bounds=(VW, VH)), item(animeV), item(badge, 540, 90, align=4, bounds=(600, 150)),
    item(cam, 540, 280, align=4, bounds=(1000, 562)), item(camframe, 540, 270, align=4, bounds=(1020, 582)),
    item(chatU, 540, 900, align=4, bounds=(900, 600)), item(musique, 540, 1540, align=4, bounds=(760, 141)), VTOP()])
vscene("Mini-jeux", [item(fondV, bounds=(VW, VH)), item(animeV), item(badge, 540, 90, align=4, bounds=(600, 150)),
    item(chatU, 540, 1300, align=4, bounds=(900, 450)), VTOP()])
vecran("Pause", "PAUSE", "ON REVIENT TRÈS VITE", 5)
vecran("Problème technique", "PROBLÈME TECHNIQUE", "ON REVIENT DANS UN INSTANT")
vecran("Fin", "MERCI D'AVOIR REGARDÉ", "À TRÈS VITE")
vglob["settings"]["order"] = len(vscenes)
vscenes.append(vglob)

# ---------- Collection ----------
def tr(name, tid, settings):
    return {"name": name, "uuid": str(uuid.uuid4()), "id": tid, "versioned_id": tid, "settings": settings, "hotkeys": {}}

if not existing or FORCE:
    coll = {
        "name": NAME,
        "DesktopAudioDevice1": audio("Audio du bureau", "wasapi_output_capture"),
        "AuxAudioDevice1": audio("Micro", "wasapi_input_capture"),
        "sources": sources + [glob] + scenes + vscenes,
        "groups": groups,
        "scene_order": [{"name": s["name"]} for s in scenes] + [{"name": glob["name"]}],
        "current_scene": "Début", "current_program_scene": "Début",
        "canvases": [{"info": {"name": "Aitum Vertical", "uuid": VCANVAS, "private": False, "flags": 14}}],
        "transitions": [
            tr("Stinger BL", "obs_stinger_transition", {"path": f"{DIR}transitions/stinger_{THEME}_16x9.webm", "transition_point": 500,
               "tp_type": 0, "audio_fade_style": 0, "hw_decode": True}),
            tr("Glissement", "slide_transition", {"direction": "left"}),
            tr("Balayage", "swipe_transition", {"direction": "left", "swipe_in": False}),
            tr("Barres", "wipe_transition", {"luma_image": "linear-h.png", "luma_softness": 0.05, "luma_invert": False}),
            tr("Fondu au noir", "fade_to_color_transition", {"color": BLACK, "switch_point": 50}),
        ],
        "current_transition": "Stinger BL", "transition_duration": 500,
        "quick_transitions": [{"name": "Coupure", "duration": 300, "hotkeys": [], "id": 1, "fade_to_black": False},
                              {"name": "Fondu", "duration": 300, "hotkeys": [], "id": 2, "fade_to_black": False}],
        "saved_projectors": [], "preview_locked": False, "scaling_enabled": False, "scaling_level": 0,
        "scaling_off_x": 0.0, "scaling_off_y": 0.0, "virtual-camera": {"type2": 3},
        "modules": {"scripts-tool": [{"path": DIR + "brotherslife.lua", "settings": {}}]},
        "version": 2,
    }
    write_json(coll_path, coll)

# ---------- user.ini : collection, profil, dock, pas d'assistant au 1er lancement ----------
ui_path = os.path.join(OBS, "user.ini")
ui = open(ui_path, encoding="utf-8-sig").read() if os.path.exists(ui_path) else ""
def ini_set(text, section, key, value):
    m = re.search(rf"^\[{re.escape(section)}\]\s*$", text, re.M)
    if not m:
        return text.rstrip() + f"\n\n[{section}]\n{key}={value}\n"
    end = re.search(r"^\[", text[m.end():], re.M)
    body_end = m.end() + (end.start() if end else len(text) - m.end())
    body = text[m.end():body_end]
    if re.search(rf"^{re.escape(key)}=.*$", body, re.M):
        body = re.sub(rf"^{re.escape(key)}=.*$", lambda _: f"{key}={value}", body, flags=re.M)
    else:
        body = "\n" + f"{key}={value}" + body
    return text[:m.end()] + body + text[body_end:]
if not ui:
    ui = "[General]\nPre19Defaults=false\nPre21Defaults=false\nPre23Defaults=false\nPre24.1Defaults=false\n"
ui = ini_set(ui, "General", "FirstRun", "true")
ui = ini_set(ui, "General", "ConfirmOnExit", "true")
ui = ini_set(ui, "Basic", "Profile", PROFILE)
ui = ini_set(ui, "Basic", "ProfileDir", "BL_Studio")
ui = ini_set(ui, "Basic", "SceneCollection", NAME)
ui = ini_set(ui, "Basic", "SceneCollectionFile", FILE)
docks = [{"title": "BL Studio", "url": "http://localhost:3939/", "uuid": "b1b1b1b1-0000-4000-8000-000000000b1d"}]
ui = ini_set(ui, "BasicWindow", "ExtraBrowserDocks", json.dumps(docks, ensure_ascii=False))
if os.path.exists(ui_path) and not os.path.exists(ui_path + ".avant-bl-studio.bak"):
    shutil.copy(ui_path, ui_path + ".avant-bl-studio.bak")
open(ui_path, "w", encoding="utf-8-sig").write(ui)

# ---------- Profil « BL Studio » (1080p60, sortie simple) ----------
prof_ini = os.path.join(PROFILE_DIR, "basic.ini")
if not os.path.exists(prof_ini):
    try:
        nvidia = subprocess.run(["nvidia-smi", "-L"], capture_output=True, timeout=10).returncode == 0
    except Exception:
        nvidia = False
    enc = "nvenc" if nvidia else "x264"
    open(prof_ini, "w", encoding="utf-8-sig").write(
        f"[General]\nName={PROFILE}\n\n[Output]\nMode=Simple\n\n[SimpleOutput]\nStreamEncoder={enc}\nRecEncoder={enc}\n"
        "VBitrate=6000\nABitrate=160\nStreamAudioEncoder=aac\nRecAudioEncoder=aac\n\n"
        "[Video]\nBaseCX=1920\nBaseCY=1080\nOutputCX=1920\nOutputCY=1080\nFPSType=0\nFPSCommon=60\n")

# ---------- obs-websocket : activé, mot de passe aléatoire (lu par le Hub pour se connecter tout seul) ----------
ws_path = os.path.join(PLUGIN_CFG, "obs-websocket", "config.json")
ws = read_json(ws_path, {}) or {}
ws.update({"server_enabled": True, "auth_required": True, "first_load": False, "alerts_enabled": False,
           "server_port": ws.get("server_port", 4455), "server_password": ws.get("server_password") or secrets.token_urlsafe(12)})
write_json(ws_path, ws)

# ---------- Aitum Vertical : canevas 1080×1920 + sortie TikTok ----------
vc_path = os.path.join(PLUGIN_CFG, "vertical-canvas", "config.json")
vc = read_json(vc_path, {}) or {}
canv = vc.setdefault("canvas", [{}])
if not canv:
    canv.append({})
cv = canv[0]
cv.setdefault("width", 1080); cv.setdefault("height", 1920)
cv["current_scene"] = "V · Début"
cv.setdefault("streaming_video_bitrate", 6000)
if not any(o.get("name") == "TikTok" for o in cv.get("stream_outputs", [])):
    cv.setdefault("stream_outputs", []).insert(0, {"name": "TikTok", "stream_server": "rtmp://a-remplacer", "stream_key": "", "enabled": True})
cv.setdefault("stream_server", "rtmp://a-remplacer")
write_json(vc_path, vc)

# ---------- Aitum Multistream : sortie YouTube (clé à coller dans le dock) ----------
ms_path = os.path.join(PLUGIN_CFG, "aitum-multistream", "config.json")
ms = read_json(ms_path, {}) or {}
profs = ms.setdefault("profiles", [])
prof = next((p for p in profs if p.get("name") == PROFILE), None)
if not prof:
    prof = {"name": PROFILE}
    profs.append(prof)
if not any(o.get("name") == "YouTube" for o in prof.setdefault("outputs", [])):
    prof["outputs"].append({"name": "YouTube", "stream_server": "rtmp://a.rtmp.youtube.com/live2", "stream_key": "", "advanced": False})
write_json(ms_path, ms)

print(f"OBS configuré : {len(scenes)} scènes 16:9, {len(vscenes)} scènes verticales, dossier {DIR}")
