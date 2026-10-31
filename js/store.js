// Lernfortschritt: liegt nur im Browser des Handys (localStorage).
// Falls der Speicher gesperrt ist, läuft die App trotzdem (dann nur bis zum Schließen).

const SCHLUESSEL = 'tla-fortschritt-v1';

function leer() {
  return {
    format: 1,
    karten: {},      // Begriff-ID -> { box, faellig, gesehen, falsch, richtig }
    tage: {},        // Tag-Nr -> { lektion: bool, quiz: { beste, letzte, versuche }, uebungen: { id: { erledigt, r } } }
    einstellungen: { theme: 'dunkel' }
  };
}

let daten = leer();
let speicherOk = true;

export function laden() {
  try {
    const roh = localStorage.getItem(SCHLUESSEL);
    if (roh) daten = Object.assign(leer(), JSON.parse(roh));
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
  const theme = daten.einstellungen?.theme;
  daten = leer();
  if (theme) daten.einstellungen.theme = theme;
  speichern();
}
