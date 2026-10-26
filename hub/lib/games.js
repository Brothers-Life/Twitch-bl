// Mini-jeux jouables depuis les 3 chats (Twitch, TikTok, YouTube), affichés par l'overlay minijeux.html.
//   quiz      : la 1re bonne réponse gagne
//   course    : les spectateurs tapent !go pour s'inscrire, une course animée désigne le gagnant
//   sondage   : vote en tapant le numéro d'une option
//   devine    : deviner un nombre, le Hub indique plus/moins
//   roue      : roue des gages (lancée depuis le dashboard ou par un cadeau TikTok)
//   roulette  : !roulette <mise> à tout moment, double ou perd ses points

const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

class Games {
  constructor(hub) {
    this.hub = hub;
    this.state = null;   // jeu en cours, envoyé tel quel aux overlays
    this.timers = [];
  }

  get cfg() { return this.hub.config.data.games; }
  get bot() { return this.hub.bot; }

  // les réponses (quiz, nombre secret, votants) ne sont jamais envoyées aux overlays
  view() {
    if (!this.state) return null;
    const { answers, secret, voters, ...pub } = this.state;
    return pub;
  }

  push() { this.hub.broadcast({ kind: "game", state: this.view() }); }

  later(ms, fn) { this.timers.push(setTimeout(fn, ms)); }

  clear() { this.timers.forEach(clearTimeout); this.timers = []; }

  stop() { this.clear(); this.state = null; this.push(); }

  // un mini-jeu de test (bouton dans BL Studio) ne poste rien dans le chat
  announce(text) { if (!this.testMode) this.hub.bot.reply({ platform: "twitch", user: this.cfg.name }, text); }

  finish(result, showMs = 8000) {
    this.clear();
    this.state = { ...this.state, phase: "result", result, endsAt: Date.now() + showMs };
    this.push();
    this.later(showMs, () => this.stop());
  }

  start(type, opts = {}) {
    this.clear();
    this.testMode = !!opts.test;
    const d = (opts.duration || this.cfg.durations[type] || 30) * 1000;
    const base = { type, phase: "play", startedAt: Date.now(), endsAt: Date.now() + d };
    if (type === "quiz") {
      const q = opts.question ? { q: opts.question, a: opts.answers } : pick(this.cfg.quiz);
      this.state = { ...base, question: q.q, answers: (Array.isArray(q.a) ? q.a : String(q.a).split("|")).map(norm), reward: this.cfg.rewards.quiz };
      this.announce(`🎯 QUIZ : ${q.q} (1re bonne réponse = ${this.cfg.rewards.quiz} pts)`);
      this.later(d, () => this.finish({ text: `Personne n'a trouvé ! Réponse : ${q.a.split ? q.a.split("|")[0] : q.a[0]}` }));
    } else if (type === "course") {
      this.state = { ...base, phase: "join", racers: [], reward: this.cfg.rewards.course };
      this.announce(`🏁 COURSE : tape !go pour participer (${d / 1000} s)`);
      this.later(d, () => this.race());
    } else if (type === "sondage") {
      const options = (opts.options || ["Oui", "Non"]).filter(Boolean);
      this.state = { ...base, question: opts.question || "Sondage", options: options.map(label => ({ label, votes: 0 })), voters: {} };
      this.announce(`📊 SONDAGE : ${this.state.question} — ${options.map((o, i) => `${i + 1} = ${o}`).join(" · ")}`);
      this.later(d, () => {
        const best = this.state.options.reduce((a, b) => (b.votes > a.votes ? b : a));
        this.finish({ text: best.votes ? `Gagnant : ${best.label}` : "Aucun vote" }, 12000);
      });
    } else if (type === "devine") {
      const max = opts.max || 100;
      this.state = { ...base, max, secret: 1 + Math.floor(Math.random() * max), hint: `Entre 1 et ${max}`, tries: 0, reward: this.cfg.rewards.devine };
      this.announce(`🔢 DEVINE LE NOMBRE entre 1 et ${max} : tape juste le nombre !`);
      this.later(d, () => this.finish({ text: `Temps écoulé ! C'était ${this.state.secret}` }));
    } else if (type === "roue") {
      const segments = (opts.segments || this.cfg.wheel).filter(Boolean);
      const index = Math.floor(Math.random() * segments.length);
      this.state = { ...base, phase: "spin", segments, index, by: opts.by || "", endsAt: Date.now() + 6000 };
      this.later(6000, () => this.finish({ text: segments[index], by: opts.by }, 9000));
    }
    this.push();
  }

