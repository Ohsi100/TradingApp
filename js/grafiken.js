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
  },

  // Aufbau einer Kerze (grün und rot)
  kerze() {
    const kerzeSvg = (x, farbe, oben, unten, beschr) => `
      <line x1="${x}" x2="${x}" y1="20" y2="160" style="stroke:var(${farbe});stroke-width:3"/>
      <rect x="${x - 22}" y="${oben}" width="44" height="${unten - oben}" rx="3" style="fill:var(${farbe})"/>
      ${beschr}`;
    const t = (x, y, text, anker = 'end') => `<text x="${x}" y="${y + 4}" text-anchor="${anker}" ${T2}>${text}</text>`;
    return `<svg viewBox="0 0 320 185" role="img" aria-label="Aufbau einer grünen und einer roten Kerze">
      ${kerzeSvg(95, '--positiv', 55, 120, t(65, 20, 'Hoch') + t(65, 55, 'Schluss') + t(65, 120, 'Eröffnung') + t(65, 160, 'Tief'))}
      ${kerzeSvg(225, '--negativ', 55, 120, t(255, 20, 'Hoch', 'start') + t(255, 55, 'Eröffnung', 'start') + t(255, 120, 'Schluss', 'start') + t(255, 160, 'Tief', 'start'))}
      <text x="160" y="40" text-anchor="middle" ${T2}>Docht</text>
      <text x="160" y="92" text-anchor="middle" ${T}>Körper</text>
      <text x="160" y="142" text-anchor="middle" ${T2}>Docht</text>
      <text x="95" y="180" text-anchor="middle" ${T}>gestiegen</text>
      <text x="225" y="180" text-anchor="middle" ${T}>gefallen</text>
    </svg>`;
  },

  // Chance-Risiko-Verhältnis: Einstieg, Stop, Ziel
  crv({ einstieg = 50, stop = 48.5, ziel = 53 }) {
    const risiko = einstieg - stop, chance = ziel - einstieg;
    const sk = 120 / (ziel - stop), y = p => 20 + (ziel - p) * sk;
    return `<svg viewBox="0 0 320 165" role="img" aria-label="Chance-Risiko-Verhältnis">
      <rect x="40" y="${y(ziel)}" width="120" height="${y(einstieg) - y(ziel)}" style="fill:var(--positiv-weich)"/>
      <rect x="40" y="${y(einstieg)}" width="120" height="${y(stop) - y(einstieg)}" style="fill:var(--negativ-weich)"/>
      <line x1="40" x2="160" y1="${y(ziel)}" y2="${y(ziel)}" style="stroke:var(--positiv);stroke-width:2"/>
      <line x1="40" x2="160" y1="${y(einstieg)}" y2="${y(einstieg)}" style="stroke:var(--akzent);stroke-width:2"/>
      <line x1="40" x2="160" y1="${y(stop)}" y2="${y(stop)}" style="stroke:var(--negativ);stroke-width:2"/>
      <text x="34" y="${y(ziel) + 4}" text-anchor="end" ${T2}>${zahl(ziel)}</text>
      <text x="34" y="${y(einstieg) + 4}" text-anchor="end" ${T2}>${zahl(einstieg)}</text>
      <text x="34" y="${y(stop) + 4}" text-anchor="end" ${T2}>${zahl(stop)}</text>
      <text x="170" y="${y(ziel) + 4}" ${T}>Kursziel</text>
      <text x="170" y="${(y(ziel) + y(einstieg)) / 2 + 4}" ${T2}>Chance ${zahl(chance)} €</text>
      <text x="170" y="${y(einstieg) + 4}" ${T}>Einstieg</text>
      <text x="170" y="${y(stop) + 4}" ${T}>Stop-Loss</text>
      <text x="170" y="${(y(einstieg) + y(stop)) / 2 + 6}" ${T2}>Risiko ${zahl(risiko)} € = 1 R</text>
      <text x="160" y="160" text-anchor="middle" ${T}>CRV = ${zahl(chance)} : ${zahl(risiko)} = ${zahl(chance / risiko, 1)} : 1</text>
    </svg>`;
  },

  // Aufwärtstrend: höhere Hochs und höhere Tiefs
  trend() {
    const p = [[15, 150], [70, 95], [105, 125], [160, 65], [195, 100], [255, 30], [295, 60]];
    const labels = [[70, 95, 'Hoch', -12], [105, 125, 'Tief', 20], [160, 65, 'höheres Hoch', -12], [195, 100, 'höheres Tief', 20], [255, 30, 'höheres Hoch', -12]];
    return `<svg viewBox="0 0 320 165" role="img" aria-label="Aufwärtstrend mit höheren Hochs und höheren Tiefs">
      <line x1="15" y1="150" x2="300" y2="85" style="stroke:var(--akzent);stroke-width:2;stroke-dasharray:6 4"/>
      <polyline points="${p.map(q => q.join(',')).join(' ')}" style="fill:none;stroke:var(--positiv);stroke-width:3;stroke-linejoin:round"/>
      ${labels.map(([x, y, t, dy]) => `<circle cx="${x}" cy="${y}" r="4" style="fill:var(--text)"/><text x="${x}" y="${y + dy}" text-anchor="middle" ${T2}>${t}</text>`).join('')}
      <text x="300" y="100" text-anchor="end" ${T2}>Trendlinie</text>
    </svg>`;
  },

  // Wo liegen welche Orders im Verhältnis zum aktuellen Kurs?
  ordertypen() {
    const zeile = (y, links, rechts, farbe) => `
      <line x1="20" x2="300" y1="${y}" y2="${y}" style="stroke:var(${farbe});stroke-width:2;stroke-dasharray:5 4"/>
      <text x="24" y="${y - 6}" ${T2}>${links}</text><text x="296" y="${y - 6}" text-anchor="end" ${T2}>${rechts}</text>`;
    return `<svg viewBox="0 0 320 205" role="img" aria-label="Ordertypen über und unter dem aktuellen Kurs">
      <text x="24" y="16" ${T}>Kaufen</text><text x="296" y="16" text-anchor="end" ${T}>Verkaufen</text>
      ${zeile(48, 'Stop-Buy 53 €', 'Verkaufs-Limit 55 €', '--warnung')}
      <line x1="20" x2="300" y1="105" y2="105" style="stroke:var(--akzent);stroke-width:3"/>
      <text x="160" y="99" text-anchor="middle" ${T}>aktueller Kurs 50 €</text>
      ${zeile(160, 'Kauf-Limit 47 €', 'Stop-Loss 45 €', '--warnung')}
      <text x="24" y="180" ${T2}>Limit: nur zu diesem Preis</text><text x="24" y="196" ${T2}>oder besser</text>
      <text x="296" y="180" text-anchor="end" ${T2}>Stop: wird bei Erreichen</text><text x="296" y="196" text-anchor="end" ${T2}>zur Market-Order</text>
    </svg>`;
  },

  // Verluste wirken asymmetrisch: Wie viel Gewinn braucht man, um einen Verlust aufzuholen?
  asymmetrie() {
    const reihen = [[10, 11.1], [20, 25], [30, 42.9], [50, 100], [80, 400]];
    return `<svg viewBox="0 0 320 175" role="img" aria-label="Benötigter Gewinn nach einem Verlust">
      <text x="10" y="14" ${T2}>Verlust</text><text x="130" y="14" ${T2}>nötiger Gewinn, um aufzuholen</text>
      ${reihen.map(([v, g], i) => {
        const y = 30 + i * 28, breite = Math.min(g, 160) * 1.05;
        return `<rect x="${70 - v * 0.6}" y="${y}" width="${v * 0.6}" height="16" rx="3" style="fill:var(--negativ)"/>
          <text x="${70 - v * 0.6 - 4}" y="${y + 12}" text-anchor="end" ${T2}>−${v} %</text>
          <rect x="78" y="${y}" width="${breite}" height="16" rx="3" style="fill:var(--positiv)"/>
          <text x="${84 + breite}" y="${y + 12}" ${T}>+${zahl(g, g % 1 ? 1 : 0)} %${g > 160 ? ' →' : ''}</text>`;
      }).join('')}
    </svg>`;
  }
};

// Mini-Charts in Lektionen werden erst nach dem Einfügen gezeichnet (siehe app.js)
export function grafik(def) {
  if (def?.typ === 'chart') return `<div class="grafik grafik-chart" data-chart="${encodeURIComponent(JSON.stringify(def))}"></div>`;
  const fn = def && grafiken[def.typ];
  return fn ? `<div class="grafik">${fn(def)}</div>` : '';
}

export const GRAFIK_TYPEN = [...Object.keys(grafiken), 'chart'];
