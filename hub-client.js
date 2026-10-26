// Connexion des overlays au BL Hub (ws://127.0.0.1:3939/ws), avec reconnexion automatique.
// Usage : blHub(msg => { ... })  — msg.kind : hello | event | alert | game | status | stats | roulette
window.blHub = function (onMessage) {
  const connect = () => {
    const ws = new WebSocket("ws://127.0.0.1:3939/ws");
    ws.onmessage = e => { try { onMessage(JSON.parse(e.data)); } catch (err) { console.error(err); } };
    ws.onclose = () => setTimeout(connect, 3000);
  };
  connect();
};

// Applique le style visuel demandé dans l'URL (&style=…) au <body>.
window.blStyle = function (q) {
  const s = q.get("style") || "carte";
  document.body.classList.add(`style-${s}`);
  return s;
};

// Libellés et couleurs des plateformes
window.BL_PLATFORMS = {
  twitch: { label: "Twitch", color: "#9146ff", short: "TW" },
  tiktok: { label: "TikTok", color: "#fe2c55", short: "TT" },
  youtube: { label: "YouTube", color: "#ff0000", short: "YT" },
  streamelements: { label: "Don", color: "#1ec98b", short: "€" },
  bot: { label: "Bot", color: "#de9425", short: "BOT" },
};