  race() {
    const racers = this.state.racers;
    if (!racers.length) return this.finish({ text: "Personne n'a pris le départ…" });
    // vitesses aléatoires : l'overlay anime la course pendant 8 s, le gagnant est le plus rapide
    racers.forEach(r => (r.speed = 0.6 + Math.random() * 0.4));
    const winner = racers.reduce((a, b) => (b.speed > a.speed ? b : a));
    this.state = { ...this.state, phase: "race", winner, endsAt: Date.now() + 8000 };
    this.push();
    this.later(8000, () => {
      this.bot.addPoints(winner.platform, winner.user, this.state.reward);
      this.announce(`🏆 ${winner.user} gagne la course et ${this.state.reward} pts !`);
      this.finish({ text: `${winner.user} gagne la course !`, winner });
    });
  }

  handle(e) {
    if (e.type === "gift" && this.cfg.wheelGift && (e.gift || "").toLowerCase() === this.cfg.wheelGift.toLowerCase() && !this.state) {
      return this.start("roue", { by: e.user });
    }
    if (e.type !== "chat" || e.platform === "bot") return;
    const msg = e.message.trim();

    if (/^!roulette\b/i.test(msg) && this.cfg.roulette) return this.roulette(e, msg);

    const s = this.state;
    if (!s || !["play", "join"].includes(s.phase)) return;
    if (s.type === "quiz" && s.answers.some(a => norm(msg).includes(a))) {
      this.bot.addPoints(e.platform, e.user, s.reward);
      this.announce(`✅ ${e.user} a trouvé et gagne ${s.reward} pts !`);
      this.finish({ text: `${e.user} a trouvé !`, winner: { user: e.user, platform: e.platform } });
    } else if (s.type === "course" && /^!go\b/i.test(msg) && !s.racers.some(r => r.user === e.user && r.platform === e.platform)) {
      if (s.racers.length < 12) { s.racers.push({ user: e.user, platform: e.platform }); this.push(); }
    } else if (s.type === "sondage") {
      const n = parseInt(msg, 10);
      const k = `${e.platform}:${e.user}`;
      if (n >= 1 && n <= s.options.length && !s.voters[k]) { s.voters[k] = n; s.options[n - 1].votes++; this.push(); }
    } else if (s.type === "devine") {
      const n = parseInt(msg.replace(/^!devine\s*/i, ""), 10);
      if (!(n >= 1 && n <= s.max) || String(n) !== msg.replace(/^!devine\s*/i, "")) return;
      s.tries++;
      if (n === s.secret) {
        this.bot.addPoints(e.platform, e.user, s.reward);
        this.announce(`🎉 ${e.user} a trouvé ${s.secret} et gagne ${s.reward} pts !`);
        this.finish({ text: `${e.user} a trouvé ${s.secret} !`, winner: { user: e.user, platform: e.platform } });
      } else {
        s.hint = n < s.secret ? `Plus grand que ${n}` : `Plus petit que ${n}`;
        s.last = { user: e.user, n };
        this.push();
      }
    }
  }

  roulette(e, msg) {
    const have = this.bot.getPoints(e.platform, e.user);
    const arg = msg.split(/\s+/)[1] || "";
    const bet = /^(tout|all)$/i.test(arg) ? have : parseInt(arg, 10);
    if (!(bet > 0)) return this.bot.reply(e, `@${e.user} utilise !roulette <mise> (tu as ${have} pts)`);
    if (bet > have) return this.bot.reply(e, `@${e.user} tu n'as que ${have} pts`);
    const win = Math.random() < 0.48;
    const total = this.bot.addPoints(e.platform, e.user, win ? bet : -bet);
    this.bot.reply(e, win ? `🎰 @${e.user} gagne ${bet} pts ! (total ${total})` : `💸 @${e.user} perd ${bet} pts… (total ${total})`);
    this.hub.broadcast({ kind: "roulette", user: e.user, platform: e.platform, bet, win, total });
  }
}

module.exports = Games;
