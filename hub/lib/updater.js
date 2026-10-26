// Mises à jour automatiques depuis les releases GitHub : vérifie la dernière version, télécharge le zip,
// remplace les fichiers de BL Studio sans toucher aux données perso, puis redémarre le Hub.
const fs = require("fs");
const os = require("os");
const path = require("path");
const https = require("https");
const { spawn, execFile } = require("child_process");

// jamais écrasés par une mise à jour (réglages, jetons, points, logo, stingers générés…)
const KEEP = [/^hub\/data\//, /^logo\.png$/, /^logo-original\.png$/, /^nowplaying\.js$/, /^transitions\/stinger_custom_/];
const CHECK_EVERY = 6 * 3600 * 1000;

function get(url, { json = false, file = null, hops = 5 } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "BL-Studio-Updater", Accept: json ? "application/vnd.github+json" : "application/octet-stream" } }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && hops > 0) {
        res.resume();
        return resolve(get(new URL(res.headers.location, url).toString(), { json, file, hops: hops - 1 }));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`GitHub a répondu ${res.statusCode}`)); }
      if (file) {
        const out = fs.createWriteStream(file);
        res.pipe(out);
        out.on("finish", () => out.close(() => resolve(file)));
        out.on("error", reject);
        return;
      }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", c => (body += c));
      res.on("end", () => { try { resolve(json ? JSON.parse(body) : body); } catch (e) { reject(e); } });
    });
    req.on("error", reject);
    req.setTimeout(30000, () => req.destroy(new Error("délai dépassé")));
  });
}

// « 1.10.0 » > « 1.9.3 »
function newer(a, b) {
  const pa = String(a).replace(/^v/, "").split(".").map(Number), pb = String(b).replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  return false;
}

function walk(dir, base = dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    e.isDirectory() ? walk(p, base, out) : out.push(path.relative(base, p).split(path.sep).join("/"));
  }
  return out;
}

class Updater {
  constructor(hub, root) {
    this.hub = hub;
    this.root = root;
    this.state = { current: this.version(), latest: null, available: false, notes: "", checkedAt: 0, installing: false, error: "" };
  }

  version() {
    try { return JSON.parse(fs.readFileSync(path.join(this.root, "version.json"), "utf8")).version; } catch { return "0.0.0"; }
  }

  get cfg() { return this.hub.config.data.updates; }

  publish() { this.hub.broadcast({ kind: "update", update: this.state }); }

  async check() {
    try {
      const r = await get(`https://api.github.com/repos/${this.cfg.repo}/releases/latest`, { json: true });
      const asset = (r.assets || []).find(a => /^bl-studio.*\.zip$/i.test(a.name));
      this.state.latest = String(r.tag_name || "").replace(/^v/, "");
      this.state.notes = String(r.body || "").slice(0, 2000);
      this.state.asset = asset?.browser_download_url || "";
      this.state.available = !!asset && newer(this.state.latest, this.state.current);
      this.state.error = "";
    } catch (e) {
      this.state.error = `Vérification impossible : ${e.message}`;
    }
    this.state.checkedAt = Date.now();
    this.publish();
    return this.state;
  }

  async install() {
    if (this.state.installing) return this.state;
    if (!this.state.available) await this.check();
    if (!this.state.available) return this.state;
    this.state.installing = true; this.state.error = ""; this.publish();
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bl-studio-maj-"));
    try {
      const zip = await get(this.state.asset, { file: path.join(tmp, "maj.zip") });
      const dir = path.join(tmp, "fichiers");
      await new Promise((resolve, reject) => execFile("powershell", ["-NoProfile", "-NonInteractive", "-Command",
        `Expand-Archive -LiteralPath '${zip.replace(/'/g, "''")}' -DestinationPath '${dir.replace(/'/g, "''")}' -Force`],
        { windowsHide: true, timeout: 180000 }, err => (err ? reject(new Error("décompression impossible")) : resolve())));
      const files = walk(dir).filter(f => !KEEP.some(k => k.test(f)));
      if (!files.includes("version.json") || !files.includes("hub/hub.js")) throw new Error("archive incomplète");
      for (const f of files) {
        const dest = path.join(this.root, ...f.split("/"));
        // transitions déjà présentes (souvent régénérées avec le logo de la chaîne) : on n'ajoute que les nouvelles
        if (f.startsWith("transitions/") && fs.existsSync(dest)) continue;
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(path.join(dir, ...f.split("/")), dest);
      }
      this.state.current = this.version();
      this.state.available = false;
      this.state.restarting = true;
      this.publish();
      console.log(`Mise à jour ${this.state.current} installée, redémarrage du Hub…`);
      setTimeout(() => this.restart(), 800);
    } catch (e) {
      this.state.installing = false;
      this.state.error = `Mise à jour échouée : ${e.message}`;
      this.publish();
    } finally {
      setTimeout(() => fs.rm(tmp, { recursive: true, force: true }, () => {}), 5000);
    }
    return this.state;
  }

  // relance un Hub neuf (il attend que le port se libère) puis quitte celui-ci
  restart() {
    try { this.hub.config.flush(); this.hub.bot.points.flush(); } catch {}
    spawn(process.execPath, [path.join(__dirname, "..", "hub.js"), "--restart"],
      { cwd: path.join(__dirname, ".."), detached: true, stdio: "ignore", windowsHide: true }).unref();
    process.exit(0);
  }

  async tick() {
    await this.check();
    // installation automatique seulement hors live, pour ne jamais couper un stream
    if (this.state.available && this.cfg.auto && !this.hub.twitch.live) await this.install();
  }

  start() {
    if (!this.cfg.repo) return;
    setTimeout(() => this.tick(), 20000);
    setInterval(() => this.tick(), CHECK_EVERY);
  }
}

module.exports = Updater;
