// Dons via StreamElements (WebSocket « Astro »). Le jeton JWT se trouve sur
// streamelements.com > Mon compte > Chaînes > « Show secrets » (JWT Token).
const WebSocket = require("ws");
const crypto = require("crypto");

class StreamElements {
  constructor(hub) {
    this.hub = hub;
    this.ws = null;
    this.status = { state: "off", detail: "" };
  }

  get cfg() { return this.hub.config.data.streamelements; }

  setStatus(state, detail = "") { this.status = { state, detail }; this.hub.broadcastStatus(); }

  start() {
    this.stop();
    if (!this.cfg.jwt) { this.setStatus("off", "Jeton StreamElements non renseigné"); return; }
    const ws = this.ws = new WebSocket("wss://astro.streamelements.com");
    ws.on("open", () => {
      ws.send(JSON.stringify({ type: "subscribe", nonce: crypto.randomUUID(), data: { topic: "channel.tips", token: this.cfg.jwt, token_type: "jwt" } }));
    });
    ws.on("message", buf => {
      const msg = JSON.parse(buf);
      if (msg.type === "response") {
        msg.error ? this.setStatus("error", `Jeton refusé (${msg.error})`) : this.setStatus("on", "Dons StreamElements actifs");
      } else if (msg.type === "message" && msg.topic === "channel.tips") {
        const d = msg.data?.donation || msg.data || {};
        this.hub.emit({ type: "donation", platform: "streamelements", user: d.user?.username || d.username || "Anonyme",
          amount: +d.amount || 0, currency: d.currency || "EUR", message: d.message || "" });
      }
    });
    ws.on("close", () => { if (this.ws === ws) { this.setStatus("off", "Déconnecté, nouvel essai…"); setTimeout(() => this.ws === ws && this.start(), 10000); } });
    ws.on("error", () => {});
  }

  stop() { if (this.ws) { const w = this.ws; this.ws = null; w.removeAllListeners(); w.terminate(); } }
}

module.exports = StreamElements;
