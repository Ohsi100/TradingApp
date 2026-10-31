// Eigener, kleiner Kerzenchart (Canvas) mit Volumen, Linien, Markierungen und Antippen.
import { cssVar, zahl } from './util.js';

export class KerzenChart {
  constructor(container, kerzen, { sichtbar, slots, hoehe = 300, polster = 0.08 } = {}) {
    this.kerzen = kerzen;
    this.sichtbar = sichtbar ?? kerzen.length;
    this.slots = slots ?? kerzen.length;
    this.polster = polster;
    this.overlays = [];
    this.tippHandler = null;

    this.box = document.createElement('div');
    this.box.className = 'chart-box';
    this.canvas = document.createElement('canvas');
    this.canvas.style.height = hoehe + 'px';
    const label = document.createElement('div');
    label.className = 'chart-label';
    label.textContent = 'Simulierte Übungsdaten';
    this.box.append(this.canvas, label);
    container.append(this.box);

    this.canvas.addEventListener('click', e => {
      if (!this.tippHandler) return;
      const r = this.canvas.getBoundingClientRect();
      this.tippHandler(this.ausPixel(e.clientX - r.left, e.clientY - r.top));
    });
    this.ro = new ResizeObserver(() => this.zeichnen());
    this.ro.observe(this.canvas);
  }

  beiTipp(fn) { this.tippHandler = fn; this.canvas.style.cursor = fn ? 'crosshair' : ''; }
  setzeSichtbar(n) { this.sichtbar = Math.min(n, this.kerzen.length); this.zeichnen(); }
  setzeOverlays(liste) { this.overlays = liste; this.zeichnen(); }

  // Geometrie berechnen (in CSS-Pixeln)
  layout() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const rechts = 56, links = 6, oben = 24, unten = 18;
    const preisH = (h - oben - unten) * 0.76;
    const volOben = oben + preisH + 6;
    const volH = h - unten - volOben;
    const slotW = (w - links - rechts) / this.slots;

