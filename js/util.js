// Kleine Hilfsfunktionen, die überall gebraucht werden.

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Einfache Textauszeichnung für die JSON-Inhalte:
// **fett**, _englischer Begriff_ (grau kursiv), Absatz = Leerzeile, Liste = Zeilen mit "- ".
export function markup(text) {
  const inline = s => esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(^|[\s(])_(.+?)_(?=[\s.,;:!?)]|$)/g, '$1<span class="en">$2</span>');
  return String(text ?? '').trim().split(/\n\s*\n/).map(block => {
    const zeilen = block.split('\n');
    if (zeilen.every(z => z.trim().startsWith('- '))) {
      return '<ul>' + zeilen.map(z => `<li>${inline(z.trim().slice(2))}</li>`).join('') + '</ul>';
    }
    return `<p>${zeilen.map(inline).join('<br>')}</p>`;
  }).join('');
}

export function mischen(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Datum als "JJJJ-MM-TT" in Ortszeit.
export function heute() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function tageZwischen(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

export function zahl(x, stellen = 2) {
  return Number(x).toLocaleString('de-DE', { minimumFractionDigits: stellen, maximumFractionDigits: stellen });
}

// Deutsche Zahleneingabe lesen: "1.234,5" oder "1234.5" oder "12,5"
export function leseZahl(s) {
  s = String(s).trim().replace(/\s|€|%/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
