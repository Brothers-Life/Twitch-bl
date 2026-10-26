// Registre commun des thèmes (DA), polices, styles de widgets et animations de fond.
// Utilisé par tous les widgets, le fond animé et l'appli BL Studio.
// Choix via l'URL : ?theme=sunset&font=bebas  (+ c1/c2/c3/bg1/bg2/sub pour forcer une couleur, sans # : c'est ainsi qu'une DA perso s'applique)
window.BL_THEMES = {
  // --- originaux ---
  sunset:   { label: "Sunset",          c1: "#fae664", c2: "#de9425", c3: "#cc4308", bg1: "#1a0b06", bg2: "#070302", sub: "#f3e6d0" },
  neon:     { label: "Néon",            c1: "#7df9ff", c2: "#b44cff", c3: "#ff2bd6", bg1: "#0d0618", bg2: "#04020a", sub: "#e6e0ff" },
  lspd:     { label: "Police",          c1: "#ffffff", c2: "#2f6bff", c3: "#e8243c", bg1: "#070b18", bg2: "#020309", sub: "#dbe4ff" },
  ems:      { label: "Urgences",        c1: "#ffffff", c2: "#ff4d4d", c3: "#b3001b", bg1: "#140607", bg2: "#050202", sub: "#ffe3e3" },
  gold:     { label: "Luxe or",         c1: "#fff3c4", c2: "#d4af37", c3: "#8a6d1d", bg1: "#121008", bg2: "#050402", sub: "#f5ecd0" },
  gang:     { label: "Gang vert",       c1: "#d4ff4a", c2: "#39d353", c3: "#0f8a3c", bg1: "#06110a", bg2: "#020503", sub: "#e3ffe0" },
  minimal:  { label: "Minimal",         c1: "#ffffff", c2: "#bdbdbd", c3: "#5a5a5a", bg1: "#141414", bg2: "#050505", sub: "#e8e8e8" },
  // --- nouveaux ---
  cyber:    { label: "Cyberpunk",       c1: "#fcee0a", c2: "#00f0ff", c3: "#ff003c", bg1: "#0a0a14", bg2: "#000000", sub: "#e8f8ff" },
  miami:    { label: "Miami",           c1: "#ffd1f0", c2: "#ff4fa3", c3: "#18d8d0", bg1: "#1a0a24", bg2: "#06030c", sub: "#ffe8f6" },
  ocean:    { label: "Océan",           c1: "#c9f3ff", c2: "#2bb5e8", c3: "#0b5fa5", bg1: "#04121f", bg2: "#01060c", sub: "#dff6ff" },
  sakura:   { label: "Sakura",          c1: "#ffe3ec", c2: "#ff8fb3", c3: "#c2457a", bg1: "#1d0d14", bg2: "#090407", sub: "#fff0f5" },
  horreur:  { label: "Horreur",         c1: "#e8e1d0", c2: "#b30000", c3: "#4a0000", bg1: "#0d0505", bg2: "#000000", sub: "#d9cfc2" },
  arctique: { label: "Arctique",        c1: "#ffffff", c2: "#8fd3ff", c3: "#4a7bd6", bg1: "#0b1620", bg2: "#03070b", sub: "#eaf6ff" },
  militaire:{ label: "Militaire",       c1: "#e2d9b8", c2: "#8b9a46", c3: "#4b5320", bg1: "#11140b", bg2: "#050603", sub: "#ece6cf" },
  royal:    { label: "Royal",           c1: "#f5e2a8", c2: "#9b5de5", c3: "#5a189a", bg1: "#120a1e", bg2: "#05030a", sub: "#efe6ff" },
  arcade:   { label: "Rétro arcade",    c1: "#fff275", c2: "#ff6b35", c3: "#3a86ff", bg1: "#10002b", bg2: "#05000f", sub: "#f0f0ff" },
  pastel:   { label: "Pastel",          c1: "#fff6d6", c2: "#a0c4ff", c3: "#ffadad", bg1: "#1b1a24", bg2: "#0b0a10", sub: "#f5f3ff" },
  lave:     { label: "Lave",            c1: "#ffe08a", c2: "#ff7b00", c3: "#d00000", bg1: "#1a0500", bg2: "#060100", sub: "#ffe9d6" },
  matrix:   { label: "Matrix",          c1: "#d6ffd6", c2: "#00ff41", c3: "#008f11", bg1: "#020d02", bg2: "#000000", sub: "#c8ffc8" },
  synthwave:{ label: "Synthwave",       c1: "#f9f871", c2: "#ff2a6d", c3: "#05d9e8", bg1: "#1a0b2e", bg2: "#07020f", sub: "#ffe6f2" },
  mafia:    { label: "Mafia",           c1: "#f2efe9", c2: "#c8102e", c3: "#6b0f1a", bg1: "#121010", bg2: "#040303", sub: "#e9e4dc" },
  desert:   { label: "Désert",          c1: "#ffe8c2", c2: "#e0a458", c3: "#a0522d", bg1: "#1c120a", bg2: "#080503", sub: "#f7ead6" },
  toxique:  { label: "Toxique",         c1: "#f4ff61", c2: "#a8ff00", c3: "#7a00ff", bg1: "#0c0a14", bg2: "#030205", sub: "#efffd6" },
  bubblegum:{ label: "Bubblegum",       c1: "#ffffff", c2: "#ff77e9", c3: "#7c5cff", bg1: "#1a0f24", bg2: "#08040c", sub: "#ffe9fb" },
};

