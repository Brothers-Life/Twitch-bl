# Assemble le dashboard du BL Hub et le configurateur OBS en une seule appli : hub/public/app.html
# À relancer après chaque modification de configurateur.html ou hub/public/dashboard.html :  python outils/build_app.py
import os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))).replace("\\", "/") + "/"
dash = open(ROOT + "hub/public/dashboard.html", encoding="utf-8").read()
conf = open(ROOT + "configurateur.html", encoding="utf-8").read()

def between(s, a, b, start=0):
    i = s.index(a, start) + len(a)
    return s[i:s.index(b, i)]

# ---------- CSS ----------
dash_css = between(dash, "<style>", "</style>")
conf_css = between(conf, "<style>", "</style>")
# du configurateur on ne garde que ses composants propres (le reste existe déjà côté dashboard)
keep = []
for rule in re.findall(r"[^{}]+\{[^{}]*\}", conf_css):
    sel = rule.split("{")[0].strip()
    if any(sel.startswith(k) for k in (".grid", ".scene", ".theme", ".sw", ".item", ".eye", ".toggles", "details summary", ".stylecard", ".preview", ".wstyle-row",
                                       ".packs", ".pack", ".bgprev", ".stingers", ".stingercard", ".dest", ".onair",
                                       ".np", ".ctrl", ".counters", ".counterbox", ".tpl", ".swrow",
                                       ".mixer", ".meter", ".chips", ".chip2", ".scenechecks", ".groups")):
        keep.append(rule.strip())
