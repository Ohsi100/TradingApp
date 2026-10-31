// Kleine Erklär-Grafiken für die Lektionen (SVG). Aufruf aus der JSON: "grafik": { "typ": "spread", ... }
import { zahl } from './util.js';

const T = 'style="fill:var(--text);font:600 14px Inter,system-ui,sans-serif"';
const T2 = 'style="fill:var(--text-gedaempft);font:13px Inter,system-ui,sans-serif"';

const grafiken = {
  spread({ bid = 99.9, ask = 100.1 }) {
    return `<svg viewBox="0 0 320 170" role="img" aria-label="Geldkurs und Briefkurs mit Spread">
      <rect x="20" y="20" width="130" height="56" rx="10" style="fill:var(--positiv-weich);stroke:var(--positiv)"/>
      <text x="85" y="42" text-anchor="middle" ${T2}>Briefkurs (Ask)</text>
      <text x="85" y="64" text-anchor="middle" ${T}>${zahl(ask)} €</text>
      <rect x="20" y="96" width="130" height="56" rx="10" style="fill:var(--negativ-weich);stroke:var(--negativ)"/>
      <text x="85" y="118" text-anchor="middle" ${T2}>Geldkurs (Bid)</text>
      <text x="85" y="140" text-anchor="middle" ${T}>${zahl(bid)} €</text>
      <path d="M165 48 h18 v76 h-18" style="fill:none;stroke:var(--warnung);stroke-width:2"/>
      <text x="195" y="82" ${T}>Spread</text>
      <text x="195" y="102" ${T2}>${zahl(ask - bid)} €</text>
      <text x="300" y="42" text-anchor="end" ${T2}>hier kaufst du</text>
      <text x="300" y="130" text-anchor="end" ${T2}>hier verkaufst du</text>
    </svg>`;
  },

  longshort() {
    return `<svg viewBox="0 0 320 150" role="img" aria-label="Long gewinnt bei steigenden, Short bei fallenden Kursen">
      <text x="80" y="18" text-anchor="middle" ${T}>Long</text>
      <polyline points="20,120 50,105 70,112 100,80 120,88 145,50" style="fill:none;stroke:var(--positiv);stroke-width:3"/>
      <text x="80" y="142" text-anchor="middle" ${T2}>Gewinn, wenn es steigt</text>
      <text x="240" y="18" text-anchor="middle" ${T}>Short</text>
      <polyline points="180,45 210,60 230,52 260,85 280,78 305,118" style="fill:none;stroke:var(--negativ);stroke-width:3"/>
      <text x="240" y="142" text-anchor="middle" ${T2}>Gewinn, wenn es fällt</text>
    </svg>`;
  },

  haltedauer() {
    const zeile = (y, name, x1, x2, text, farbe) => `
      <text x="0" y="${y + 15}" ${T}>${name}</text>
      <rect x="${x1}" y="${y}" width="${x2 - x1}" height="20" rx="6" style="fill:${farbe}"/>
      <text x="${x2 + 6}" y="${y + 15}" ${T2}>${text}</text>`;
    return `<svg viewBox="0 0 320 130" role="img" aria-label="Haltedauer der Trading-Stile">
      ${zeile(8, 'Day', 110, 122, 'Stunden', 'var(--negativ)')}
      ${zeile(48, 'Swing', 110, 175, 'Tage–Wochen', 'var(--akzent)')}
      ${zeile(88, 'Buy & Hold', 110, 250, 'Jahre', 'var(--positiv)')}
    </svg>`;
  }
};

export function grafik(def) {
  const fn = def && grafiken[def.typ];
  return fn ? `<div class="grafik">${fn(def)}</div>` : '';
}
