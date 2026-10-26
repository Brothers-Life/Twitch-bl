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
    conn.on(ControlEvent.ERROR, () => {});

    try {
      this.setStatus("connecting", "Connexion au live…");
      await conn.connect();
      this.setStatus("on", `Connecté au live de @${user}`);
    } catch (e) {
      const offline = /offline|not live|isn't online|not online|UserOffline|Room ID/i.test(String(e?.message || e));
      this.setStatus("off", offline ? `@${user} n'est pas en live (nouvel essai dans 1 min)` : `Erreur : ${String(e?.message || e).slice(0, 120)}`);
      this.scheduleRetry();
    }
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