extra_css = """
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 6px; }
  nav .sep { width: 1px; background: var(--line); margin: 8px 4px; flex: none; }
  nav .grp { font-size: 10px; color: var(--mute); text-transform: uppercase; letter-spacing: .1em; align-self: center; padding: 0 4px 0 8px; white-space: nowrap; }
  .obs-note { display: none; background: rgba(229,72,77,.1); border: 1px solid rgba(229,72,77,.4); color: #f3b5b7; border-radius: 8px; padding: 10px; margin-bottom: 10px; }
  body:not(.obs-on) .needs-obs .obs-note { display: block; }
  body:not(.obs-on) .needs-obs .obs-body { opacity: .35; pointer-events: none; }
  .row > label { flex: 0 0 150px; }
  #tab-scenes .grid button { min-height: 44px; }

  /* ===== Refonte BL Studio : l'appli prend les couleurs de la DA choisie (variables posées par paintStudio) ===== */
  :root { --font-ui: "Bahnschrift", "DIN Alternate", "Segoe UI", sans-serif;
    --hi: #fae664; --acc: #de9425; --acc2: #cc4308; --tb1: #1a0b06; --tb2: #070302; --on-acc: #1a0f05;
    --bg: color-mix(in srgb, var(--tb2) 55%, #15161a);
    --panel: color-mix(in srgb, var(--tb1) 35%, #1d1f24);
    --panel2: color-mix(in srgb, var(--tb1) 30%, #272a31);
    --line: color-mix(in srgb, var(--acc) 16%, #2f323a);
    --field: color-mix(in srgb, var(--tb2) 60%, #0e0f12);
    --txt: #eef0f3; --mute: #9aa0ab; }
  html, body { font: 13px/1.45 var(--font-ui); background: var(--bg); }
  header { position: sticky; top: 0; height: 54px; padding: 0 16px; gap: 12px; flex-wrap: nowrap; background: var(--bg); border-bottom: 0; }
  header::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 3px;
    background: linear-gradient(90deg, var(--acc) 0 62%, var(--acc2) 62% 86%, var(--hi) 86%); }
  header img { width: 32px; height: 32px; border-radius: 8px; }
  header b { font-size: 18px; font-weight: 700; font-stretch: condensed; letter-spacing: .01em; }
  .light { background: var(--panel); }
  .shell { display: grid; grid-template-columns: 210px minmax(0, 1fr); min-height: calc(100vh - 54px); }
  nav { position: sticky; top: 54px; height: calc(100vh - 54px); display: flex; flex-direction: column; gap: 1px;
    padding: 10px 12px 20px 10px; border: 0; border-right: 1px solid var(--line); overflow: hidden auto;
    background: color-mix(in srgb, var(--bg) 82%, #000); }
  nav .grp { align-self: stretch; padding: 14px 10px 5px; font-size: 12px; font-weight: 600; text-transform: none; letter-spacing: 0; color: var(--mute); }
  nav .grp:first-child { padding-top: 4px; }
  nav .sep { display: none; }
  nav button { display: flex; align-items: center; gap: 11px; padding: 8px 10px; border: 0; border-radius: 0; position: relative; isolation: isolate;
    color: var(--mute); font-size: 13.5px; text-align: left; }
  nav button svg { width: 18px; height: 18px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  nav button:hover { color: var(--txt); }
  nav button.on { color: var(--on-acc); font-weight: 700; }
  nav button.on::before { content: ""; position: absolute; inset: 2px 0; z-index: -1; background: var(--acc); transform: skewX(-12deg); box-shadow: 5px 0 0 var(--acc2); }
  main { padding: 20px 24px 48px; max-width: 1280px; width: 100%; margin: 0; }
  h3 { margin: 24px 0 10px; font-size: 15px; font-weight: 700; font-stretch: semi-condensed; text-transform: none; letter-spacing: 0; color: var(--txt); }
  h3:first-child, .card > h3:first-child { margin-top: 0; }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; margin-bottom: 10px; }
  .hint { color: var(--mute); }
  .btn { background: var(--panel2); border: 1px solid var(--line); border-radius: 6px; padding: 7px 14px; transition: border-color .15s, background-color .15s; }
  .btn:hover { border-color: var(--acc); }
  .btn.primary { background: var(--acc); color: var(--on-acc); border: 0; border-radius: 0; padding: 8px 22px; font-weight: 700;
    clip-path: polygon(9px 0, 100% 0, calc(100% - 9px) 100%, 0 100%); }
  .btn.primary:hover { background: color-mix(in srgb, var(--acc) 82%, #fff); }
  .btn.small { padding: 4px 10px; }
  .btn.small.primary { padding: 5px 16px; }
  input[type=text], input[type=password], input[type=number], select, textarea { background: var(--field); border: 1px solid var(--line); border-radius: 6px; padding: 7px 9px; }
  input[type=checkbox], input[type=range] { accent-color: var(--acc); }
  :is(button, .btn, input, select, textarea, summary, .theme, .stylecard):focus-visible { outline: 2px solid var(--hi); outline-offset: 2px; }
  .theme { background: var(--panel); border-color: var(--line); }
  .theme.on, .stylecard.on, .stingercard.on { border-color: var(--acc); box-shadow: 0 0 0 1px var(--acc) inset; }
  .stylecard { background: var(--field); border-color: var(--line); }
  .stingercard { background: var(--panel); border-color: var(--line); }
  .eye.on { background: color-mix(in srgb, var(--acc) 22%, transparent); border-color: var(--acc); }
  .scene.live { border-color: var(--ko); box-shadow: inset 4px 0 0 var(--ko); }
  .stat .k, th { text-transform: none; letter-spacing: 0; font-size: 12px; }
  .stat .v { font-size: 30px; font-stretch: condensed; color: var(--txt); }
  .list .val { color: var(--hi); }
  .cm.ev { background: color-mix(in srgb, var(--acc) 10%, transparent); border-left-color: var(--acc); }
  .toast { background: var(--acc); color: var(--on-acc); border-radius: 0; padding: 10px 26px; clip-path: polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%); }
  .tag.bot { background: var(--acc); color: var(--on-acc); }
  /* dock OBS étroit : la barre latérale devient un rail d'icônes */
  @media (max-width: 760px) {
    .shell { grid-template-columns: 52px minmax(0, 1fr); }
    nav { padding: 8px 6px; }
    nav .grp { display: none; }
    nav .sep { display: block; width: auto; height: 1px; margin: 6px 6px; background: var(--line); }
    nav button { justify-content: center; padding: 10px 0; }
    nav button span { display: none; }
    nav button.on::before { inset: 3px 4px; box-shadow: 3px 0 0 var(--acc2); }
    main { padding: 12px 12px 40px; }
    .row > label { flex-basis: 110px; }
    header .hint { display: none; }
    header { position: relative; height: auto; min-height: 54px; padding: 8px 12px 11px; flex-wrap: wrap; }
    header b { white-space: nowrap; }
    .lights { flex-basis: 100%; margin-left: 0; }
    .light { padding: 2px 7px; }
    nav { top: 0; height: 100vh; }
    .shell { min-height: 100vh; }
  }
  @media (prefers-reduced-motion: reduce) { *, *::before { animation: none !important; transition: none !important; } }
"""
css = dash_css + "\n  /* --- configurateur OBS --- */\n  " + "\n  ".join(keep) + extra_css

