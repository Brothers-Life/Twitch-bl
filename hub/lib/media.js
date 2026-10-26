// Musique en cours, quelle que soit l'appli (Spotify, Deezer, YouTube Music, Apple Music, Tidal, navigateur…),
// lue par hub/media/bl-media.exe via les contrôles média de Windows. Choisit la session selon les réglages,
// diffuse le morceau aux widgets et à BL Studio, et relaie la télécommande (lecture, pause, suivant…).
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const EXE = path.join(__dirname, "..", "media", "bl-media.exe");

// reconnaissance de l'appli à partir de son identifiant Windows
const APPS = [
  ["spotify", /spotify/i, "Spotify", "#1DB954"],
  ["deezer", /deezer/i, "Deezer", "#A238FF"],
  ["youtube", /youtube/i, "YouTube Music", "#FF0033"],
  ["apple", /apple|itunes/i, "Apple Music", "#FA243C"],
  ["tidal", /tidal/i, "Tidal", "#00D1D1"],
  ["soundcloud", /soundcloud/i, "SoundCloud", "#FF5500"],
  ["amazon", /amazon/i, "Amazon Music", "#25D1DA"],
  ["vlc", /vlc/i, "VLC", "#FF8800"],
  ["browser", /chrome|msedge|edge|firefox|opera|brave|vivaldi/i, "Navigateur", "#8A8F98"],
];
const appOf = id => {
  const a = APPS.find(([, re]) => re.test(id || ""));
  return a ? { key: a[0], label: a[2], color: a[3] } : { key: "autre", label: String(id || "Lecteur").replace(/\.exe$/i, ""), color: "#8A8F98" };
};
const MUSIC_APPS = new Set(["spotify", "deezer", "youtube", "apple", "tidal", "soundcloud", "amazon"]);

class Media {
  constructor(hub) {
    this.hub = hub;
    this.proc = null;
    this.sessions = [];
    this.current = null;
    this.covers = new Map();      // id → data URL
    this.lastSent = "";
    this.available = fs.existsSync(EXE);
  }

  get cfg() { return this.hub.config.data.music; }

  start() {
    if (!this.available || this.proc) return;
    this.proc = spawn(EXE, [], { windowsHide: true, stdio: ["pipe", "pipe", "ignore"] });
    let buf = "";
    this.proc.stdout.setEncoding("utf8");
    this.proc.stdout.on("data", chunk => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (line.startsWith("{")) { try { this.update(JSON.parse(line).sessions || []); } catch {} }
      }
    });
    this.proc.on("exit", () => { this.proc = null; setTimeout(() => this.start(), 10000); });
    this.proc.on("error", () => {});
  }

  stop() { try { this.proc?.kill(); } catch {} }

  // session à afficher : celle choisie dans les réglages, sinon celle qui joue (applis de musique avant le navigateur)
  pick(list) {
    const src = this.cfg.source || "auto";
    let pool = list;
    if (src !== "auto" && src !== "any") pool = list.filter(s => appOf(s.app).key === src);
    else if (src === "auto") {
      const music = list.filter(s => MUSIC_APPS.has(appOf(s.app).key));
      if (music.length) pool = music;
    }
    return pool.find(s => s.status === "Playing") || pool[0] || null;
  }

  update(list) {
    const now = Date.now();
    this.sessions = list.map(s => ({ app: s.app, ...appOf(s.app), title: s.title, artist: s.artist, status: s.status }));
    const s = this.pick(list);
    if (!s) { this.current = null; return this.send(); }
    let coverId = "";
    if (s.cover) {
      coverId = crypto.createHash("md5").update(s.cover).digest("hex").slice(0, 12);
      if (!this.covers.has(coverId)) {
        if (this.covers.size > 20) this.covers.clear();
        this.covers.set(coverId, s.cover);
      }
    }
    const playing = s.status === "Playing";
    // position réelle : la dernière mise à jour du lecteur peut dater de plusieurs secondes
    const elapsed = playing && s.updated > 0 ? Math.max(0, (now - s.updated) / 1000) : 0;
    const position = Math.min(s.duration || Infinity, (s.position || 0) + elapsed);
    this.current = { ...appOf(s.app), app: s.app, title: s.title, artist: s.artist, album: s.album, playing,
      status: s.status, position: Math.round(position), duration: s.duration || 0, at: now, cover: coverId };
    this.send();
  }

  // n'envoie que les vrais changements (morceau, état, pochette, saut dans le morceau)
  send() {
    const c = this.current;
    const sig = c ? `${c.app}|${c.title}|${c.artist}|${c.status}|${c.cover}|${Math.round(c.position / 5)}` : "rien";
    if (sig === this.lastSent) return;
    this.lastSent = sig;
    this.hub.broadcast({ kind: "music", music: this.view() });
  }

  view() {
    const c = this.current;
    if (!c || (!c.playing && this.cfg.showPaused === false)) return null;
    return c;
  }

  coverData(id) { return this.covers.get(id) || null; }

  command(cmd) {
    if (!this.proc || !["toggle", "play", "pause", "next", "prev"].includes(cmd)) return false;
    this.proc.stdin.write(`${cmd}${this.current ? " " + this.current.app : ""}\n`);
    return true;
  }

  // texte pour le bot (!musique)
  text() {
    const c = this.current;
    if (!c || !c.playing) return "Pas de musique en ce moment";
    return `${c.title}${c.artist ? " — " + c.artist : ""} (${c.label})`;
  }
}

module.exports = Media;
