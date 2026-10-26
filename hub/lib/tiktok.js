// TikTok LIVE (lecture seule, bibliothèque non officielle tiktok-live-connector) :
// chat, cadeaux, follows, partages, likes, nombre de spectateurs. TikTok ne permet pas d'écrire dans le chat.
const { TikTokLiveConnection, WebcastEvent, ControlEvent } = require("tiktok-live-connector");

const name = u => u?.nickname || u?.uniqueId || "Quelqu'un";

class TikTok {
  constructor(hub) {
    this.hub = hub;
    this.conn = null;
    this.status = { live: "off", detail: "" };
    this.likes = 0;
    this.retry = null;
  }

  get cfg() { return this.hub.config.data.tiktok; }

  setStatus(state, detail = "") { this.status = { live: state, detail }; this.hub.broadcastStatus(); }

  async start() {
    this.stop();
    const user = (this.cfg.username || "").replace(/^@/, "");
    if (!user) { this.setStatus("off", "Pseudo TikTok non renseigné"); return; }
    const conn = this.conn = new TikTokLiveConnection(user, { processInitialData: false, enableExtendedGiftInfo: true });

    conn.on(WebcastEvent.CHAT, d => this.hub.emit({ type: "chat", platform: "tiktok", user: name(d.user), message: d.comment ?? d.content ?? "" }));
    conn.on(WebcastEvent.GIFT, d => {
      const gift = d.giftDetails || d.gift || {};
      const type = gift.giftType ?? gift.type;
      if (type === 1 && !d.repeatEnd) return;   // cadeau en série : on attend la fin de la série
      const count = d.repeatCount || 1;
      const diamonds = (gift.diamondCount || 0) * count;
      this.hub.emit({ type: "gift", platform: "tiktok", user: name(d.user), gift: gift.giftName || gift.name || "Cadeau", amount: count, value: diamonds });
    });
    conn.on(WebcastEvent.FOLLOW, d => this.hub.emit({ type: "follow", platform: "tiktok", user: name(d.user) }));
    conn.on(WebcastEvent.SHARE, d => this.hub.emit({ type: "share", platform: "tiktok", user: name(d.user) }));
    conn.on(WebcastEvent.LIKE, d => {
      this.likes = d.totalLikeCount || d.totalLikes || this.likes + (d.likeCount || 0);
      this.hub.stats.setLikes(this.likes);
    });
    conn.on(WebcastEvent.ROOM_USER, d => this.hub.stats.setViewers("tiktok", d.viewerCount ?? d.total ?? 0));
    conn.on(WebcastEvent.STREAM_END, () => { this.setStatus("off", "Live TikTok terminé"); this.scheduleRetry(); });
    conn.on(ControlEvent.DISCONNECTED, () => { if (this.conn === conn) { this.setStatus("off", "Déconnecté"); this.scheduleRetry(); } });
    conn.on(ControlEvent.ERROR, e => this.status.live === "on" && this.hub.log("tiktok", "erreur", `Erreur de la connexion TikTok : ${String(e?.info || e?.exception?.message || e?.message || JSON.stringify(e)).slice(0, 400)}`));

    try {
      this.setStatus("connecting", "Connexion au live…");
      await conn.connect();
      this.setStatus("on", `Connecté au live de @${user}`);
      this.lastErrorDetail = "";
      this.hub.log("tiktok", "info", `Salon du live trouvé (room ${conn.roomId || "?"}) : chat, cadeaux et spectateurs arrivent`);
    } catch (e) {
      const subs = (e?.config?.requestErrs || e?.errors || []).map(x => `   • ${String(x?.message || x).slice(0, 300)}`).join("\n");
      // détail noté une fois (puis seulement s'il change), pour ne pas remplir le journal toutes les minutes
      const detail = `Connexion à @${user} impossible : ${e?.constructor?.name || "Erreur"} — ${String(e?.message || e).slice(0, 400)}${subs ? "\n" + subs : ""}`;
      if (detail !== this.lastErrorDetail) { this.lastErrorDetail = detail; this.hub.log("tiktok", "erreur", detail); }
      const offline = /offline|not live|isn't online|not online|UserOffline|Room ID/i.test(String(e?.message || e));
      // TikTok répond pareil pour « pas en live » et « compte inexistant » : on vérifie le profil (pseudo changé ?)
      const exists = offline ? await this.profileExists(user) : true;
      this.setStatus("off", !exists ? `Pseudo TikTok @${user} introuvable : vérifie-le dans Connexions (as-tu changé de @ ?)`
        : offline ? `@${user} n'est pas en live (nouvel essai dans 1 min)` : `Erreur : ${String(e?.message || e).slice(0, 120)}`);
      this.scheduleRetry();
    }
  }

  // profil TikTok public : statusCode 10221 = compte inexistant (vérifié une fois par pseudo et par heure)
  profileExists(user) {
    if (this.profileCheck?.user === user && Date.now() - this.profileCheck.at < 3600000) return Promise.resolve(this.profileCheck.ok);
    return new Promise(resolve => {
      const req = require("https").get(`https://www.tiktok.com/@${encodeURIComponent(user)}`, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36" } }, res => {
        let html = "";
        res.setEncoding("utf8");
        res.on("data", c => { if (html.length < 600000) html += c; });
        res.on("end", () => {
          const ok = !/"statusCode":10221/.test(html);
          this.profileCheck = { user, ok, at: Date.now() };
          resolve(ok);
        });
      });
      req.on("error", () => resolve(true));
      req.setTimeout(10000, () => { req.destroy(); resolve(true); });
    });
  }

  scheduleRetry() {
    clearTimeout(this.retry);
    this.retry = setTimeout(() => this.start(), 60000);
  }

  stop() {
    clearTimeout(this.retry);
    this.hub.stats.setViewers("tiktok", 0);
    if (this.conn) { const c = this.conn; this.conn = null; try { c.removeAllListeners(); c.disconnect(); } catch {} }
  }
}

module.exports = TikTok;