# ---------- Sections ----------
dash_main = between(dash, "<main>", "</main>")
conf_main = between(conf, "<main>", "  </main>")
conf_login = between(conf, '<div id="login" class="card" style="margin:10px">', "\n</div>\n\n<div id=\"app\"")

# chaque section OBS reçoit un bandeau « connecte OBS » et son contenu est enveloppé
def wrap_obs(m):
    sid, inner = m.group(1), m.group(2)
    on = ' class="on"' if False else ""
    return (f'<section id="{sid}" class="needs-obs">\n      <div class="obs-note">⚠ OBS n\'est pas connecté : onglet <b>Connexions</b> → carte <b>OBS</b>.</div>\n'
            f'      <div class="obs-body">{inner}</div>\n    </section>')
conf_main = re.sub(r'<section id="(tab-[\w]+)"(?: class="on")?>(.*?)</section>', wrap_obs, conf_main, flags=re.S)

# carte OBS dans l'onglet Connexions
obs_card = f'''      <div class="card"><h3><span class="tag" style="background:#302e31">OBS</span> OBS Studio</h3>
{conf_login.replace('<h3>Connexion à OBS</h3>', '').replace('style="margin:10px"', '')}
        <p class="hint" id="obsInfo"></p></div>'''
dash_main = dash_main.replace('''      <div class="card"><h3><span class="tag tw">TWITCH</span> Twitch</h3>''', obs_card + '''
      <div class="card"><h3><span class="tag tw">TWITCH</span> Twitch</h3>''', 1)

ICONS = {
  "scenes": '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3z"/>',
  "musique": '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  "audio": '<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  "diffusion": '<circle cx="12" cy="12" r="2"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/>',
  "stats": '<path d="M5 20V11M11 20V5M17 20v-7M3 20h18"/>',
  "chat": '<path d="M4 5h16v11H9l-5 4z"/>',
  "alerts": '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/>',
  "bot": '<rect x="5" y="8" width="14" height="11" rx="2"/><path d="M12 4v4M9.5 13h.01M14.5 13h.01"/>',
  "games": '<path d="M7 8h10a5 5 0 0 1 5 5 3 3 0 0 1-5.4 1.8L15 13H9l-1.6 1.8A3 3 0 0 1 2 13a5 5 0 0 1 5-5zM7 10.5v3M5.5 12h3M16 11h.01M18 13h.01"/>',
  "board": '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/>',
  "identite": '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16a3 3 0 0 1 6 0M14 10h4M14 14h3"/>',
  "da": '<path d="M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.2-1.6-.4-1 .3-2.4 1.6-2.4H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z"/><path d="M7.5 11h.01M10.5 7.5h.01M15 8h.01"/>',
  "widgets": '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  "textes": '<path d="M5 7V4h14v3M12 4v16M9 20h6"/>',
  "transitions": '<path d="M7 4h5L7 20H2zM17 4h5l-5 16h-5z"/>',
  "conn": '<path d="M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-10 0zM12 16v5"/>',
}
def nb(tab, label, on=False):
    cls = ' class="on"' if on else ""
    return (f'  <button data-tab="{tab}" title="{label}"{cls}>'
            f'<svg viewBox="0 0 24 24" aria-hidden="true">{ICONS[tab]}</svg><span>{label}</span></button>')
nav = "\n".join([
  "<nav>",
  '  <span class="grp">Live</span>', nb("scenes", "Scènes", True), nb("diffusion", "Diffusion"), nb("musique", "Musique"), nb("audio", "Audio"), nb("stats", "Stats"), nb("chat", "Chat"),
  '  <span class="sep"></span><span class="grp">Communauté</span>', nb("alerts", "Alertes"), nb("bot", "Bot"), nb("games", "Mini-jeux"), nb("board", "Classement"),
  '  <span class="sep"></span><span class="grp">Design</span>', nb("identite", "Identité"), nb("da", "DA & animations"), nb("widgets", "Widgets"), nb("textes", "Textes"), nb("transitions", "Transitions"),
  '  <span class="sep"></span><span class="grp">Réglages</span>', nb("conn", "Connexions"),
  "</nav>"])

# onglet de départ : Scènes (on retire "on" de Stats)
dash_main = dash_main.replace('<section id="tab-stats" class="on">', '<section id="tab-stats">', 1)
conf_main = conf_main.replace('<section id="tab-scenes" class="needs-obs">', '<section id="tab-scenes" class="needs-obs on">', 1)

# ---------- Scripts ----------
dash_js = between(dash, "<script>", "</script>")
conf_js = between(conf, "<script>", "</script>")

