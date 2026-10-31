// Lernfortschritt: liegt nur im Browser des Handys (localStorage).
// Falls der Speicher gesperrt ist, läuft die App trotzdem (dann nur bis zum Schließen).

const SCHLUESSEL = 'tla-fortschritt-v1';

function leer() {
  return {
    format: 1,
    karten: {},      // Begriff-ID -> { box, faellig, gesehen, falsch, richtig }
    tage: {},        // Tag-Nr -> { lektion: bool, lektionPos, quiz: { beste, letzte, versuche }, uebungen: { id: { erledigt, r, zeit } }, abgeschlossen }
    aktiv: [],       // Daten ("JJJJ-MM-TT"), an denen gelernt wurde (für die Lernserie)
    einstellungen: { vibration: true }
  };
}

// Heute als Lerntag merken (für die Lernserie)
export function aktivitaet() {
  const h = heute();
  if (!daten.aktiv.includes(h)) { daten.aktiv.push(h); speichern(); }
}

// Wie viele Tage in Folge gelernt? Zählt ab heute, oder ab gestern, wenn heute noch nichts passiert ist.
export function lernserie() {
  const tage = new Set(daten.aktiv);
  const t = new Date();
  if (!tage.has(heute())) t.setDate(t.getDate() - 1);
  let n = 0;
  while (tage.has(datumText(t))) { n++; t.setDate(t.getDate() - 1); }
  return { tage: n, heuteGelernt: tage.has(heute()) };
}

const datumText = t => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
const heute = () => datumText(new Date());

let daten = leer();
let speicherOk = true;

export function laden() {
  try {
    const roh = localStorage.getItem(SCHLUESSEL);
    if (roh) {
      const gespeichert = JSON.parse(roh);
      daten = Object.assign(leer(), gespeichert);
      daten.einstellungen = { ...leer().einstellungen, ...gespeichert.einstellungen };
    }
  } catch {
    speicherOk = false;
  }
  return daten;
}

export function speichern() {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(daten));
    speicherOk = true;
  } catch {
    speicherOk = false;
  }
}

export const istSpeicherOk = () => speicherOk;
export const d = () => daten;

export function tag(nr) {
  const t = daten.tage[nr] ??= {};
  t.quiz ??= { beste: null, letzte: null, versuche: 0 };
  t.uebungen ??= {};
  return t;
}

export function exportieren() {
  return JSON.stringify({ app: 'trading-lernapp', exportiert: new Date().toISOString(), version: self.APP_VERSION, daten }, null, 2);
}

export function importieren(text) {
  const obj = JSON.parse(text);
  if (obj?.app !== 'trading-lernapp' || typeof obj.daten !== 'object') {
    throw new Error('Das ist keine Sicherungsdatei der Trading-Lernapp.');
  }
  daten = Object.assign(leer(), obj.daten);
  speichern();
}

export function zuruecksetzen() {
  const einstellungen = daten.einstellungen;
  daten = leer();
  daten.einstellungen = { ...daten.einstellungen, ...einstellungen };
  speichern();
}
