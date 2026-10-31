// Eigener Kerzenchart (Canvas) mit Volumen, Linien, Markierungen, Antippen,
// Fadenkreuz (Finger gedrückt halten bzw. Maus darüber) und ziehbaren Linien.
import { cssVar, zahl } from './util.js';
import { vibriere } from './ui.js';
import { linieFuer, rsi, macd } from './indikatoren.js';

const LINIENFARBEN = ['akzent', 'gelb', 'text2'];   // Reihenfolge für gleitende Durchschnitte

const HALTEZEIT = 280;   // ms gedrückt halten, bis das Fadenkreuz erscheint
const WACKELN = 8;       // px Bewegung, ab der es kein Tippen mehr ist
const GREIFNAEHE = 20;   // px Abstand, in dem eine ziehbare Linie gegriffen wird
const ANIM = 220;        // ms für weiche Änderungen des Preisbereichs

export class KerzenChart {
  // Optionen: indikatoren [{typ:'sma'|'ema', laenge}], unterfenster 'volumen'|'rsi'|'macd'|'keins',
  // art 'kerzen'|'linie', skala 'linear'|'log'
  constructor(container, kerzen, { sichtbar, slots, hoehe = 300, polster = 0.08, indikatoren = [], unterfenster = 'volumen', art = 'kerzen', skala = 'linear' } = {}) {
    this.kerzen = kerzen;
    this.sichtbar = sichtbar ?? kerzen.length;
    this.slots = slots ?? kerzen.length;
    this.polster = polster;
    this.art = art;
    this.log = skala === 'log';
    this.unterfenster = unterfenster;
    this.indikatoren = indikatoren.map((def, i) => ({ ...def, farbe: def.farbe ?? LINIENFARBEN[i % 3], werte: linieFuer(kerzen, def) }));
    if (unterfenster === 'rsi') this.rsi = rsi(kerzen);
    if (unterfenster === 'macd') this.macd = macd(kerzen);
    this.overlays = [];
    this.tippHandler = null;
    this.ziehHandler = null;
    this.kreuz = null;        // { x, y } in CSS-Pixeln, solange das Fadenkreuz aktiv ist
    this.zieht = null;        // id der Linie, die gerade gezogen wird
    this.bereich = null;      // aktuell angezeigter Preisbereich { min, max }
    this.anim = null;

    this.box = document.createElement('div');
    this.box.className = 'chart-box';
    this.box.chart = this;   // für das automatische Durchspielen der Übungen (Tests)
    this.canvas = document.createElement('canvas');
    this.canvas.style.height = hoehe + 'px';
    const label = document.createElement('div');
    label.className = 'chart-label';
    const legende = this.indikatoren.map(d => `<span class="legende" style="--farbe:var(${{ akzent: '--akzent', gelb: '--warnung', text2: '--text-gedaempft' }[d.farbe] ?? '--akzent'})">${d.typ === 'ema' ? 'EMA' : 'SMA'} ${d.laenge}</span>`).join('');
    label.innerHTML = `Simulierte Übungsdaten${legende}${this.log ? '<span class="legende-text">log. Skala</span>' : ''}`;
    this.info = document.createElement('div');
    this.info.className = 'chart-info';
    this.info.hidden = true;
    this.box.append(this.canvas, label, this.info);
    container.append(this.box);

    this.zeigerEreignisse();
    this.ro = new ResizeObserver(() => this.zeichnen());
    this.ro.observe(this.canvas);
  }

  beiTipp(fn) { this.tippHandler = fn; }
  beiZiehen(fn) { this.ziehHandler = fn; }
  setzeSichtbar(n) { this.sichtbar = Math.min(n, this.kerzen.length); this.zeichnen(); }
  setzeOverlays(liste) { this.overlays = liste; this.zeichnen(); }

