// Leitner-System: 5 Fächer. Richtig = ein Fach weiter, falsch = zurück in Fach 1.
// Je höher das Fach, desto seltener kommt die Karte dran.
import { d, speichern, aktivitaet } from './store.js';
import { heute, tageZwischen } from './util.js';

export const ABSTAND = [0, 1, 2, 4, 7]; // Tage bis zur nächsten Abfrage, je Fach 1–5

export function status(id) {
  return d().karten[id] ?? null;
}

export function istFaellig(id, datum = heute()) {
  const s = status(id);
  return !!s && tageZwischen(s.faellig, datum) >= 0;
}

// ergebnis: 'gewusst' | 'unsicher' | 'nicht'
export function bewerten(id, ergebnis) {
  const karten = d().karten;
  const s = karten[id] ?? { box: 1, gesehen: 0, falsch: 0, richtig: 0 };
  s.gesehen++;
  if (ergebnis === 'gewusst') {
    s.box = Math.min(5, s.box + 1);
    s.richtig++;
  } else if (ergebnis === 'unsicher') {
    s.box = Math.min(s.box, 2);
    s.falsch++;
  } else {
    s.box = 1;
    s.falsch++;
  }
  // Fach 1 kommt noch heute wieder dran, alle anderen nach ABSTAND Tagen.
  const t = new Date();
  t.setDate(t.getDate() + ABSTAND[s.box - 1]);
  s.faellig = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  s.zuletzt = heute();
  karten[id] = s;
  speichern();
  aktivitaet();
}

export const istSicher = id => (status(id)?.box ?? 0) >= 4;
export const istWackel = id => { const s = status(id); return !!s && s.falsch > 0 && s.box <= 2; };
export const istGesehen = id => !!status(id);
