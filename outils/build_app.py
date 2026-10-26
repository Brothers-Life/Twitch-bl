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
# commentaires retirés (sinon ils collent au sélecteur suivant), animations @keyframes gardées telles quelles
conf_css = re.sub(r"/\*.*?\*/", "", conf_css, flags=re.S)
keep = re.findall(r"@keyframes [\w-]+\s*\{(?:[^{}]*\{[^{}]*\})*\s*\}", conf_css)
conf_css = re.sub(r"@keyframes [\w-]+\s*\{(?:[^{}]*\{[^{}]*\})*\s*\}", "", conf_css)
for rule in re.findall(r"[^{}]+\{[^{}]*\}", conf_css):
    sel = rule.split("{")[0].strip()
    if any(sel.startswith(k) for k in (".grid", ".scene", ".theme", ".sw", ".item", ".eye", ".toggles", "details summary", ".stylecard", ".preview", ".wstyle-row",
                                       ".packs", ".pack", ".bgprev", ".stingers", ".stingercard", ".dest", ".onair",
                                       ".np", ".ctrl", ".counters", ".counterbox", ".tpl", ".swrow",
                                       ".mixer", ".meter", ".chips", ".chip2", ".scenechecks", ".groups", ".luma", ".scenetiles", ".stile", ".pad", ".libgrid", ".libitem", ".sdgroup", ".sdrow", ".eqrow")):
        keep.append(rule.strip())