  // ---------- Bedienung ----------
  zeigerEreignisse() {
    const c = this.canvas;
    let start = null, timer = null;
    const pos = e => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    // Finger "festhalten", damit Bewegungen auch außerhalb des Charts ankommen (schlägt fehl, wenn er schon weg ist)
    const festhalten = id => { try { c.setPointerCapture(id); } catch { /* Finger bereits losgelassen */ } };

    c.addEventListener('pointerdown', e => {
      const p = pos(e);
      start = { ...p, bewegt: false };
      const linie = this.ziehHandler && this.linieBei(p.y);
      if (linie) {
        this.zieht = linie.id;
        festhalten(e.pointerId);
        vibriere('tipp');
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (start && !start.bewegt) {
          this.kreuz = start;
          festhalten(e.pointerId);
          vibriere('tipp');
          this.zeichneJetzt();
        }
      }, HALTEZEIT);
    });

    c.addEventListener('pointermove', e => {
      const p = pos(e);
      if (this.zieht) {
        this.ziehHandler(this.zieht, this.preisBei(p.y));
        return;
      }
      if (this.kreuz) { this.kreuz = p; this.zeichneJetzt(); return; }
      if (start && Math.hypot(p.x - start.x, p.y - start.y) > WACKELN) { start.bewegt = true; clearTimeout(timer); }
      // Maus am PC: Fadenkreuz schon beim Darüberfahren
      if (e.pointerType === 'mouse' && e.buttons === 0) { this.mausKreuz = p; this.zeichneJetzt(); }
    });