// Polices des titres (Google Fonts chargées à la demande ; « impact » = police système)
window.BL_FONTS = {
  impact:   { label: "Impact (défaut)",  title: 'Impact, "Arial Black", sans-serif' },
  bebas:    { label: "Bebas Neue",       title: '"Bebas Neue", Impact, sans-serif',       g: "Bebas+Neue" },
  anton:    { label: "Anton",            title: '"Anton", Impact, sans-serif',            g: "Anton" },
  russo:    { label: "Russo One",        title: '"Russo One", Impact, sans-serif',        g: "Russo+One" },
  orbitron: { label: "Orbitron (futur)", title: '"Orbitron", sans-serif',                 g: "Orbitron:wght@700;900" },
  bangers:  { label: "Bangers (BD)",     title: '"Bangers", Impact, sans-serif',          g: "Bangers" },
  marker:   { label: "Permanent Marker", title: '"Permanent Marker", cursive',            g: "Permanent+Marker" },
  pixel:    { label: "Press Start (pixel)", title: '"Press Start 2P", monospace',         g: "Press+Start+2P" },
  montserrat:{ label: "Montserrat",      title: '"Montserrat", sans-serif',               g: "Montserrat:wght@800;900" },
  oswald:   { label: "Oswald",           title: '"Oswald", Impact, sans-serif',           g: "Oswald:wght@600;700" },
  creepster:{ label: "Creepster (horreur)", title: '"Creepster", cursive',               g: "Creepster" },
  cinzel:   { label: "Cinzel (royal)",   title: '"Cinzel", serif',                        g: "Cinzel:wght@700;900" },
};

// Styles visuels des widgets (définis dans styles.css)
window.BL_STYLES = {
  carte:   ["Carte", "Bloc sombre, liseré de couleur"],
  verre:   ["Verre", "Translucide flouté"],
  neon:    ["Néon", "Contour lumineux"],
  gta:     ["GTA", "Bloc noir, barre en haut"],
  minimal: ["Minimal", "Sans fond, texte détouré"],
  plein:   ["Plein", "Aplat de couleur"],
  pilule:  ["Pilule", "Très arrondi, ombre douce"],
  contour: ["Contour", "Fond vide, bordure fine"],
  retro:   ["Rétro", "Pixel, ombre dure décalée"],
  holo:    ["Holo", "Bordure dégradée animée"],
};

window.BL_ANIMS = {
  formes:  "Formes géométriques",
  bandes:  "Grandes bandes",
  braises: "Braises",
  vagues:  "Vagues de lignes",
  etoiles: "Étoiles (hyper-espace)",
  pluie:   "Pluie",
  hexa:    "Hexagones",
  aurore:  "Aurore boréale",
  synthwave: "Synthwave (soleil + grille)",
  reseau:  "Réseau / constellation",
  bokeh:   "Bokeh (bulles de lumière)",
  circuit: "Circuit électronique",
  tunnel:  "Tunnel hypnotique",
  minimal: "Minimal (lumière douce)",
};

// Styles de transition stinger (outils/stinger.py --style …), générés à la demande par le BL Hub
window.BL_STINGERS = {
  bandes: ["Bandes", "Bandes diagonales qui balaient l'écran"],
  volets: ["Volets", "Colonnes qui tombent en cascade"],
  iris:   ["Iris", "Cercle qui s'ouvre depuis le centre"],
  glitch: ["Glitch", "Tranches décalées, effet numérique"],
  eclat:  ["Éclat", "Deux lames qui se croisent en diagonale"],
  pixels: ["Pixels", "Carreaux qui se remplissent au hasard"],
};

