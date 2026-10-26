// Bot multi-plateforme : commandes du chat, messages automatiques, points des spectateurs.
// Il lit Twitch, TikTok et YouTube ; il ne peut répondre que sur Twitch (TikTok et YouTube sont en lecture seule).
// Ses réponses s'affichent aussi dans le chat unifié du dashboard.

class Bot {
  constructor(hub, pointsStore) {
    this.hub = hub;
    this.points = pointsStore;
    this.cooldowns = {};
    this.lastPointGain = {};
    this.timerState = {};
    setInterval(() => this.runTimers(), 30000);
  }

  get cfg() { return this.hub.config.data.bot; }

  key(e) { return `${e.platform}:${e.user}`; }

  getPoints(platform, user) { return this.points.data[`${platform}:${user}`]?.points || 0; }

  addPoints(platform, user, n) {
    if (!user || !n) return;
    const k = `${platform}:${user}`;
    const p = this.points.data[k] || (this.points.data[k] = { platform, user, points: 0 });
    p.points = Math.max(0, Math.round(p.points + n));
    this.points.save();
    return p.points;
  }

  leaderboard(n = 10) {
    return Object.values(this.points.data).sort((a, b) => b.points - a.points).slice(0, n);
  }

  // points gagnés par l'activité
  reward(e) {
    const r = this.cfg.rewards;
    switch (e.type) {
      case "chat": {
        const k = this.key(e), now = Date.now();
        if (now - (this.lastPointGain[k] || 0) > 60000) { this.lastPointGain[k] = now; this.addPoints(e.platform, e.user, r.chat); }
        break;
      }
      case "follow": this.addPoints(e.platform, e.user, r.follow); break;
      case "share": this.addPoints(e.platform, e.user, r.share); break;
      case "sub": case "member": this.addPoints(e.platform, e.user, r.sub); break;
      case "giftsub": this.addPoints(e.platform, e.user, r.sub * (e.amount || 1)); break;
      case "bits": this.addPoints(e.platform, e.user, e.amount * r.perBit); break;
      case "gift": this.addPoints(e.platform, e.user, (e.value || 1) * r.perDiamond); break;
      case "donation": case "superchat": this.addPoints(e.platform, e.user, e.amount * r.perEuro); break;
    }
  }

  reply(e, text) {
    const sent = e.platform === "twitch" && this.hub.twitch.say(text);
    this.hub.emit({ type: "chat", platform: "bot", user: this.cfg.name, message: text, replyTo: e.platform, sent }, { silent: true });
  }

  fill(text, e) {
    const up = Math.floor((Date.now() - this.hub.stats.session.startedAt) / 60000);
    return text
      .replace(/\{user\}/g, e.user)
      .replace(/\{points\}/g, this.getPoints(e.platform, e.user))
      .replace(/\{uptime\}/g, `${Math.floor(up / 60)} h ${String(up % 60).padStart(2, "0")}`)
      .replace(/\{plateforme\}/g, e.platform)
      .replace(/\{musique\}/g, () => this.hub.media.text())
      // {compteur:morts} affiche un compteur, {compteur:morts+1} l'augmente d'abord (widget « compteur » mis à jour)
      .replace(/\{compteur:([a-z0-9_-]+)([+-]\d+)?\}/g, (_, id, delta) => {
        const all = this.hub.config.data.counters;
        const c = all[id] || (all[id] = { label: id, value: 0 });
        if (delta) {
          c.value += parseInt(delta, 10);
          this.hub.config.save();
          this.hub.broadcast({ kind: "counters", counters: all });
        }
        return c.value;
      });
  }

  handle(e) {
    if (!this.cfg.enabled || e.type !== "chat" || e.platform === "bot") return;
    const msg = e.message.trim();
    if (!msg.startsWith("!")) return;
    const [word] = msg.split(/\s+/);
    const cmd = word.toLowerCase();
    const cdKey = `${cmd}`;
    const now = Date.now();

    if (cmd === "!commandes" || cmd === "!help") {
      const list = this.cfg.commands.filter(c => c.enabled).map(c => c.cmd);
      return this.reply(e, `Commandes : ${[...list, "!points", "!top", "!roulette <mise>"].join(" ")}`);
    }
    if (cmd === "!points") return this.reply(e, `@${e.user} tu as ${this.getPoints(e.platform, e.user)} ${this.cfg.pointsName}`);
    if (cmd === "!top") return this.reply(e, "Top : " + this.leaderboard(5).map((p, i) => `${i + 1}. ${p.user} (${p.points})`).join(" · "));
    // !son <nom> : joue un son de la soundboard contre des points (si activé dans BL Studio)
    if (cmd === "!son" || cmd === "!sons") {
      const sb = this.hub.config.data.soundboard;
      if (!sb.chat) return;
      const pads = sb.pads.filter(p => p.chat !== false);
      const want = msg.slice(word.length).trim().toLowerCase();
      if (!want) return this.reply(e, `Sons (${sb.cost} ${this.cfg.pointsName}) : ${pads.map(p => p.label.toLowerCase()).join(", ") || "aucun"} — tape !son <nom>`);
      const pad = pads.find(p => p.label.toLowerCase() === want) || pads.find(p => p.label.toLowerCase().startsWith(want));
      if (!pad) return this.reply(e, `@${e.user} son introuvable, tape !son pour la liste`);
      if (now - (this.cooldowns["!son"] || 0) < 5000) return;
      if (this.getPoints(e.platform, e.user) < sb.cost) return this.reply(e, `@${e.user} il te faut ${sb.cost} ${this.cfg.pointsName}`);
      this.addPoints(e.platform, e.user, -sb.cost);
      this.cooldowns["!son"] = now;
      this.hub.playSound(pad.file, pad.volume);
      return;
    }

    const c = this.cfg.commands.find(c => c.enabled && c.cmd.toLowerCase() === cmd);
    if (!c) return;
    if (now - (this.cooldowns[cdKey] || 0) < (c.cooldown || 0) * 1000) return;
    this.cooldowns[cdKey] = now;
    this.reply(e, this.fill(c.response, e));
  }

  runTimers() {
    // pas de messages automatiques dans un chat vide : seulement pendant un live (Twitch, TikTok ou YouTube)
    const live = this.hub.twitch.live || this.hub.tiktok.status.live === "on" || this.hub.youtube.status.live === "on";
    if (!this.cfg.enabled || !live) return;
    const now = Date.now();
    this.cfg.timers.forEach((t, i) => {
      if (!t.enabled || !t.message) return;
      const last = this.timerState[i] || (this.timerState[i] = now);
      if (now - last >= t.minutes * 60000) {
        this.timerState[i] = now;
        this.reply({ platform: "twitch", user: this.cfg.name }, t.message);
      }
    });
  }
}

module.exports = Bot;
