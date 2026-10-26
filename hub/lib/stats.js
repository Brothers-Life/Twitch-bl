// Statistiques de la session (depuis le lancement du Hub) + totaux cumulés enregistrés dans data/stats.json.
const PLATFORMS = ["twitch", "tiktok", "youtube"];
const COUNTED = ["follow", "sub", "giftsub", "bits", "raid", "gift", "share", "superchat", "member", "donation"];

class Stats {
  constructor(hub, store) {
    this.hub = hub;
    this.store = store;            // totaux cumulés
    this.reset();
    setInterval(() => this.tickMinute(), 60000);
  }

  reset() {
    const per = () => Object.fromEntries(PLATFORMS.map(p => [p, 0]));
    this.session = {
      startedAt: Date.now(),
      messages: per(), viewers: per(), peak: per(),
      chatters: Object.fromEntries(PLATFORMS.map(p => [p, new Set()])),
      events: Object.fromEntries(COUNTED.map(t => [t, 0])),
      bits: 0, diamonds: 0, likes: 0, donations: 0, superchats: 0,
      timeline: [],                // [{t, twitch, tiktok, youtube, viewers}] une entrée par minute
      current: per(),              // messages de la minute en cours
      topChatters: {}, topSupporters: {},
      recent: [],
    };
  }

  record(e) {
    const s = this.session;
    if (e.type === "chat" && PLATFORMS.includes(e.platform)) {
      s.messages[e.platform]++;
      s.current[e.platform]++;
      s.chatters[e.platform].add(e.user);
      const k = `${e.platform}:${e.user}`;
      s.topChatters[k] = (s.topChatters[k] || 0) + 1;
      return;
    }
    if (!COUNTED.includes(e.type)) return;
    s.events[e.type]++;
    const all = this.store.data;
    all[e.type] = (all[e.type] || 0) + 1;
    let value = 0;  // valeur estimée en euros pour le classement des soutiens
    if (e.type === "bits") { s.bits += e.amount; value = e.amount / 100; }
    if (e.type === "gift") { s.diamonds += e.value || 0; value = (e.value || 0) * 0.005; }
    if (e.type === "donation") { s.donations += e.amount; value = e.amount; all.donationsTotal = (all.donationsTotal || 0) + e.amount; }
    if (e.type === "superchat") { s.superchats += e.amount; value = e.amount; }
    if (e.type === "sub" || e.type === "member") value = 3.99;
    if (e.type === "giftsub") value = 3.99 * (e.amount || 1);
    if (value) {
      const k = `${e.platform}:${e.user}`;
      s.topSupporters[k] = (s.topSupporters[k] || 0) + value;
    }
    s.recent.unshift({ type: e.type, platform: e.platform, user: e.user, amount: e.amount, gift: e.gift, ts: e.ts });
    s.recent.length = Math.min(s.recent.length, 50);
    this.store.save();
  }

  setViewers(platform, n) {
    this.session.viewers[platform] = n;
    this.session.peak[platform] = Math.max(this.session.peak[platform], n);
  }

  setLikes(n) { this.session.likes = n; }

  tickMinute() {
    const s = this.session;
    s.timeline.push({ t: Date.now(), ...s.current, viewers: PLATFORMS.reduce((a, p) => a + s.viewers[p], 0) });
    if (s.timeline.length > 240) s.timeline.shift();
    s.current = Object.fromEntries(PLATFORMS.map(p => [p, 0]));
    this.hub.broadcast({ kind: "stats", stats: this.snapshot() });
  }

  snapshot() {
    const s = this.session;
    const top = (obj, n) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n)
      .map(([k, v]) => ({ platform: k.split(":")[0], user: k.slice(k.indexOf(":") + 1), value: Math.round(v * 100) / 100 }));
    return {
      startedAt: s.startedAt, messages: s.messages, viewers: s.viewers, peak: s.peak,
      chatters: Object.fromEntries(PLATFORMS.map(p => [p, s.chatters[p].size])),
      events: s.events, bits: s.bits, diamonds: s.diamonds, likes: s.likes,
      donations: Math.round(s.donations * 100) / 100, superchats: Math.round(s.superchats * 100) / 100,
      timeline: s.timeline, current: s.current,
      topChatters: top(s.topChatters, 10), topSupporters: top(s.topSupporters, 10),
      recent: s.recent.slice(0, 20), allTime: this.store.data,
    };
  }
}

module.exports = Stats;
