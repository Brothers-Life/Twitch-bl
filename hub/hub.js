// BL Hub : centralise Twitch, TikTok, YouTube et les dons, puis alimente les overlays OBS
// (alertes, chat unifié, mini-jeux, derniers soutiens) et le dashboard (http://localhost:3939).
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn, execFile } = require("child_process");
const { WebSocketServer } = require("ws");
const { load } = require("./lib/store");
const Twitch = require("./lib/twitch");
const TikTok = require("./lib/tiktok");
const YouTube = require("./lib/youtube");
const StreamElements = require("./lib/streamelements");
const Stats = require("./lib/stats");
const Bot = require("./lib/bot");
const Updater = require("./lib/updater");
const Games = require("./lib/games");

const PORT = 3939;
const ROOT = path.join(__dirname, "..");          // dossier BL Studio (overlays, logo, thèmes)
const PUBLIC = path.join(__dirname, "public");
const REDIRECT = `http://localhost:${PORT}/twitch/callback`;

const DEFAULT_CONFIG = {
  // identité de la chaîne : utilisée par l'onglet Identité de BL Studio pour personnaliser textes et widgets
  brand: { name: "Ma chaîne", tagline: "Lives & best-of", server: "", character: "", job: "", city: "",
           socials: { twitch: "", tiktok: "", youtube: "", discord: "", instagram: "", x: "" } },
  // appli Twitch de BL Studio (identifiant public, redirection http://localhost:3939/twitch/callback) : rien à créer
  twitch: { channel: "", clientId: "zzli7imha4fcvwbi0k9igiglbkeaw3", token: "" },
  // mises à jour : releases GitHub du dépôt, installées automatiquement hors live
  updates: { auto: true, repo: "Brothers-Life/bl-studio" },
  tiktok: { username: "" },
  youtube: { channel: "" },
  streamelements: { jwt: "" },
  alerts: {
    enabled: true, duration: 6, sound: true, volume: 0.6, tts: false,
    types: {
      follow:    { on: true,  min: 0, text: "{user} suit la chaîne !" },
      sub:       { on: true,  min: 0, text: "{user} s'abonne !" },
      giftsub:   { on: true,  min: 0, text: "{user} offre {amount} abonnement(s) !" },
      bits:      { on: true,  min: 1, text: "{user} envoie {amount} bits !" },
      raid:      { on: true,  min: 1, text: "Raid de {user} avec {amount} spectateurs !" },
      gift:      { on: true,  min: 1, text: "{user} envoie {amount}× {gift} !" },
      share:     { on: false, min: 0, text: "{user} partage le live !" },
      superchat: { on: true,  min: 0, text: "{user} : Super Chat de {amountText} !" },
      member:    { on: true,  min: 0, text: "{user} devient membre !" },
      donation:  { on: true,  min: 1, text: "{user} fait un don de {amount} {currency} !" },
    },
  },
  bot: {
    enabled: true, name: "BL Bot", pointsName: "points",
    rewards: { chat: 5, follow: 50, share: 20, sub: 500, perBit: 1, perDiamond: 2, perEuro: 100 },
    commands: [
      { cmd: "!discord", response: "Rejoins le Discord : discord.gg/ton-serveur", enabled: false, cooldown: 15 },
      { cmd: "!serveur", response: "On joue sur notre serveur RP, viens nous rejoindre !", enabled: true, cooldown: 15 },
      { cmd: "!uptime", response: "Le live dure depuis {uptime}", enabled: true, cooldown: 10 },
      { cmd: "!reseaux", response: "Twitch / TikTok / YouTube : ton_pseudo", enabled: true, cooldown: 15 },
      { cmd: "!perso", response: "Présente ton personnage dans l'onglet Identité de BL Studio", enabled: true, cooldown: 15 },
    ],
    timers: [
      { message: "Pense à follow pour ne rater aucun live !", minutes: 15, enabled: true },
      { message: "Gagne des points en discutant et tente ta chance avec !roulette <mise>", minutes: 25, enabled: true },
    ],
  },
  games: {
    name: "BL Bot", roulette: true, wheelGift: "",
    durations: { quiz: 30, course: 30, sondage: 60, devine: 120 },
    rewards: { quiz: 100, course: 200, devine: 150 },
    wheel: ["Accent marseillais 5 min", "Conduite sans GPS", "Je paye une tournée", "Pas de voiture 10 min", "Je danse en ville",
            "Je change de tenue", "Je parle en chuchotant", "Vente flash au concess", "Rien du tout 😅", "Je chante à la radio"],
    quiz: [
      { q: "Dans quelle ville fictive se passe GTA V ?", a: "los santos" },
      { q: "Cite un des 3 personnages principaux de GTA V", a: "michael|franklin|trevor" },
      { q: "Comment s'appelle le comté au nord de Los Santos ?", a: "blaine" },
      { q: "Quelle est la plus haute montagne de GTA V ?", a: "chiliad" },
      { q: "Que veut dire RP ?", a: "roleplay|role play|jeu de role" },
      { q: "Quel numéro on appelle pour la police aux USA ?", a: "911" },
      { q: "Quel studio a créé GTA ?", a: "rockstar" },
      { q: "En quelle année est sorti GTA V ?", a: "2013" },
      { q: "Comment s'appelle la police de Los Santos ?", a: "lspd" },
      { q: "Quel service soigne les blessés en RP ?", a: "ems|ambulance|hopital|medecin" },
      { q: "Combien de joueurs dans une équipe de foot ?", a: "11|onze" },
      { q: "Quelle ville de GTA est inspirée de Miami ?", a: "vice city" },
      { q: "Qui développe FiveM ?", a: "cfx" },
      { q: "Comment s'appelle l'aéroport de Los Santos ?", a: "lsia|los santos international" },
    ],
  },
};

