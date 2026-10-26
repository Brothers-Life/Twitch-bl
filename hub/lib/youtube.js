// YouTube Live : lecture du chat, Super Chats, nouveaux membres et spectateurs,
// via l'API interne du lecteur YouTube (aucune clé ni compte nécessaire). Lecture seule.
const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36", "Accept-Language": "fr-FR,fr;q=0.9" };

const runs = r => (r?.runs || []).map(x => x.text ?? x.emoji?.shortcuts?.[0] ?? "").join("") || r?.simpleText || "";

class YouTube {
  constructor(hub) {
    this.hub = hub;
    this.status = { live: "off", detail: "" };
    this.timer = null;
    this.run = 0;
  }

  get cfg() { return this.hub.config.data.youtube; }

  setStatus(state, detail = "") { this.status = { live: state, detail }; this.hub.broadcastStatus(); }

  stop() { this.run++; clearTimeout(this.timer); clearInterval(this.viewTimer); this.videoId = null; this.hub.stats.setViewers("youtube", 0); }

  async start() {
    this.stop();
    const run = this.run;
    const target = (this.cfg.channel || "").trim();
    if (!target) { this.setStatus("off", "Chaîne YouTube non renseignée"); return; }
    try {
      this.setStatus("connecting", "Recherche du live…");
      const videoId = await this.findLive(target);
      if (run !== this.run) return;
      if (!videoId) throw Object.assign(new Error("Pas de live en cours"), { offline: true });
      const html = await (await fetch(`https://www.youtube.com/live_chat?is_popout=1&v=${videoId}`, { headers: UA })).text();
      this.key = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1];
      this.client = html.match(/"INNERTUBE_CONTEXT_CLIENT_VERSION":"([^"]+)"/)?.[1] || "2.20260101.00.00";
      let cont = html.match(/"continuation":"([^"]+)"/)?.[1];
      if (!this.key || !cont) throw new Error("Chat introuvable (live privé ou chat désactivé ?)");
      this.videoId = videoId;
      this.setStatus("on", `Connecté au live ${videoId}`);
      this.viewTimer = setInterval(() => this.pollViewers(), 30000);
      this.pollViewers();
      this.poll(cont, run, true);
    } catch (e) {
      if (run !== this.run) return;
      this.setStatus("off", e.offline ? "Pas de live YouTube en cours (nouvel essai dans 1 min)" : `Erreur : ${e.message}`);
      this.timer = setTimeout(() => this.start(), 60000);
    }
  }

  async findLive(target) {
    if (/^[\w-]{11}$/.test(target)) return target;                     // identifiant de vidéo direct
    const m = target.match(/(?:v=|youtu\.be\/|\/live\/)([\w-]{11})/);
    if (m) return m[1];
    const handle = target.startsWith("@") || target.startsWith("UC") ? target : `@${target}`;
    const base = handle.startsWith("UC") ? `https://www.youtube.com/channel/${handle}` : `https://www.youtube.com/${handle}`;
    const html = await (await fetch(`${base}/live`, { headers: UA })).text();
    if (!/"isLive(?:Now|Content)":true/.test(html)) return null;
    return html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/)?.[1]
        || html.match(/"videoId":"([\w-]{11})"/)?.[1];
  }

  async poll(cont, run, first) {
    if (run !== this.run) return;
    let next = cont, wait = 3000;
    try {
      const res = await fetch(`https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=${this.key}&prettyPrint=false`, {
        method: "POST", headers: { ...UA, "Content-Type": "application/json" },
        body: JSON.stringify({ context: { client: { clientName: "WEB", clientVersion: this.client } }, continuation: cont }),
      });
      const data = await res.json();
      const lc = data.continuationContents?.liveChatContinuation;
      if (!lc) throw new Error("fin du chat");
      const c = lc.continuations?.[0];
      const cd = c?.invalidationContinuationData || c?.timedContinuationData || c?.reloadContinuationData;
      next = cd?.continuation || cont;
      wait = Math.min(Math.max(cd?.timeoutMs || 3000, 1500), 8000);
      if (!first) for (const a of lc.actions || []) this.handle(a.addChatItemAction?.item);  // le 1er lot = historique, ignoré
    } catch (e) {
      this.setStatus("off", "Live YouTube terminé ou chat indisponible (nouvel essai dans 1 min)");
      this.timer = setTimeout(() => this.start(), 60000);
      return;
    }
    this.timer = setTimeout(() => this.poll(next, run, false), wait);
  }

  handle(item) {
    if (!item) return;
    const t = item.liveChatTextMessageRenderer;
    if (t) return this.hub.emit({ type: "chat", platform: "youtube", user: runs(t.authorName) || "Spectateur", message: runs(t.message),
      mod: (t.authorBadges || []).some(b => /MODERATOR|OWNER/.test(b.liveChatAuthorBadgeRenderer?.icon?.iconType || "")) });
    const p = item.liveChatPaidMessageRenderer;
    if (p) {
      const txt = runs(p.purchaseAmountText);
      return this.hub.emit({ type: "superchat", platform: "youtube", user: runs(p.authorName), message: runs(p.message), amountText: txt,
        amount: parseFloat(txt.replace(/[^\d,.]/g, "").replace(",", ".")) || 0 });
    }
    const mb = item.liveChatMembershipItemRenderer;
    if (mb) return this.hub.emit({ type: "member", platform: "youtube", user: runs(mb.authorName), message: runs(mb.headerSubtext) });
    const g = item.liveChatSponsorshipsGiftPurchaseAnnouncementRenderer;
    if (g) return this.hub.emit({ type: "giftsub", platform: "youtube", user: runs(g.header?.liveChatSponsorshipsHeaderRenderer?.authorName),
      amount: parseInt(runs(g.header?.liveChatSponsorshipsHeaderRenderer?.primaryText).replace(/\D/g, "")) || 1 });
  }

  async pollViewers() {
    if (!this.videoId) return;
    try {
      const res = await fetch(`https://www.youtube.com/youtubei/v1/updated_metadata?key=${this.key}&prettyPrint=false`, {
        method: "POST", headers: { ...UA, "Content-Type": "application/json" },
        body: JSON.stringify({ context: { client: { clientName: "WEB", clientVersion: this.client } }, videoId: this.videoId }),
      });
      const data = await res.json();
      for (const a of data.actions || []) {
        const v = a.updateViewershipAction?.viewCount?.videoViewCountRenderer;
        if (v) this.hub.stats.setViewers("youtube", parseInt(v.originalViewCount || runs(v.viewCount).replace(/\D/g, "")) || 0);
      }
    } catch {}
  }
}

module.exports = YouTube;
