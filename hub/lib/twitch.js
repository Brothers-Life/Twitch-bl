// Twitch : chat (IRC WebSocket) + événements (EventSub WebSocket : follows, subs, bits, raids).
// Sans jeton : lecture du chat en anonyme. Avec jeton (bouton « Se connecter à Twitch ») :
// le bot peut écrire dans le chat et les alertes follow/sub/bits/raid s'activent.
const WebSocket = require("ws");

const SCOPES = ["chat:read", "chat:edit", "moderator:read:followers", "channel:read:subscriptions", "bits:read"];

class Twitch {
  constructor(hub) {
    this.hub = hub;
    this.irc = null;
    this.es = null;
    this.user = null;          // { id, login } du compte connecté
    this.status = { chat: "off", events: "off", detail: "" };
    this.viewers = 0;
  }

  get cfg() { return this.hub.config.data.twitch; }

  authUrl(redirect) {
    const p = new URLSearchParams({ client_id: this.cfg.clientId, redirect_uri: redirect, response_type: "token", scope: SCOPES.join(" "), force_verify: "true" });
    return `https://id.twitch.tv/oauth2/authorize?${p}`;
  }

  async helix(method, path, body) {
    const res = await fetch(`https://api.twitch.tv/helix/${path}`, {
      method,
      headers: { "Client-Id": this.cfg.clientId, Authorization: `Bearer ${this.cfg.token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Twitch ${path} : ${res.status} ${await res.text()}`);
    return res.status === 204 ? {} : res.json();
  }

  async start() {
    this.stop();
    if (!this.cfg.channel) { this.setStatus("chat", "off", "Pseudo Twitch non renseigné"); return; }
    if (this.cfg.token && this.cfg.clientId) {
      try {
        const v = await (await fetch("https://id.twitch.tv/oauth2/validate", { headers: { Authorization: `OAuth ${this.cfg.token}` } })).json();
        if (!v.user_id) throw new Error("jeton expiré");
        this.user = { id: v.user_id, login: v.login };
      } catch (e) {
        this.user = null;
        this.setStatus("events", "error", `Reconnecte-toi à Twitch (${e.message})`);
      }
    }
    this.connectChat();
    if (this.user) this.connectEvents();
    this.viewerTimer = setInterval(() => this.pollViewers(), 60000);
    this.pollViewers();
  }

  stop() {
    clearInterval(this.viewerTimer);
    this.hub.stats.setViewers("twitch", 0);
    for (const s of [this.irc, this.es]) if (s) { s.removeAllListeners(); s.terminate(); }
    this.irc = this.es = null;
    this.setStatus("chat", "off"); this.setStatus("events", "off");
  }

  setStatus(part, state, detail = "") {
    this.status[part] = state;
    if (detail) this.status.detail = detail;
    this.hub.broadcastStatus();
  }

  // ---------- Chat ----------
  connectChat() {
    const channel = this.cfg.channel.toLowerCase().replace(/^#/, "");
    const ws = this.irc = new WebSocket("wss://irc-ws.chat.twitch.tv:443");
    ws.on("open", () => {
      ws.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
      if (this.user) { ws.send(`PASS oauth:${this.cfg.token}`); ws.send(`NICK ${this.user.login}`); }
      else ws.send(`NICK justinfan${Math.floor(Math.random() * 1e5)}`);
      ws.send(`JOIN #${channel}`);
      this.setStatus("chat", "on", this.user ? `Connecté en tant que ${this.user.login}` : "Chat en lecture seule (connecte-toi pour activer le bot)");
    });
    ws.on("message", buf => {
      for (const line of buf.toString().split("\r\n")) {
        if (!line) continue;
        if (line.startsWith("PING")) { ws.send("PONG :tmi.twitch.tv"); continue; }
        const m = line.match(/^(?:@(\S+) )?:(\w+)!\S+ PRIVMSG #\S+ :(.*)$/);
        if (!m) continue;
        const tags = Object.fromEntries((m[1] || "").split(";").map(t => t.split("=")));
        const badges = tags.badges || "";
        this.hub.emit({
          type: "chat", platform: "twitch", user: tags["display-name"] || m[2], login: m[2], message: m[3],
          color: tags.color || "", mod: badges.includes("moderator") || badges.includes("broadcaster"),
          sub: badges.includes("subscriber"),
        });
        // sans EventSub (pas connecté), les bits sont détectés dans le chat ; sinon EventSub s'en charge
        if (tags.bits && !this.user) this.hub.emit({ type: "bits", platform: "twitch", user: tags["display-name"] || m[2], amount: +tags.bits, message: m[3] });
      }
    });
    ws.on("close", () => { this.setStatus("chat", "off"); if (this.irc === ws) setTimeout(() => this.irc === ws && this.connectChat(), 5000); });
    ws.on("error", () => {});
  }

  say(text) {
    if (!this.irc || this.irc.readyState !== 1 || !this.user) return false;
    this.irc.send(`PRIVMSG #${this.cfg.channel.toLowerCase()} :${text.replace(/[\r\n]+/g, " ")}`);
    return true;
  }

  // ---------- EventSub ----------
  connectEvents(url = "wss://eventsub.wss.twitch.tv/ws") {
    const ws = this.es = new WebSocket(url);
    ws.on("message", async buf => {
      const msg = JSON.parse(buf);
      const type = msg.metadata?.message_type;
      if (type === "session_welcome") {
        if (url !== "wss://eventsub.wss.twitch.tv/ws") return;  // reconnexion : abonnements conservés
        try { await this.subscribe(msg.payload.session.id); this.setStatus("events", "on", "Alertes Twitch actives"); }
        catch (e) { this.setStatus("events", "error", e.message); }
      } else if (type === "session_reconnect") {
        const old = ws;
        this.connectEvents(msg.payload.session.reconnect_url);
        setTimeout(() => old.terminate(), 2000);
      } else if (type === "notification") {
        this.onEvent(msg.payload.subscription.type, msg.payload.event);
      }
    });
    ws.on("close", () => { if (this.es === ws) { this.setStatus("events", "off"); setTimeout(() => this.es === ws && this.connectEvents(), 10000); } });
    ws.on("error", () => {});
  }

  async subscribe(session_id) {
    const id = this.user.id;
    const subs = [
      ["channel.follow", "2", { broadcaster_user_id: id, moderator_user_id: id }],
      ["channel.subscribe", "1", { broadcaster_user_id: id }],
      ["channel.subscription.gift", "1", { broadcaster_user_id: id }],
      ["channel.subscription.message", "1", { broadcaster_user_id: id }],
      ["channel.cheer", "1", { broadcaster_user_id: id }],
      ["channel.raid", "1", { to_broadcaster_user_id: id }],
    ];
    const errors = [];
    for (const [type, version, condition] of subs) {
      try { await this.helix("POST", "eventsub/subscriptions", { type, version, condition, transport: { method: "websocket", session_id } }); }
      catch (e) { errors.push(type); }
    }
    if (errors.length === subs.length) throw new Error("Aucun abonnement EventSub (le compte connecté doit être celui de la chaîne)");
  }

  onEvent(type, e) {
    const E = (o) => this.hub.emit({ platform: "twitch", ...o });
    switch (type) {
      case "channel.follow": return E({ type: "follow", user: e.user_name });
      case "channel.subscribe": if (!e.is_gift) E({ type: "sub", user: e.user_name, tier: e.tier }); return;
      case "channel.subscription.message": return E({ type: "sub", user: e.user_name, tier: e.tier, months: e.cumulative_months, message: e.message?.text });
      case "channel.subscription.gift": return E({ type: "giftsub", user: e.is_anonymous ? "Anonyme" : e.user_name, amount: e.total });
      case "channel.cheer": return E({ type: "bits", user: e.is_anonymous ? "Anonyme" : e.user_name, amount: e.bits, message: e.message });
      case "channel.raid": return E({ type: "raid", user: e.from_broadcaster_user_name, amount: e.viewers });
    }
  }

  async pollViewers() {
    if (!this.user) return;
    try {
      const r = await this.helix("GET", `streams?user_login=${encodeURIComponent(this.cfg.channel.toLowerCase())}`);
      this.live = !!r.data?.[0];
      this.viewers = r.data?.[0]?.viewer_count || 0;
      this.hub.stats.setViewers("twitch", this.viewers);
    } catch {}
  }
}

module.exports = Twitch;