    const ende = (e, abbruch) => {
      clearTimeout(timer);
      if (this.zieht) { this.zieht = null; this.zeichneJetzt(); }
      else if (this.kreuz) { this.kreuz = null; this.zeichneJetzt(); }
      else if (!abbruch && start && !start.bewegt && this.tippHandler) {
        vibriere('tipp');
        this.tippHandler(this.ausPixel(start.x, start.y));
      }
      start = null;
    };
    c.addEventListener('pointerup', e => ende(e, false));
    c.addEventListener('pointercancel', e => ende(e, true));
    c.addEventListener('pointerleave', () => { if (this.mausKreuz) { this.mausKreuz = null; this.zeichneJetzt(); } });
    // Während Fadenkreuz oder Ziehen darf die Seite nicht scrollen
    c.addEventListener('touchmove', e => { if (this.kreuz || this.zieht) e.preventDefault(); }, { passive: false });
    c.addEventListener('contextmenu', e => e.preventDefault());
  }

  linieBei(py) {
    const L = this.layout();
    let beste = null;
    for (const o of this.overlays) {
      if (o.typ !== 'linie' || !o.ziehbar) continue;
      const d = Math.abs(this.y(o.preis, L) - py);
      if (d < GREIFNAEHE && (!beste || d < beste.d)) beste = { id: o.id, d };
    }
    return beste;
  }

  preisBei(py) {
    const L = this.layout();
    const t = (Math.max(L.oben, Math.min(L.oben + L.preisH, py)) - L.oben) / L.preisH;
    const preis = this.log
      ? Math.exp(Math.log(L.max) - t * (Math.log(L.max) - Math.log(L.min)))
      : L.max - t * (L.max - L.min);
    return Math.round(preis * 100) / 100;
  }

  ausPixel(px, py) {
    const L = this.layout();
    const roh = Math.floor((px - L.links) / L.slotW);
    const index = Math.max(0, Math.min(this.sichtbar - 1, roh));
    return { index, preis: this.preisBei(py), imPreisbereich: py <= L.oben + L.preisH };
  }

  // ---------- Geometrie ----------
  zielBereich() {
    const sicht = this.kerzen.slice(0, this.sichtbar);
    let min = Math.min(...sicht.map(k => k.l)), max = Math.max(...sicht.map(k => k.h));
    for (const ind of this.indikatoren) {
      for (const v of ind.werte.slice(0, this.sichtbar)) if (v !== null) { min = Math.min(min, v); max = Math.max(max, v); }
    }
    for (const o of this.overlays) {
      for (const p of [o.preis, o.p1, o.p2, o.von, o.bis]) {
        if (typeof p === 'number') { min = Math.min(min, p); max = Math.max(max, p); }
      }
    }
    const pol = (max - min) * this.polster || 1;
    return { min: min - pol, max: max + pol };
  }

  layout() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const rechts = 58, links = 6, oben = 26, unten = 18;
    const anteil = this.unterfenster === 'keins' ? 1 : this.unterfenster === 'volumen' ? 0.76 : 0.6;
    const preisH = (h - oben - unten) * anteil;
    const volOben = oben + preisH + 6;
    const volH = Math.max(0, h - unten - volOben);
    const slotW = (w - links - rechts) / this.slots;
    const b = this.bereich ?? this.zielBereich();
    const maxVol = Math.max(...this.kerzen.slice(0, this.sichtbar).map(k => k.v));
    return { w, h, rechts, links, oben, unten, preisH, volOben, volH, slotW, min: b.min, max: b.max, maxVol };
  }

  y(preis, L) {
    const t = this.log
      ? (Math.log(L.max) - Math.log(preis)) / (Math.log(L.max) - Math.log(L.min))
      : (L.max - preis) / (L.max - L.min);
    return L.oben + t * L.preisH;
  }
  x(index, L) { return L.links + (index + 0.5) * L.slotW; }

  // Neu zeichnen. Ändert sich der Preisbereich, gleitet er weich zum neuen Bereich (beim Ziehen nicht).
  zeichnen() {
    const ziel = this.zielBereich();
    const ruhig = this.zieht || matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!this.bereich || ruhig) { this.bereich = ziel; this.zeichneJetzt(); return; }
    if (Math.abs(ziel.min - this.bereich.min) < 1e-6 && Math.abs(ziel.max - this.bereich.max) < 1e-6) { this.zeichneJetzt(); return; }
    const von = { ...this.bereich }, t0 = performance.now();
    cancelAnimationFrame(this.anim);
    const schritt = t => {
      const k = Math.min(1, (t - t0) / ANIM), e = 1 - Math.pow(1 - k, 3);
      this.bereich = { min: von.min + (ziel.min - von.min) * e, max: von.max + (ziel.max - von.max) * e };
      this.zeichneJetzt();
      if (k < 1) this.anim = requestAnimationFrame(schritt);
    };
    this.anim = requestAnimationFrame(schritt);
  }

  zeichneJetzt() {
    const c = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const L = this.layout();
    if (!L.w) return;
    if (c.width !== Math.round(L.w * dpr) || c.height !== Math.round(L.h * dpr)) {
      c.width = Math.round(L.w * dpr);
      c.height = Math.round(L.h * dpr);
    }
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, L.w, L.h);

    // Farben aus theme.css. Die Kurznamen (gruen, rot …) werden in den Übungen benutzt.
    const farbe = {
      gruen: cssVar('--positiv'), rot: cssVar('--negativ'), text2: cssVar('--text-gedaempft'),
      gitter: cssVar('--flaeche-erhoeht'), rand: cssVar('--linie'), akzent: cssVar('--akzent'),
      gelb: cssVar('--warnung'), text: cssVar('--text'), aufFarbe: cssVar('--auf-farbe'), flaeche: cssVar('--flaeche')
    };
    const f = n => farbe[n] ?? n;
    const schild = (text, yy, hintergrund, schrift) => {
      g.fillStyle = hintergrund;
      g.beginPath(); g.roundRect(L.w - L.rechts + 1, yy - 10, L.rechts - 2, 20, 4); g.fill();
      g.fillStyle = schrift; g.textBaseline = 'middle';
      g.fillText(text, L.w - L.rechts + 6, yy);
    };

    // Gitter + Preisachse
    g.font = '500 13px Inter, system-ui, sans-serif';
    g.textBaseline = 'middle';
    const schritt = schoenerSchritt((L.max - L.min) / 5);
    g.strokeStyle = farbe.gitter; g.fillStyle = farbe.text2; g.lineWidth = 1;
    for (let p = Math.ceil(L.min / schritt) * schritt; p <= L.max; p += schritt) {
      const yy = Math.round(this.y(p, L)) + 0.5;
      g.beginPath(); g.moveTo(L.links, yy); g.lineTo(L.w - L.rechts, yy); g.stroke();
      g.fillText(zahl(p, schritt < 1 ? 2 : 0), L.w - L.rechts + 6, yy);
    }
    // Tage-Achse
    g.textBaseline = 'alphabetic';
    // Beschriftung alle 10 Tage, bei schmalen Charts entsprechend seltener (mindestens 30 px Abstand)
    const tagSchritt = 10 * Math.max(1, Math.ceil(30 / (L.slotW * 10)));
    for (let i = tagSchritt - 1; i < this.slots; i += tagSchritt) {
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
      g.fillStyle = farbe.gitter; g.globalAlpha = 0.6;
      const xx = L.links + o.index * L.slotW;
      g.fillRect(xx, L.oben, L.w - L.rechts - xx, L.volOben + L.volH - L.oben);
      g.globalAlpha = 1;
    }
    // Chance/Risiko-Flächen zwischen Einstieg, Stop und Ziel
    for (const o of this.overlays.filter(o => o.typ === 'flaeche')) {
      g.fillStyle = f(o.farbe); g.globalAlpha = 0.10;
      const y1 = this.y(Math.max(o.von, o.bis), L), y2 = this.y(Math.min(o.von, o.bis), L);
      const xx = L.links + (o.ab ?? 0) * L.slotW;
      g.fillRect(xx, y1, L.w - L.rechts - xx, y2 - y1);
      g.globalAlpha = 1;
    }

    // Kerzen (oder Linienchart)
    const kw = Math.max(1, Math.min(14, L.slotW * 0.7));
    if (this.art === 'linie') {
      g.strokeStyle = farbe.akzent; g.lineWidth = 2; g.lineJoin = 'round';
      g.beginPath();
      for (let i = 0; i < this.sichtbar; i++) {
        const yy = this.y(this.kerzen[i].c, L);
        i ? g.lineTo(this.x(i, L), yy) : g.moveTo(this.x(i, L), yy);
      }
      g.stroke();
    } else {
      for (let i = 0; i < this.sichtbar; i++) {
        const k = this.kerzen[i];
        g.fillStyle = g.strokeStyle = k.c >= k.o ? farbe.gruen : farbe.rot;
        g.lineWidth = 1;
        const xx = this.x(i, L);
        g.beginPath(); g.moveTo(Math.round(xx) + 0.5, this.y(k.h, L)); g.lineTo(Math.round(xx) + 0.5, this.y(k.l, L)); g.stroke();
        const y1 = this.y(Math.max(k.o, k.c), L), y2 = this.y(Math.min(k.o, k.c), L);
        g.fillRect(xx - kw / 2, y1, kw, Math.max(1, y2 - y1));
      }
    }

    // Gleitende Durchschnitte
    for (const ind of this.indikatoren) {
      g.strokeStyle = f(ind.farbe); g.lineWidth = 2; g.lineJoin = 'round';
      g.beginPath();
      let begonnen = false;
      for (let i = 0; i < this.sichtbar; i++) {
        const v = ind.werte[i];
        if (v === null) continue;
        begonnen ? g.lineTo(this.x(i, L), this.y(v, L)) : g.moveTo(this.x(i, L), this.y(v, L));
        begonnen = true;
      }
      g.stroke();
    }

    this.zeichneUnten(g, L, farbe, kw);

    // Letzter Kurs als Schild an der Preisachse (wie in echten Trading-Apps)
    const letzte = this.kerzen[this.sichtbar - 1];
    const hatLinieDort = this.overlays.some(o => o.typ === 'linie' && Math.abs(o.preis - letzte.c) < 1e-6);
    if (letzte && !hatLinieDort) {
      const yy = this.y(letzte.c, L), fb = letzte.c >= letzte.o ? farbe.gruen : farbe.rot;
      g.strokeStyle = fb; g.globalAlpha = 0.5; g.setLineDash([2, 3]);
      g.beginPath(); g.moveTo(this.x(this.sichtbar - 1, L), yy); g.lineTo(L.w - L.rechts, yy); g.stroke();
      g.setLineDash([]); g.globalAlpha = 1;
      schild(zahl(letzte.c), yy, fb, farbe.aufFarbe);
    }

    // Linien, Strecken, Markierungen
    const etiketten = [];   // belegte Etikett-Positionen, damit sich nahe Linien nicht überdecken
    for (const o of this.overlays) {
      g.strokeStyle = g.fillStyle = f(o.farbe ?? 'akzent');
      g.lineWidth = o.dick ?? 2;
      g.setLineDash(o.gestrichelt ? [6, 4] : []);
      if (o.typ === 'linie') {
        const yy = this.y(o.preis, L);
        const aktiv = this.zieht && this.zieht === o.id;
        g.lineWidth = aktiv ? 3 : (o.dick ?? 2);
        g.beginPath(); g.moveTo(o.ab !== undefined ? this.x(o.ab, L) : L.links, yy); g.lineTo(L.w - L.rechts, yy); g.stroke();
        g.setLineDash([]);
        schild(zahl(o.preis), yy, f(o.farbe ?? 'akzent'), farbe.aufFarbe);
        if (o.text) {
          // Beschriftung als kleines Etikett; ziehbare Linien bekommen einen Griff (⇕)
          const text = o.ziehbar ? `${o.text}  ⇕` : o.text;
          g.font = '600 12px Inter, system-ui, sans-serif';
          const tw = g.measureText(text).width;
          let oben = yy - 20;                                   // normal über der Linie
          if (etiketten.some(e => Math.abs(e - oben) < 19)) oben = yy + 2;   // sonst darunter
          etiketten.push(oben);
          g.fillStyle = f(o.farbe ?? 'akzent');
          g.beginPath(); g.roundRect(L.links + 2, oben, tw + 12, 18, 4); g.fill();
          g.fillStyle = farbe.aufFarbe; g.textBaseline = 'middle';
          g.fillText(text, L.links + 8, oben + 9);
          g.font = '500 13px Inter, system-ui, sans-serif';
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

    this.zeichneKreuz(g, L, farbe, schild);
  }

  // Unteres Fenster: Volumen, RSI (mit 30/70-Linien) oder MACD (Histogramm, MACD- und Signallinie)
  zeichneUnten(g, L, farbe, kw) {
    if (this.unterfenster === 'keins' || L.volH <= 0) return;
    const unten = L.volOben + L.volH;
    if (this.unterfenster === 'volumen') {
      for (let i = 0; i < this.sichtbar; i++) {
        const k = this.kerzen[i];
        g.fillStyle = k.c >= k.o ? farbe.gruen : farbe.rot;
        g.globalAlpha = 0.45;
        const vh = k.v / L.maxVol * L.volH;
        g.fillRect(this.x(i, L) - kw / 2, unten - vh, kw, vh);
      }
      g.globalAlpha = 1;
      return;
    }
    const linie = (werte, yf, fb, dick = 1.5) => {
      g.strokeStyle = fb; g.lineWidth = dick; g.beginPath();
      let begonnen = false;
      for (let i = 0; i < this.sichtbar; i++) {
        if (werte[i] === null) continue;
        begonnen ? g.lineTo(this.x(i, L), yf(werte[i])) : g.moveTo(this.x(i, L), yf(werte[i]));
        begonnen = true;
      }
      g.stroke();
    };
    g.font = '500 12px Inter, system-ui, sans-serif'; g.textBaseline = 'middle';
    if (this.unterfenster === 'rsi') {
      const yr = v => L.volOben + (100 - v) / 100 * L.volH;
      g.fillStyle = farbe.gitter; g.globalAlpha = 0.5;
      g.fillRect(L.links, yr(70), L.w - L.rechts - L.links, yr(30) - yr(70));
      g.globalAlpha = 1;
      g.strokeStyle = farbe.rand; g.setLineDash([4, 4]); g.lineWidth = 1;
      for (const v of [30, 70]) { g.beginPath(); g.moveTo(L.links, yr(v)); g.lineTo(L.w - L.rechts, yr(v)); g.stroke(); }
      g.setLineDash([]);
      g.fillStyle = farbe.text2;
      g.fillText('RSI', L.links + 4, L.volOben + 8);
      g.fillText('70', L.w - L.rechts + 6, yr(70)); g.fillText('30', L.w - L.rechts + 6, yr(30));
      linie(this.rsi, yr, farbe.akzent, 2);
    } else if (this.unterfenster === 'macd') {
      // Linien und Histogramm haben eigene Skalen (gemeinsame Nulllinie), damit das Histogramm gut sichtbar ist
      const m = this.macd, bis = this.sichtbar;
      const groesster = arr => Math.max(...arr.slice(0, bis).filter(v => v !== null).map(Math.abs), 0.01);
      const grLinie = Math.max(groesster(m.linie), groesster(m.signal)), grHisto = groesster(m.histo);
      const halb = L.volH / 2 - 4, mitte = L.volOben + L.volH / 2;
      const ym = v => mitte - v / grLinie * halb;
      const yh = v => mitte - v / grHisto * halb * 0.85;
      g.strokeStyle = farbe.rand; g.lineWidth = 1;
      g.beginPath(); g.moveTo(L.links, mitte); g.lineTo(L.w - L.rechts, mitte); g.stroke();
      for (let i = 0; i < bis; i++) {
        const v = m.histo[i];
        if (v === null) continue;
        g.fillStyle = v >= 0 ? farbe.gruen : farbe.rot; g.globalAlpha = 0.45;
        g.fillRect(this.x(i, L) - kw / 2, Math.min(mitte, yh(v)), kw, Math.abs(yh(v) - mitte));
      }
      g.globalAlpha = 1;
      linie(m.linie, ym, farbe.akzent, 2);
      linie(m.signal, ym, farbe.gelb, 1.5);
      g.fillStyle = farbe.text2;
      g.fillText('MACD', L.links + 4, L.volOben + 8);
    }
  }

  // Fadenkreuz mit Kursdaten der Kerze unter dem Finger
  zeichneKreuz(g, L, farbe, schild) {
    const p = this.kreuz ?? this.mausKreuz;
    if (!p) { this.info.hidden = true; return; }
    const index = Math.max(0, Math.min(this.sichtbar - 1, Math.floor((p.x - L.links) / L.slotW)));
    const k = this.kerzen[index];
    const xx = this.x(index, L);
    const yy = Math.max(L.oben, Math.min(L.oben + L.preisH, p.y));
    g.strokeStyle = farbe.text2; g.lineWidth = 1; g.setLineDash([4, 4]);
    g.beginPath(); g.moveTo(xx, L.oben); g.lineTo(xx, L.volOben + L.volH); g.stroke();
    g.beginPath(); g.moveTo(L.links, yy); g.lineTo(L.w - L.rechts, yy); g.stroke();
    g.setLineDash([]);
    schild(zahl(this.preisBei(p.y)), yy, farbe.text, farbe.flaeche);

    const vol = k.v >= 1e6 ? `${zahl(k.v / 1e6, 1)} Mio.` : `${zahl(k.v / 1e3, 0)} Tsd.`;
    const fb = k.c >= k.o ? 'var(--positiv)' : 'var(--negativ)';
    const veraenderung = index > 0 ? (k.c / this.kerzen[index - 1].c - 1) * 100 : 0;
    this.info.innerHTML = `<b>Tag ${index + 1}</b>
      <span>E ${zahl(k.o)}</span><span>H ${zahl(k.h)}</span><span>T ${zahl(k.l)}</span>
      <span style="color:${fb}">S ${zahl(k.c)} (${veraenderung >= 0 ? '+' : ''}${zahl(veraenderung, 1)} %)</span><span>Vol ${vol}</span>
      ${this.indikatoren.map(d => d.werte[index] === null ? '' : `<span>${d.typ === 'ema' ? 'EMA' : 'SMA'} ${d.laenge}: ${zahl(d.werte[index])}</span>`).join('')}
      ${this.rsi?.[index] != null ? `<span>RSI ${zahl(this.rsi[index], 0)}</span>` : ''}`;
    this.info.hidden = false;
  }

  entfernen() { this.ro.disconnect(); cancelAnimationFrame(this.anim); }
}

function schoenerSchritt(roh) {
  const p = Math.pow(10, Math.floor(Math.log10(roh)));
  const n = roh / p;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p;
}
