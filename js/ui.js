// Kleine Helfer für Ionic-Bausteine und das "Gefühl" der App:
// Toasts, Bestätigungsdialoge, Vibration, hochzählende Zahlen.
import { d } from './store.js';
import { zahl } from './util.js';

export async function toast(nachricht, { dauer = 2500, farbe, knopf } = {}) {
  const t = document.createElement('ion-toast');
  t.message = nachricht;
  t.duration = knopf ? 0 : dauer;
  t.position = 'bottom';
  t.positionAnchor = 'tabbar';
  if (farbe) t.color = farbe;
  if (knopf) t.buttons = [{ text: knopf.text, handler: knopf.aktion }];
  document.querySelector('ion-app').append(t);
  t.addEventListener('didDismiss', () => t.remove());
  await customElements.whenDefined('ion-toast');
  return t.present();
}

// Bestätigung nur bei Löschen bzw. Überschreiben (siehe Designvorgaben).
export function bestaetigen(titel, text, knopfText) {
  return new Promise(async aufloesen => {
    const a = document.createElement('ion-alert');
    a.header = titel;
    a.message = text;
    a.buttons = [
      { text: 'Abbrechen', role: 'cancel' },
      { text: knopfText, role: 'destructive', cssClass: 'alert-gefahr' }
    ];
    document.querySelector('ion-app').append(a);
    a.addEventListener('didDismiss', e => { a.remove(); aufloesen(e.detail.role === 'destructive'); });
    await customElements.whenDefined('ion-alert');
    a.present();
  });
}

// Kurze Vibration (nur Android). Abschaltbar unter Fortschritt → Einstellungen.
const MUSTER = {
  tipp: 8,
  richtig: 18,
  falsch: [40, 60, 40],
  ziel: [20, 40, 20, 40, 60],
  stop: 140
};
export function vibriere(art) {
  try {
    if (d().einstellungen?.vibration === false || !navigator.vibrate) return;
    navigator.vibrate(MUSTER[art] ?? 10);
  } catch { /* nicht unterstützt */ }
}

export const ruhigeBewegung = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Zahlen hochzählen lassen: <span data-hoch="42" data-stellen="0" data-vor="+" data-nach=" %">0</span>
export function zaehleHoch(wurzel, dauer = 250) {
  wurzel.querySelectorAll('[data-hoch]').forEach(el => {
    const ziel = Number(el.dataset.hoch), stellen = Number(el.dataset.stellen ?? 0);
    const vor = el.dataset.vor ?? '', nach = el.dataset.nach ?? '';
    const text = x => `${vor && x > 0 ? vor : ''}${zahl(x, stellen)}${nach}`;
    if (ruhigeBewegung() || !ziel) { el.textContent = text(ziel); return; }
    const t0 = performance.now();
    const schritt = t => {
      const k = Math.min(1, (t - t0) / dauer), e = 1 - Math.pow(1 - k, 3);
      el.textContent = text(ziel * e);
      if (k < 1) requestAnimationFrame(schritt);
    };
    requestAnimationFrame(schritt);
    // Falls der Browser die Animation pausiert (App im Hintergrund): Endwert trotzdem setzen
    setTimeout(() => { el.textContent = text(ziel); }, dauer + 100);
  });
}
