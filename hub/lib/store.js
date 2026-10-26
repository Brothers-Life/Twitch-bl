// Fichiers JSON du dossier data/ : lecture au démarrage, écriture différée (évite d'écrire à chaque message).
const fs = require("fs");
const path = require("path");

const DATA = path.join(__dirname, "..", "data");
fs.mkdirSync(DATA, { recursive: true });

function deepMerge(base, over) {
  if (Array.isArray(base) || typeof base !== "object" || base === null) return over === undefined ? base : over;
  const out = { ...base };
  for (const k of Object.keys(over || {})) out[k] = k in base ? deepMerge(base[k], over[k]) : over[k];
  return out;
}

function load(name, defaults) {
  const file = path.join(DATA, name);
  let data = defaults;
  try { data = deepMerge(defaults, JSON.parse(fs.readFileSync(file, "utf8"))); } catch {}
  let timer = null;
  const store = {
    data,
    save() {
      clearTimeout(timer);
      timer = setTimeout(() => fs.writeFileSync(file, JSON.stringify(store.data, null, 2)), 500);
    },
    flush() {
      clearTimeout(timer);
      fs.writeFileSync(file, JSON.stringify(store.data, null, 2));
    },
  };
  return store;
}

module.exports = { load, deepMerge };