extra_css = """
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 6px; }
  nav .sep { width: 1px; background: var(--line); margin: 8px 4px; flex: none; }
  nav .grp { font-size: 10px; color: var(--mute); text-transform: uppercase; letter-spacing: .1em; align-self: center; padding: 0 4px 0 8px; white-space: nowrap; }
  .obs-note { display: none; background: rgba(229,72,77,.1); border: 1px solid rgba(229,72,77,.4); color: #f3b5b7; border-radius: 8px; padding: 10px; margin-bottom: 10px; }
  body:not(.obs-on) .needs-obs .obs-note { display: block; }
  body:not(.obs-on) .needs-obs .obs-body { opacity: .35; pointer-events: none; }
  .row > label { flex: 0 0 150px; }

  /* ===== BL Studio v2 : coque (barre latérale + barre du haut) aux couleurs de la DA (variables posées par paintStudio) ===== */
  :root { --font-ui: "Bahnschrift", "DIN Alternate", "Segoe UI", sans-serif;
    --hi: #fae664; --acc: #de9425; --acc2: #cc4308; --tb1: #1a0b06; --tb2: #070302; --on-acc: #1a0f05;
    --bg: color-mix(in srgb, var(--tb2) 50%, #141519);
    --panel: color-mix(in srgb, var(--tb1) 28%, #1c1e23);
    --panel2: color-mix(in srgb, var(--tb1) 24%, #25282f);
    --line: color-mix(in srgb, var(--acc) 10%, #2c2f36);
    --field: color-mix(in srgb, var(--tb2) 55%, #0f1013);
    --txt: #eceef2; --mute: #959ba6; --side: 236px; --top: 60px; }
  html, body { font: 13px/1.5 var(--font-ui); background: var(--bg); color: var(--txt); }
  body { min-height: 100vh; }
  .shell { display: grid; grid-template-columns: var(--side) minmax(0, 1fr); min-height: 100vh; }

  /* barre latérale */
  .side { position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; min-width: 0;
    background: color-mix(in srgb, var(--bg) 72%, #000); border-right: 1px solid var(--line); }
  .brand { display: flex; align-items: center; gap: 11px; padding: 16px 16px 12px; min-width: 0; }
  .brand img { width: 38px; height: 38px; border-radius: 10px; object-fit: cover; flex: none; }
  .brand div { min-width: 0; }
  .brand b { display: block; font-size: 16px; font-weight: 700; line-height: 1.15; }
  .brand small { display: block; color: var(--mute); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .side nav { flex: 1; display: flex; flex-direction: column; gap: 1px; padding: 2px 10px 14px; overflow: hidden auto;
    position: static; height: auto; border: 0; background: none; scrollbar-width: thin; scrollbar-color: var(--line) transparent; }
  .side nav::-webkit-scrollbar { width: 6px; }
  .side nav::-webkit-scrollbar-thumb { background: var(--line); border-radius: 3px; }
  .side nav::-webkit-scrollbar-track { background: transparent; }
  nav .grp { padding: 14px 10px 4px; font-size: 11.5px; font-weight: 600; color: var(--mute); text-transform: none; letter-spacing: 0; align-self: stretch; }
  nav .sep { display: none; }
  nav button { display: flex; align-items: center; gap: 11px; width: 100%; padding: 7px 10px; border: 0; border-radius: 8px; position: relative;
    background: none; color: var(--mute); font-size: 13.5px; text-align: left; cursor: pointer; white-space: nowrap; }
  nav button svg { width: 18px; height: 18px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  nav button:hover { color: var(--txt); background: rgba(255,255,255,.045); }
  nav button.on { color: var(--txt); font-weight: 600; background: color-mix(in srgb, var(--acc) 15%, transparent); }
  nav button.on svg { color: var(--acc); }
  nav button.on::before { content: ""; position: absolute; left: -10px; top: 6px; bottom: 6px; width: 3px; border-radius: 0 3px 3px 0;
    background: linear-gradient(var(--hi), var(--acc) 45%, var(--acc2)); }
  .sidefoot { border-top: 1px solid var(--line); padding: 10px 14px 12px; display: grid; gap: 9px; }
  .sidefoot .lights { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 10px; margin: 0; }
  .light { background: none; padding: 0; border-radius: 0; font-size: 11.5px; color: var(--mute); gap: 6px; white-space: nowrap; overflow: hidden; }
  .light i { width: 7px; height: 7px; flex: none; }
  .sidefoot .ver { display: flex; align-items: center; gap: 6px; color: var(--mute); font-size: 11.5px; }
  .iconbtn { width: 28px; height: 28px; border-radius: 7px; border: 1px solid var(--line); background: var(--panel); color: var(--txt); cursor: pointer; flex: none; }
  .iconbtn:hover { border-color: var(--acc); }
  .sidefoot .ver .iconbtn:first-of-type { margin-left: auto; }

  /* barre du haut */
  .mainwrap { min-width: 0; display: flex; flex-direction: column; }
  .topbar { position: sticky; top: 0; z-index: 6; height: var(--top); display: flex; align-items: center; gap: 14px; padding: 0 26px;
    background: color-mix(in srgb, var(--bg) 86%, transparent); backdrop-filter: blur(10px); border-bottom: 1px solid var(--line); }
  .topbar::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px;
    background: linear-gradient(90deg, var(--acc) 0 62%, var(--acc2) 62% 86%, var(--hi) 86%); }
  .topbar h1 { margin: 0; font-size: 19px; font-weight: 700; font-stretch: semi-condensed; white-space: nowrap; }
  .topbar .grow { flex: 1; }
  .scenechip { color: var(--mute); font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .scenechip b { color: var(--txt); font-weight: 600; }
  .livepill { display: inline-flex; align-items: center; gap: 8px; padding: 5px 12px; border-radius: 99px; white-space: nowrap;
    background: var(--panel); border: 1px solid var(--line); color: var(--mute); font-weight: 600; font-variant-numeric: tabular-nums; }
  .livepill::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: #5a5f69; }
  .livepill.on { color: #fff; background: color-mix(in srgb, var(--ko) 20%, var(--panel)); border-color: color-mix(in srgb, var(--ko) 55%, transparent); }
  .livepill.on::before { background: var(--ko); box-shadow: 0 0 8px var(--ko); animation: blpulse 1.4s ease-in-out infinite; }
  @keyframes blpulse { 50% { opacity: .3; } }
  #topGo.stop { background: var(--ko); color: #fff; }
  main { padding: 22px 26px 48px; max-width: 1320px; width: 100%; margin: 0; }

  /* composants */
  h3 { margin: 26px 0 10px; font-size: 15px; font-weight: 700; font-stretch: semi-condensed; text-transform: none; letter-spacing: 0; color: var(--txt); }
  h3:first-child, .card > h3:first-child { margin-top: 0; }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; margin-bottom: 10px; }
  .hint { color: var(--mute); }
  .btn { background: var(--panel2); border: 1px solid var(--line); border-radius: 8px; padding: 7px 14px; transition: border-color .15s, background-color .15s; }
  .btn:hover { border-color: var(--acc); }
  .btn.primary { background: var(--acc); color: var(--on-acc); border: 1px solid var(--acc); font-weight: 700; }
  .btn.primary:hover { background: color-mix(in srgb, var(--acc) 84%, #fff); }
  .btn.small { padding: 4px 10px; border-radius: 7px; }
  input[type=text], input[type=password], input[type=number], select, textarea { background: var(--field); border: 1px solid var(--line); border-radius: 8px; padding: 7px 10px; }
  input[type=checkbox], input[type=range] { accent-color: var(--acc); }
  :is(button, .btn, input, select, textarea, summary, .theme, .stylecard, .pack, .tplcard):focus-visible { outline: 2px solid var(--hi); outline-offset: 2px; }
  .theme { background: var(--panel); border-color: var(--line); }
  .theme.on, .stylecard.on, .stingercard.on, .tplcard.on { border-color: var(--acc); box-shadow: 0 0 0 1px var(--acc) inset; }
  .stylecard { background: var(--field); border-color: var(--line); }
  .eye.on { background: color-mix(in srgb, var(--acc) 22%, transparent); border-color: var(--acc); }
  .scene.live { border-color: var(--ko); box-shadow: inset 4px 0 0 var(--ko); }
  .stat .k, th { text-transform: none; letter-spacing: 0; font-size: 12px; }
  .list .val { color: var(--hi); }
  .cm.ev { background: color-mix(in srgb, var(--acc) 10%, transparent); border-left-color: var(--acc); }
  .toast { background: var(--panel2); color: var(--txt); border: 1px solid var(--acc); border-radius: 10px; padding: 10px 18px; box-shadow: 0 10px 30px rgba(0,0,0,.45); }
  .tag.bot { background: var(--acc); color: var(--on-acc); }

  /* dock OBS étroit : rail d'icônes */
  @media (max-width: 760px) {
    .shell { grid-template-columns: 56px minmax(0, 1fr); }
    .brand { justify-content: center; padding: 12px 0; }
    .brand div, nav .grp, nav button span, .sidefoot .lights, .sidefoot .ver span { display: none; }
    .side nav { padding: 2px 6px 10px; }
    nav button { justify-content: center; padding: 9px 0; }
    nav button.on::before { left: -6px; }
    nav .sep { display: block; height: 1px; margin: 6px 6px; background: var(--line); }
    .sidefoot { padding: 8px 6px; justify-items: center; }
    .sidefoot .ver { flex-direction: column; }
    .sidefoot .ver .iconbtn:first-of-type { margin-left: 0; }
    .topbar { padding: 0 12px; gap: 8px; }
    .topbar h1 { font-size: 16px; }
    .scenechip { display: none; }
    main { padding: 14px 12px 40px; }
    .row > label { flex-basis: 110px; }
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
  "sons": '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><path d="M15 14v5M17.5 15.5v2M13 16v1M20 16v1"/>',
  "logs": '<path d="M4 5h16v14H4z"/><path d="M7 9l3 3-3 3M12 15h5"/>',
  "streamdeck": '<rect x="3" y="5" width="18" height="14" rx="2.5"/><rect x="6" y="8" width="3" height="3" rx=".5"/><rect x="10.5" y="8" width="3" height="3" rx=".5"/><rect x="15" y="8" width="3" height="3" rx=".5"/><rect x="6" y="13" width="3" height="3" rx=".5"/><rect x="10.5" y="13" width="3" height="3" rx=".5"/><rect x="15" y="13" width="3" height="3" rx=".5"/>',
  "diffusion": '<circle cx="12" cy="12" r="2"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/>',
  "stats": '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
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
  '  <span class="grp">Live</span>', nb("stats", "Tableau de bord", True), nb("scenes", "Scènes"), nb("diffusion", "Diffusion"), nb("musique", "Musique"), nb("audio", "Audio"), nb("sons", "Sons"), nb("chat", "Chat"),
  '  <span class="sep"></span><span class="grp">Communauté</span>', nb("alerts", "Alertes"), nb("bot", "Bot"), nb("games", "Mini-jeux"), nb("board", "Classement"),
  '  <span class="sep"></span><span class="grp">Design</span>', nb("identite", "Identité"), nb("da", "DA & animations"), nb("widgets", "Widgets"), nb("textes", "Textes"), nb("transitions", "Transitions"),
  '  <span class="sep"></span><span class="grp">Réglages</span>', nb("streamdeck", "Stream Deck"), nb("conn", "Connexions"), nb("logs", "Journal"),
  "</nav>"])

# onglet de départ : Scènes (on retire "on" de Stats)
# onglet de départ : tableau de bord (déjà « on » dans le dashboard)

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
  document.getElementById("pageTitle").textContent = b.querySelector("span")?.textContent || "";
  dispatchEvent(new CustomEvent("bl-tab", { detail: b.dataset.tab }));
  window.scrollTo(0, 0);
  try { localStorage.setItem("bl_tab", b.dataset.tab); } catch {}
  if (b.dataset.tab === "chat") document.getElementById("chat").scrollTop = 1e9;
});
try { const t = localStorage.getItem("bl_tab"); if (t) document.querySelector(`nav button[data-tab="${t}"]`)?.click(); } catch {}
// nom de la chaîne et version dans la barre latérale
fetch("/api/state").then(r => r.json()).then(st => {
  document.getElementById("brandName").textContent = st.config.brand?.name || "Ma chaîne";
  document.getElementById("appVer").textContent = "Version " + (st.update?.current || "?");
}).catch(() => {});
'''

side_top = '''<div class="brand"><img src="/logo.png" alt=""><div><b>BL Studio</b><small id="brandName">Ma chaîne</small></div></div>'''
side_foot = '''<div class="sidefoot">
  <div class="lights"><span class="light" id="obsLight"><i></i>OBS</span><span id="lights" style="display:contents"></span></div>
  <div class="ver"><span id="appVer"></span><span class="hint" id="uptime" hidden></span>
    <button class="iconbtn" id="updBtn" title="Mise à jour disponible" hidden>⬆</button>
    <button class="iconbtn" title="Recharger BL Studio" onclick="location.reload()">↻</button></div>
</div>'''
topbar = '''<header class="topbar"><h1 id="pageTitle">Tableau de bord</h1><span class="grow"></span>
  <span class="scenechip" id="sceneChip"></span><span class="livepill" id="livePill">Hors ligne</span>
  <button class="btn primary" id="topGo">Lancer le live</button></header>'''

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
<div class="shell">
<aside class="side">
{side_top}
{nav}
{side_foot}
</aside>
<div class="mainwrap">
{topbar}
<main>
{conf_main}
{dash_main}
</main>
</div>
</div>
<div id="updBanner" hidden title="Voir le détail"><b>Mise à jour de BL Studio</b><div class="updbar"><i id="updBanBar"></i></div><span class="hint" id="updBanStep"></span></div>
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