// Packs : une DA complète en un clic (thème + police + style + fond + transition)
window.BL_PACKS = {
  patrouille: { label: "Patrouille",     theme: "lspd",      font: "russo",      style: "gta",     anim: "bandes",    stinger: "volets" },
  urgences:   { label: "Urgences",       theme: "ems",       font: "oswald",     style: "carte",   anim: "vagues",    stinger: "eclat" },
  cartel:     { label: "Cartel",         theme: "gang",      font: "anton",      style: "gta",     anim: "braises",   stinger: "bandes" },
  vice:       { label: "Vice Nights",    theme: "synthwave", font: "bebas",      style: "neon",    anim: "synthwave", stinger: "glitch" },
  nightcity:  { label: "Night City",     theme: "cyber",     font: "orbitron",   style: "holo",    anim: "circuit",   stinger: "glitch" },
  mafia:      { label: "Famiglia",       theme: "mafia",     font: "cinzel",     style: "minimal", anim: "bokeh",     stinger: "iris" },
  arcade:     { label: "Arcade",         theme: "arcade",    font: "pixel",      style: "retro",   anim: "hexa",      stinger: "pixels" },
  cauchemar:  { label: "Cauchemar",      theme: "horreur",   font: "creepster",  style: "contour", anim: "pluie",     stinger: "eclat" },
  lagon:      { label: "Lagon",          theme: "ocean",     font: "montserrat", style: "verre",   anim: "bokeh",     stinger: "iris" },
  boreal:     { label: "Boréal",         theme: "arctique",  font: "montserrat", style: "verre",   anim: "aurore",    stinger: "iris" },
  matrix:     { label: "Matrice",        theme: "matrix",    font: "russo",      style: "contour", anim: "reseau",    stinger: "pixels" },
  desert:     { label: "Désert",         theme: "desert",    font: "anton",      style: "plein",   anim: "formes",    stinger: "volets" },
  sakura:     { label: "Hanami",         theme: "sakura",    font: "marker",     style: "pilule",  anim: "bokeh",     stinger: "iris" },
  toxique:    { label: "Toxique",        theme: "toxique",   font: "bangers",    style: "neon",    anim: "tunnel",    stinger: "pixels" },
  palace:     { label: "Palace",         theme: "gold",      font: "cinzel",     style: "carte",   anim: "braises",   stinger: "eclat" },
  sunset:     { label: "Golden hour",    theme: "sunset",    font: "impact",     style: "carte",   anim: "formes",    stinger: "bandes" },
};

// Applique le thème + la police demandés dans l'URL aux variables CSS et renvoie le thème.
window.blTheme = function (q) {
  const base = window.BL_THEMES[q.get("theme")] || window.BL_THEMES.sunset;
  const t = { ...base };
  for (const k of ["c1", "c2", "c3", "bg1", "bg2", "sub"]) if (q.get(k)) t[k] = "#" + q.get(k).replace("#", "");
  const root = document.documentElement.style;
  for (const k of ["c1", "c2", "c3", "bg1", "bg2", "sub"]) root.setProperty(`--${k}`, t[k]);
  const f = window.BL_FONTS[q.get("font")] || window.BL_FONTS.impact;
  if (f.g && !document.querySelector(`link[data-font="${f.g}"]`)) {
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.dataset.font = f.g;
    l.href = `https://fonts.googleapis.com/css2?family=${f.g}&display=swap`;
    document.head.appendChild(l);
  }
  root.setProperty("--font-title", f.title);
  root.setProperty("--font-body", '"Bahnschrift", "Segoe UI", sans-serif');
  t.font = f;
  // réglages fins : arrondi des coins (0 = carré, 1 = normal, 2 = très rond) et lueur (0 à 2)
  root.setProperty("--rad", q.get("arrondi") ?? 1);
  const glow = parseFloat(q.get("lueur") || 0);
  if (glow > 0) {
    root.setProperty("--glow", glow);
    const apply = () => document.body && document.body.classList.add("bl-glow");
    document.body ? apply() : addEventListener("DOMContentLoaded", apply);
  }
  return t;
};

window.blRgba = function (hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};