class Hub {
  constructor() {
    this.config = load("config.json", DEFAULT_CONFIG);
    this.clients = new Set();
    this.stats = new Stats(this, load("stats.json", {}));
    this.bot = new Bot(this, load("points.json", {}));
    this.games = new Games(this);
    this.twitch = new Twitch(this);
    this.tiktok = new TikTok(this);
    this.youtube = new YouTube(this);
    this.se = new StreamElements(this);
    this.updater = new Updater(this, ROOT);
    this.recentChat = [];
    this.nextId = 1;
  }

  broadcast(msg) {
    const data = JSON.stringify(msg);
    for (const c of this.clients) if (c.readyState === 1) c.send(data);
  }

  status() {
    return { twitch: this.twitch.status, tiktok: this.tiktok.status, youtube: this.youtube.status, streamelements: this.se.status };
  }

  broadcastStatus() { this.broadcast({ kind: "status", status: this.status() }); }

  // point d'entrée de tous les événements, quelle que soit la plateforme
  emit(e, { silent = false } = {}) {
    e.id = this.nextId++;
    e.ts = Date.now();
    if (!silent) {
      this.stats.record(e);
      this.bot.reward(e);
    }
    if (e.type === "chat") {
      this.recentChat.push(e);
      if (this.recentChat.length > 200) this.recentChat.shift();
    }
    this.broadcast({ kind: "event", event: e });
    if (!silent) {
      this.alert(e);
      this.bot.handle(e);
      this.games.handle(e);
    }
  }

  alert(e) {
    const a = this.config.data.alerts;
    const t = a.types[e.type];
    if (!a.enabled || !t || !t.on) return;
    const value = e.type === "gift" ? e.value : e.amount;
    if (t.min && (value || 0) < t.min) return;
    const text = t.text.replace(/\{(\w+)\}/g, (_, k) => (e[k] ?? ""));
    this.broadcast({ kind: "alert", alert: { ...e, text, duration: a.duration, sound: a.sound, volume: a.volume, tts: a.tts } });
  }

  publicConfig() {
    const c = JSON.parse(JSON.stringify(this.config.data));
    c.twitch.hasToken = !!c.twitch.token; c.twitch.token = "";
    c.streamelements.hasJwt = !!c.streamelements.jwt; c.streamelements.jwt = "";
    c.twitch.redirect = REDIRECT;
    c.twitch.login = this.twitch.user?.login || "";
    return c;
  }

  state() {
    return { config: this.publicConfig(), status: this.status(), stats: this.stats.snapshot(),
      leaderboard: this.bot.leaderboard(20), game: this.games.view(), chat: this.recentChat.slice(-100), update: this.updater.state };
  }

  restart(section) {
    const map = { twitch: this.twitch, tiktok: this.tiktok, youtube: this.youtube, streamelements: this.se };
    if (map[section]) map[section].start();
  }

  startAll() { for (const s of ["twitch", "tiktok", "youtube", "streamelements"]) this.restart(s); }
}