    const sicht = this.kerzen.slice(0, this.sichtbar);
    let min = Math.min(...sicht.map(k => k.l)), max = Math.max(...sicht.map(k => k.h));
    for (const o of this.overlays) {
      for (const p of [o.preis, o.p1, o.p2, o.von, o.bis]) {
        if (typeof p === 'number') { min = Math.min(min, p); max = Math.max(max, p); }
      }
    }
    const pol = (max - min) * this.polster || 1;
    min -= pol; max += pol;
    const maxVol = Math.max(...sicht.map(k => k.v));
    return { w, h, rechts, links, oben, unten, preisH, volOben, volH, slotW, min, max, maxVol };
  }

  y(preis, L) { return L.oben + (L.max - preis) / (L.max - L.min) * L.preisH; }
  x(index, L) { return L.links + (index + 0.5) * L.slotW; }

  ausPixel(px, py) {
    const L = this.layout();
    const roh = Math.floor((px - L.links) / L.slotW);
    const index = Math.max(0, Math.min(this.sichtbar - 1, roh));
    const yy = Math.max(L.oben, Math.min(L.oben + L.preisH, py));
    const preis = L.max - (yy - L.oben) / L.preisH * (L.max - L.min);
    return { index, preis: Math.round(preis * 100) / 100, imPreisbereich: py <= L.oben + L.preisH };
  }

  zeichnen() {
    const c = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const L = this.layout();
    if (!L.w) return;
    c.width = Math.round(L.w * dpr);
    c.height = Math.round(L.h * dpr);
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, L.w, L.h);

    const farbe = {
      gruen: cssVar('--gruen'), rot: cssVar('--rot'), text2: cssVar('--text2'),
      rand: cssVar('--rand'), akzent: cssVar('--akzent'), gelb: cssVar('--gelb'), text: cssVar('--text')
    };
    const f = n => farbe[n] ?? n;

    // Gitter + Preisachse
    g.font = '11px system-ui, sans-serif';
    g.textBaseline = 'middle';
    const schritt = schoenerSchritt((L.max - L.min) / 5);
    g.strokeStyle = farbe.rand; g.fillStyle = farbe.text2; g.lineWidth = 1;
    for (let p = Math.ceil(L.min / schritt) * schritt; p <= L.max; p += schritt) {
      const yy = Math.round(this.y(p, L)) + 0.5;
      g.globalAlpha = 0.5;
      g.beginPath(); g.moveTo(L.links, yy); g.lineTo(L.w - L.rechts, yy); g.stroke();
      g.globalAlpha = 1;
      g.fillText(zahl(p, schritt < 1 ? 2 : 0), L.w - L.rechts + 6, yy);
    }
    // Tage-Achse
    g.textBaseline = 'alphabetic';
    for (let i = 9; i < this.slots; i += 10) {
      g.fillText(String(i + 1), this.x(i, L) - 6, L.h - 4);
    }

    // Zonen (hinter den Kerzen)
    for (const o of this.overlays.filter(o => o.typ === 'zone')) {
      g.fillStyle = f(o.farbe ?? 'akzent'); g.globalAlpha = 0.15;
      const y1 = this.y(o.bis, L), y2 = this.y(o.von, L);
      g.fillRect(L.links, y1, L.w - L.rechts - L.links, y2 - y1);
      g.globalAlpha = 1;
    }
    // Bereich "Zukunft" leicht markieren
    for (const o of this.overlays.filter(o => o.typ === 'ab')) {
      g.fillStyle = farbe.rand; g.globalAlpha = 0.25;
      const xx = L.links + o.index * L.slotW;
      g.fillRect(xx, L.oben, L.w - L.rechts - xx, L.volOben + L.volH - L.oben);
      g.globalAlpha = 1;
    }

    // Kerzen + Volumen
    const kw = Math.max(1, Math.min(14, L.slotW * 0.7));
    for (let i = 0; i < this.sichtbar; i++) {
      const k = this.kerzen[i];
      const hoch = k.c >= k.o;
      g.fillStyle = g.strokeStyle = hoch ? farbe.gruen : farbe.rot;
      const xx = this.x(i, L);
      g.beginPath(); g.moveTo(Math.round(xx) + 0.5, this.y(k.h, L)); g.lineTo(Math.round(xx) + 0.5, this.y(k.l, L)); g.stroke();
      const y1 = this.y(Math.max(k.o, k.c), L), y2 = this.y(Math.min(k.o, k.c), L);
      g.fillRect(xx - kw / 2, y1, kw, Math.max(1, y2 - y1));
      g.globalAlpha = 0.45;
      const vh = k.v / L.maxVol * L.volH;
      g.fillRect(xx - kw / 2, L.volOben + L.volH - vh, kw, vh);
      g.globalAlpha = 1;
    }

    // Linien, Strecken, Markierungen
    for (const o of this.overlays) {
      g.strokeStyle = g.fillStyle = f(o.farbe ?? 'akzent');
      g.lineWidth = o.dick ?? 2;
      g.setLineDash(o.gestrichelt ? [6, 4] : []);
      if (o.typ === 'linie') {
        const yy = this.y(o.preis, L);
        g.beginPath(); g.moveTo(L.links, yy); g.lineTo(L.w - L.rechts, yy); g.stroke();
        g.setLineDash([]);
        const t = zahl(o.preis);
        g.fillRect(L.w - L.rechts, yy - 9, L.rechts, 18);
        g.fillStyle = '#fff'; g.textBaseline = 'middle';
        g.fillText(t, L.w - L.rechts + 4, yy);
        if (o.text) {
          g.fillStyle = f(o.farbe ?? 'akzent');
          g.textBaseline = 'bottom';
          g.fillText(o.text, L.links + 4, yy - 3);
        }
      } else if (o.typ === 'strecke') {
        g.beginPath(); g.moveTo(this.x(o.i1, L), this.y(o.p1, L)); g.lineTo(this.x(o.i2, L), this.y(o.p2, L)); g.stroke();
      } else if (o.typ === 'marker') {
        const k = this.kerzen[o.index];
        const preis = o.preis ?? (o.unten ? k.l : k.h);
        const xx = this.x(o.index, L), yy = this.y(preis, L) + (o.unten ? 12 : -12);
        g.setLineDash([]);
        g.beginPath(); g.arc(xx, yy, 7, 0, Math.PI * 2); g.stroke();
        if (o.text) {
          g.textBaseline = 'middle';
          const tw = g.measureText(o.text).width;
          const tx = Math.min(Math.max(L.links, xx - tw / 2), L.w - L.rechts - tw);
          g.fillText(o.text, tx, yy + (o.unten ? 18 : -18));
        }
      } else if (o.typ === 'senkrecht') {
        const xx = this.x(o.index, L);
        g.beginPath(); g.moveTo(xx, L.oben); g.lineTo(xx, L.volOben + L.volH); g.stroke();
      }
      g.setLineDash([]);
    }
  }

  entfernen() { this.ro.disconnect(); }
}

function schoenerSchritt(roh) {
  const p = Math.pow(10, Math.floor(Math.log10(roh)));
  const n = roh / p;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p;
}