# navigation commune : on retire celles des deux pages
dash_js = re.sub(r"// ---------- Navigation ----------\ndocument\.querySelectorAll\(\"nav button\"\).*?\}\);\n", "", dash_js, flags=re.S)
conf_js = re.sub(r"// ---------- Navigation ----------\ndocument\.querySelectorAll\(\"nav button\"\).*?\}\);\n", "", conf_js, flags=re.S)

# statut OBS : voyant dans l'en-tête + classe sur <body> au lieu de cacher/montrer l'appli
conf_js = conf_js.replace(
    'function setStatus(t, ok) { $("status").textContent = t; $("status").classList.toggle("ok", !!ok); }',
    'function setStatus(t, ok) { const l = $("obsLight"); l.className = "light " + (ok ? "on" : /Connexion/.test(t) ? "connecting" : "error"); $("obsInfo").textContent = t; document.body.classList.toggle("obs-on", !!ok); }')
conf_js = conf_js.replace('$("login").hidden = true; $("app").hidden = false;', '')
conf_js = conf_js.replace('$("login").hidden = false; $("app").hidden = true;', '')
# même origine que le Hub : plus besoin de l'adresse complète
conf_js = conf_js.replace('fetch("http://127.0.0.1:3939/api/stinger"', 'fetch("/api/stinger"')

# connexion automatique : le Hub lit le mot de passe dans la config locale d'obs-websocket
conf_js = conf_js.replace(
    '''try { $("pwd").value = localStorage.getItem("bl_pwd") || ""; $("port").value = localStorage.getItem("bl_port") || 4455; } catch {}
if ($("pwd").value) connect();''',
    '''try { $("pwd").value = localStorage.getItem("bl_pwd") || ""; $("port").value = localStorage.getItem("bl_port") || 4455; } catch {}
(async () => {
  try {
    const a = await (await fetch("/api/obs/auth", { headers: { "X-BL": "1" } })).json();
    if (!a.enabled) { setStatus("Serveur WebSocket d'OBS désactivé (Outils > Paramètres du serveur WebSocket)"); return; }
    $("port").value = a.port; if (a.password) $("pwd").value = a.password;
  } catch {}
  connect();
})();''')
assert "/api/obs/auth" in conf_js
assert '$("status")' not in conf_js and "nav button" not in dash_js + conf_js

shared_nav_js = '''
// ---------- Navigation commune ----------
document.querySelectorAll("nav button").forEach(b => b.onclick = () => {
  document.querySelectorAll("nav button, main > section").forEach(x => x.classList.remove("on"));
  b.classList.add("on"); document.getElementById("tab-" + b.dataset.tab).classList.add("on");
  try { localStorage.setItem("bl_tab", b.dataset.tab); } catch {}
  if (b.dataset.tab === "chat") document.getElementById("chat").scrollTop = 1e9;
});
try { const t = localStorage.getItem("bl_tab"); if (t) document.querySelector(`nav button[data-tab="${t}"]`)?.click(); } catch {}
'''

header = between(dash, "<header>", "</header>").replace(
    '<div class="lights" id="lights"></div>',
    '<div class="lights"><span class="light" id="obsLight"><i></i>OBS</span><span id="lights" style="display:contents"></span></div>')
header = header.replace("<b>BL Hub</b>", "<b>BL Studio</b>")
header = header.replace('<span class="hint" id="uptime"></span>', '<span class="hint" id="uptime"></span><button class="btn small" title="Recharger" onclick="location.reload()">↻</button>')

app = f'''<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BL Studio</title>
<!-- Appli unique BL Studio : pilotage OBS (scènes, DA, widgets, textes, transitions) + Hub (stats, chat unifié,
     alertes, bot, mini-jeux, connexions). Servie par le BL Hub sur http://localhost:3939 (dock OBS « BL Studio »). -->
<script src="/theme.js"></script>
<style>{css}</style>
</head>
<body>
<header>{header}</header>
<div class="shell">
{nav}
<main>
{conf_main}
{dash_main}
</main>
</div>
<div class="toast" id="toast"></div>
<script>
// ===== Hub : stats, chat, alertes, bot, mini-jeux, classement, connexions =====
(() => {{
{dash_js}
}})();
// ===== OBS : scènes, DA, widgets, textes, transitions (obs-websocket) =====
(() => {{
{conf_js}
}})();
{shared_nav_js}
</script>
</body>
</html>
'''
open(ROOT + "hub/public/app.html", "w", encoding="utf-8").write(app)
print("ok", len(app))