const hub = new Hub();

// ---------- HTTP ----------
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".png": "image/png",
  ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webm": "video/webm", ".json": "application/json", ".mp3": "audio/mpeg", ".wav": "audio/wav" };

function sendFile(res, file, range) {
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("Introuvable"); }
    const type = TYPES[path.extname(file)] || "application/octet-stream";
    // requêtes partielles : nécessaires pour que les vidéos (aperçus de stingers) puissent boucler et être parcourues
    const m = /^bytes=(\d*)-(\d*)$/.exec(range || "");
    if (m && (m[1] || m[2])) {
      const start = m[1] ? +m[1] : Math.max(0, buf.length - +m[2]);
      const end = m[1] && m[2] ? Math.min(+m[2], buf.length - 1) : buf.length - 1;
      if (start > end) { res.writeHead(416, { "Content-Range": `bytes */${buf.length}` }); return res.end(); }
      res.writeHead(206, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Range": `bytes ${start}-${end}/${buf.length}`, "Cache-Control": "no-cache" });
      return res.end(buf.subarray(start, end + 1));
    }
    res.writeHead(200, { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "no-cache" });
    res.end(buf);
  });
}

function safeJoin(base, rel) {
  const p = path.normalize(path.join(base, decodeURIComponent(rel)));
  if (!p.startsWith(base)) return null;
  // le dossier du Hub (jetons dans data/config.json) n'est jamais servi, sauf public/
  if ((p === __dirname || p.startsWith(__dirname + path.sep)) && !p.startsWith(PUBLIC + path.sep)) return null;
  return p;
}

function readBody(req) {
  return new Promise(resolve => {
    let s = "";
    req.on("data", c => (s += c));
    req.on("end", () => { try { resolve(JSON.parse(s || "{}")); } catch { resolve({}); } });
  });
}

const json = (res, obj, code = 200) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };

const TEST_EVENTS = {
  follow: { platform: "twitch", user: "Viewer_Test" },
  sub: { platform: "twitch", user: "Abonné_Test", tier: "1000", months: 3 },
  giftsub: { platform: "twitch", user: "Généreux_Test", amount: 5 },
  bits: { platform: "twitch", user: "Bits_Test", amount: 500, message: "Gros live !" },
  raid: { platform: "twitch", user: "Streamer_Test", amount: 42 },
  gift: { platform: "tiktok", user: "TikToker_Test", gift: "Rose", amount: 10, value: 10 },
  share: { platform: "tiktok", user: "Partage_Test" },
  superchat: { platform: "youtube", user: "YouTubeur_Test", amount: 5, amountText: "5,00 €", message: "Force à toi !" },
  member: { platform: "youtube", user: "Membre_Test" },
  donation: { platform: "streamelements", user: "Donateur_Test", amount: 10, currency: "EUR", message: "Merci pour le live !" },
  chat: { platform: "tiktok", user: "Test", message: "Salut le live !" },
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;

  // le configurateur (dock OBS en file://) peut seulement demander un stinger perso
  if (p === "/api/stinger" && (req.headers.origin === "null" || req.headers.origin?.startsWith("file://"))) {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-BL");
    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  }

  if (req.method === "GET") {
    if (p === "/" || p === "/dashboard" || p === "/studio") return sendFile(res, path.join(PUBLIC, "app.html"));
    if (p === "/classic") return sendFile(res, path.join(PUBLIC, "dashboard.html"));
    if (p === "/api/obs/auth") {
      // mot de passe obs-websocket lu dans la config locale d'OBS ; en-tête maison exigé (illisible depuis un autre site)
      if (req.headers["x-bl"] !== "1") return json(res, { error: "refusé" }, 403);
      try {
        const c = JSON.parse(fs.readFileSync(path.join(process.env.APPDATA, "obs-studio", "plugin_config", "obs-websocket", "config.json"), "utf8"));
        return json(res, { enabled: !!c.server_enabled, port: c.server_port || 4455, password: c.auth_required ? c.server_password : "" });
      } catch { return json(res, { enabled: false }); }
    }
    if (p === "/twitch/callback") return sendFile(res, path.join(PUBLIC, "twitch-callback.html"));
    if (p === "/api/state") return json(res, hub.state());
    if (p === "/api/paths") {
      // dossier d'installation (les sources OBS pointent vers file:///<dossier>/widget.html…)
      const root = ROOT.split(path.sep).join("/");
      return json(res, { root, fileBase: "file:///" + root + "/" });
    }
    if (p === "/api/twitch/auth") {
      if (!hub.config.data.twitch.clientId) return json(res, { error: "Client ID manquant" }, 400);
      res.writeHead(302, { Location: hub.twitch.authUrl(REDIRECT) }); return res.end();
    }
    if (p.startsWith("/public/")) { const f = safeJoin(PUBLIC, p.slice(8)); return f ? sendFile(res, f) : json(res, {}, 403); }
    const f = safeJoin(ROOT, p.slice(1));            // overlays et fichiers du dossier BL Studio
    return f ? sendFile(res, f, req.headers.range) : json(res, {}, 403);
  }

  if (req.method === "POST") {
    // en-tête maison obligatoire : une page web externe ne peut pas l'envoyer sans autorisation CORS
    if (req.headers["x-bl"] !== "1") return json(res, { error: "refusé" }, 403);
    const body = await readBody(req);
    if (p === "/api/config") {
      // { section: "tiktok", data: {...} } — les tableaux sont remplacés, les objets fusionnés
      const sec = body.section;
      if (!(sec in hub.config.data)) return json(res, { error: "section inconnue" }, 400);
      const data = { ...body.data };
      if (sec === "twitch" && !data.token) delete data.token;
      if (sec === "streamelements" && !data.jwt) delete data.jwt;
      for (const k of ["hasToken", "hasJwt", "redirect", "login"]) delete data[k];
      hub.config.data[sec] = { ...hub.config.data[sec], ...data };
      hub.config.flush();
      hub.restart(sec);
      return json(res, { ok: true, state: hub.state() });
    }
    if (p === "/api/twitch/token") {
      hub.config.data.twitch.token = body.token || "";
      hub.config.flush();
      await hub.twitch.start();
      return json(res, { ok: true, login: hub.twitch.user?.login || "" });
    }
    if (p === "/api/twitch/logout") { hub.config.data.twitch.token = ""; hub.config.flush(); hub.twitch.start(); return json(res, { ok: true }); }
    if (p === "/api/reconnect") { hub.restart(body.section); return json(res, { ok: true }); }
    if (p === "/api/test") {
      const base = TEST_EVENTS[body.type];
      if (!base) return json(res, { error: "type inconnu" }, 400);
      hub.emit({ type: body.type, ...base, ...(body.data || {}) });
      return json(res, { ok: true });
    }
    if (p === "/api/say") {
      const sent = hub.twitch.say(body.text || "");
      hub.emit({ type: "chat", platform: "bot", user: hub.twitch.user?.login || "Toi", message: body.text, replyTo: "twitch", sent }, { silent: true });
      return json(res, { ok: true, sent });
    }
    if (p === "/api/game") {
      if (body.action === "stop") hub.games.stop(); else hub.games.start(body.action, body.options || {});
      return json(res, { ok: true });
    }
    if (p === "/api/points") {
      if (body.action === "reset") { hub.bot.points.data = {}; hub.bot.points.flush(); }
      if (body.action === "add") hub.bot.addPoints(body.platform, body.user, +body.amount || 0);
      return json(res, { ok: true, leaderboard: hub.bot.leaderboard(20) });
    }
    if (p === "/api/stats/reset") { hub.stats.reset(); return json(res, { ok: true }); }
    if (p === "/api/stinger") return makeStinger(body, res);
    if (p === "/api/update/check") return json(res, await hub.updater.check());
    if (p === "/api/update/install") { hub.updater.install(); return json(res, { ok: true }); }
    if (p === "/api/logo") {
      // logo envoyé depuis BL Studio (data URL PNG/JPEG/WebP) → logo.png, utilisé par tous les widgets
      const m = String(body.dataUrl || "").match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
      if (!m) return json(res, { error: "image invalide" }, 400);
      const buf = Buffer.from(m[2], "base64");
      if (buf.length > 8 * 1024 * 1024) return json(res, { error: "image trop lourde (8 Mo max)" }, 400);
      const dest = path.join(ROOT, "logo.png"), backup = path.join(ROOT, "logo-original.png");
      if (!fs.existsSync(backup) && fs.existsSync(dest)) fs.copyFileSync(dest, backup);
      fs.writeFileSync(dest, buf);
      return json(res, { ok: true });
    }
    return json(res, { error: "route inconnue" }, 404);
  }
  res.writeHead(405); res.end();
});

// génère une transition stinger (outils/stinger.py + ffmpeg) : style au choix, couleurs d'un thème ou d'une DA perso
const STINGER_STYLES = ["bandes", "volets", "iris", "glitch", "eclat", "pixels"];
const stingerJobs = new Map();
function makeStinger(body, res) {
  const style = STINGER_STYLES.includes(body.style) ? body.style : "bandes";
  const args = ["--style", style, "--text", String(hub.config.data.brand?.name || "").slice(0, 40)];
  let name;
  if (body.theme) {
    if (!/^[a-z0-9]{1,24}$/.test(body.theme)) return json(res, { error: "thème invalide" }, 400);
    name = body.theme; args.push(name);
  } else {
    const colors = ["c1", "c2", "c3", "bg1", "bg2"].map(k => String(body[k] || "").replace("#", ""));
    if (!colors.every(c => /^[0-9a-f]{6}$/i.test(c))) return json(res, { error: "couleurs invalides" }, 400);
    name = "custom_" + colors.join("").toLowerCase().slice(0, 18);
    args.push("--name", name, "--colors", colors.join(","));
  }
  const file = (style === "bandes" ? "" : style + "_") + name;
  const out = path.join(ROOT, "transitions", `stinger_${file}_9x16.webm`);
  if (fs.existsSync(out) && !body.force) return json(res, { ok: true, name: file });
  // une seule génération à la fois par fichier : les demandes suivantes attendent la même
  if (!stingerJobs.has(file)) {
    stingerJobs.set(file, new Promise(done => {
      const py = spawn("python", ["-I", path.join(ROOT, "outils", "stinger.py"), ...args], { windowsHide: true });
      py.on("close", code => { stingerJobs.delete(file); done(code === 0); });
      py.on("error", () => { stingerJobs.delete(file); done(false); });
    }));
  }
  stingerJobs.get(file).then(ok => json(res, ok ? { ok: true, name: file } : { error: "échec de génération (Python, Pillow et ffmpeg requis)" }, ok ? 200 : 500));
}

// ---------- WebSocket (overlays + dashboard) ----------
// seuls les overlays locaux (file://), OBS et le dashboard peuvent se connecter
const allowedOrigin = o => !o || o === "null" || o.startsWith("file://") || /^https?:\/\/(localhost|127\.0\.0\.1):3939$/.test(o);
const wss = new WebSocketServer({ server, path: "/ws", verifyClient: ({ origin }) => allowedOrigin(origin) });
wss.on("connection", ws => {
  hub.clients.add(ws);
  ws.send(JSON.stringify({ kind: "hello", game: hub.games.view(), status: hub.status(), chat: hub.recentChat.slice(-30), recent: hub.stats.session.recent.slice(0, 10), update: hub.updater.state }));
  ws.on("close", () => hub.clients.delete(ws));
  ws.on("error", () => {});
});

// après une mise à jour, le nouveau Hub attend que l'ancien libère le port
const RESTARTED = process.argv.includes("--restart");
let portTries = 0;
server.on("error", e => {
  if (e.code === "EADDRINUSE" && RESTARTED && portTries++ < 40) return setTimeout(() => server.listen(PORT, "127.0.0.1"), 500);
  if (e.code === "EADDRINUSE") { console.log(`BL Hub tourne déjà sur le port ${PORT}.`); process.exit(0); }
  throw e;
});
// relancé hors d'OBS (mise à jour) : on s'arrête quand OBS se ferme, comme le Hub lancé par le script OBS
if (RESTARTED) {
  let missing = 0;
  setInterval(() => execFile("tasklist", ["/FI", "IMAGENAME eq obs64.exe", "/NH"], { windowsHide: true }, (err, out) => {
    missing = !err && !/obs64\.exe/i.test(out) ? missing + 1 : 0;
    if (missing >= 2) { hub.config.flush(); hub.bot.points.flush(); process.exit(0); }
  }), 30000);
}

server.listen(PORT, "127.0.0.1", () => {
  console.log(`BL Hub prêt : http://localhost:${PORT}`);
  hub.startAll();
  hub.updater.start();
});

process.on("uncaughtException", e => console.error("Erreur :", e.message));
process.on("unhandledRejection", e => console.error("Erreur :", e?.message || e));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { hub.config.flush(); hub.bot.points.flush(); process.exit(0); });
