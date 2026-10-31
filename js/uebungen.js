// Chart-Übungen: "Erkennen" (Auswahl oder Antippen) und "Entscheiden" (Long/Abwarten mit Stop und Ziel).
import { KerzenChart } from './chart.js';
import { erzeugeKurse } from './kurse.js';
import { icon } from './icons.js';
import { vibriere, zaehleHoch } from './ui.js';
import { esc, markup, zahl, leseZahl } from './util.js';
import { linieFuer, rsi, macd } from './indikatoren.js';

// Gemeinsame Bausteine (auch von app.js genutzt)
export function optionKnopf(text, attr) {
  return `<button class="option" ${attr}><span class="option-text">${text}</span><span class="option-ico"></span></button>`;
}

// Markiert richtige/falsche Option mit Farbe UND Icon (Bedeutung nie nur über Farbe).
export function markiereOptionen(alle, istRichtig, gewaehlt) {
  vibriere(istRichtig(gewaehlt) ? 'richtig' : 'falsch');
  alle.forEach(x => {
    x.disabled = true;
    if (istRichtig(x)) { x.classList.add('richtig'); x.querySelector('.option-ico').innerHTML = icon('circle-check'); }
    else if (x === gewaehlt) { x.classList.add('falsch'); x.querySelector('.option-ico').innerHTML = icon('circle-x'); }
  });
}

export function box(art, titel, inhalt) {
  const ico = { positiv: 'circle-check', negativ: 'circle-x', warnung: 'triangle-alert' }[art] ?? 'info';
  return `<div class="box ${art}"><div class="box-titel">${icon(ico, 20)}<span>${titel}</span></div>${inhalt}</div>`;
}

const rText = r => `${r > 0 ? '+' : ''}${zahl(r, 1)} R`;

// Chart-Optionen aus der Übung (gleitende Durchschnitte, RSI/MACD, Linienchart, log. Skala)
export function chartOptionen(u, extra = {}) {
  const c = u.chart ?? {};
  return { indikatoren: c.indikatoren ?? [], unterfenster: c.unterfenster ?? 'volumen', art: c.art, skala: c.skala, hoehe: c.hoehe ?? extra.hoehe, ...extra };
}

// Vorgegebene Linien, Zonen und Strecken (z. B. eine Order-Linie oder eine Trendlinie), die von Anfang an zu sehen sind
export function vorgaben(u) {
  const v = u.vorgaben ?? {};
  return [
    ...(v.zonen ?? []).map(z => ({ typ: 'zone', farbe: 'gelb', ...z })),
    ...(v.strecken ?? []).map(s => ({ typ: 'strecke', farbe: 'akzent', ...s })),
    ...(v.linien ?? []).map(l => ({ typ: 'linie', farbe: 'akzent', gestrichelt: true, ...l }))
  ];
}

// Werte aus den simulierten Kursen in die Übung einsetzen, damit Text, Linien und Lösung immer zum Chart passen:
//   "=k[30].c * 0.95"        → Zahl (auf 2 Stellen gerundet)
//   "Kurs {{k[0].c}} €"      → Text mit deutscher Zahl (2 Stellen), "{{ausdruck|0}}" für 0 Stellen
// Im Ausdruck verfügbar: k (Kerzen), sma(n), ema(n), rsi() als Arrays, max(...), min(...), hoch(von,bis), tief(von,bis)
export function setzeWerteEin(u, kerzen) {
  if (!kerzen) return u;
  const c = kerzen.map(x => x.c);
  const env = {
    k: kerzen,
    sma: n => linieFuer(kerzen, { typ: 'sma', laenge: n }),
    ema: n => linieFuer(kerzen, { typ: 'ema', laenge: n }),
    rsi: () => rsi(kerzen),
    macd: () => macd(kerzen),
    max: Math.max, min: Math.min, abs: Math.abs, floor: Math.floor, round: Math.round,
    hoch: (von, bis) => Math.max(...kerzen.slice(von, bis + 1).map(x => x.h)),
    tief: (von, bis) => Math.min(...kerzen.slice(von, bis + 1).map(x => x.l)),
    schluss: c,
    // Swing-Tiefs/-Hochs: Tag, dessen Tief (Hoch) das tiefste (höchste) im Fenster ±w ist, bis Tag "bis"
    swingTiefs: (w = 3, bis = kerzen.length - 1) => swings(kerzen, w, bis, 'l'),
    swingHochs: (w = 3, bis = kerzen.length - 1) => swings(kerzen, w, bis, 'h'),
    // Wert der Trendlinie durch die Tiefs der Tage a und b an der Stelle x
    trendlinie: (a, b, x) => kerzen[a].l + (kerzen[b].l - kerzen[a].l) / (b - a) * (x - a),
    // erster Tag ab "ab", an dem der Schlusskurs unter (über) dem Preis liegt
    ersterSchluss: (preis, richtung, ab = 0) => zielIndex({ typ: 'ersterSchluss', preis, richtung, ab }, kerzen),
    // durchschnittliche Tagesschwankung (Hoch − Tief) zwischen zwei Tagen
    spanne: (von, bis) => kerzen.slice(von, bis + 1).reduce((s, x) => s + x.h - x.l, 0) / (bis - von + 1),
    // Ergebnis in R eines Standard-Trades ab Tag "ab": Kauf zum Schluss, Stop knapp unter dem 10-Tage-Tief, Ziel 2 R
    standardR: ab => {
      const e = kerzen[ab - 1].c, schw = kerzen.slice(ab - 14, ab).reduce((s, x) => s + x.h - x.l, 0) / 14;
      const st = Math.min(...kerzen.slice(ab - 10, ab).map(x => x.l)) - schw * 0.2;
      return simuliere(kerzen, ab, e, st, e + 2 * (e - st)).r;
    },
    // erster Tag (Index) ab "ab", an dem der Preis berührt wird; -1 wenn nie
    erster: (preis, richtung, ab = 0) => zielIndex({ typ: 'ersterTag', preis, richtung, ab }, kerzen),
    // Trailing Stop (Prozent vom höchsten Kurs seit "ab"): Index der Auslösung bis "bis", sonst -1
    trailing: (ab, bis, prozent) => {
      let hoechst = kerzen[ab].c;   // gekauft zum Schlusskurs von Tag "ab"
      for (let i = ab + 1; i <= bis; i++) {
        if (kerzen[i].l <= hoechst * (1 - prozent / 100)) return i;
        hoechst = Math.max(hoechst, kerzen[i].h);
      }
      return -1;
    }
  };
  const rechne = ausdruck => new Function(...Object.keys(env), `return (${ausdruck});`)(...Object.values(env));
  const r2 = x => Math.round(x * 100) / 100;
  const ersetze = wert => {
    if (typeof wert === 'string') {
      if (wert.startsWith('=')) return r2(rechne(wert.slice(1)));
      return wert.replace(/\{\{(.+?)(?:\|(\d))?\}\}/g, (_, a, st) => zahl(rechne(a), st === undefined ? 2 : Number(st)));
    }
    if (Array.isArray(wert)) return wert.map(ersetze);
    if (wert && typeof wert === 'object') return Object.fromEntries(Object.entries(wert).map(([k, v]) => [k, k === 'kurse' || k === 'pruefung' ? v : ersetze(v)]));
    return wert;
  };
  return ersetze(u);
}

export function zeigeUebung(el, uRoh, fertig, nochmal) {
  const kerzen = uRoh.kurse ? erzeugeKurse(uRoh.kurse) : null;
  const u = setzeWerteEin(uRoh, kerzen);
  const entscheiden = u.stufe === 'entscheiden';
  el.innerHTML = `
    <ion-card><ion-card-content>
      <ion-chip class="${entscheiden ? 'warnung' : 'akzent'}">${icon(entscheiden ? 'target' : 'scan-search', 16)}${entscheiden ? 'Entscheiden' : 'Erkennen'}</ion-chip>
      ${u.vorschau ? `<ion-chip>${icon('sparkles', 16)}Vorschau · zählt nicht</ion-chip>` : ''}
      <h3 style="margin-top:12px">${esc(u.titel)}</h3>
      <div>${markup(u.frage)}</div>
    </ion-card-content></ion-card>
    <div class="u-chart"></div>
    <div class="u-steuerung"></div>
    <div class="u-ergebnis"></div>`;
  const ctx = {
    el, u, kerzen, fertig, nochmal,
    chartEl: el.querySelector('.u-chart'),
    steuer: el.querySelector('.u-steuerung'),
    ergebnis: el.querySelector('.u-ergebnis')
  };
  if (u.typ === 'auswahl') auswahl(ctx);
  else if (u.typ === 'tippen') tippen(ctx);
  else if (u.typ === 'tippenPreis') tippenPreis(ctx);
  else if (u.typ === 'rechnen') rechnen(ctx);
  else if (u.typ === 'entscheiden') entscheidenUebung(ctx);
}

function nochmalKnopf(ctx) {
  const b = document.createElement('ion-button');
  b.expand = 'block';
  b.fill = 'outline';
  b.innerHTML = `${icon('refresh-cw', 18)}Übung wiederholen`;
  b.style.marginTop = '12px';
  b.onclick = ctx.nochmal;
  ctx.ergebnis.append(b);
}

const kreuzHinweis = '<p class="hinweis chart-tipp">Tipp: Finger auf den Chart halten zeigt die Kurse jedes Tages.</p>';

// ---------- Erkennen: Auswahl ----------
function auswahl(ctx) {
  const { u, kerzen } = ctx;
  // Übungen ohne "kurse" (z. B. Psychologie-Situationen) kommen ohne Chart aus
  const chart = kerzen ? new KerzenChart(ctx.chartEl, kerzen, chartOptionen(u, { hoehe: u.chart?.hoehe ?? 280 })) : null;
  chart?.setzeOverlays(vorgaben(u));
  ctx.steuer.innerHTML = `${chart ? kreuzHinweis : ''}<div class="optionen">${u.optionen.map((o, i) => optionKnopf(esc(o), `data-i="${i}"`)).join('')}</div>`;
  const alle = [...ctx.steuer.querySelectorAll('.option')];
  alle.forEach(b => b.onclick = () => {
    const richtig = Number(b.dataset.i) === u.richtig;
    markiereOptionen(alle, x => Number(x.dataset.i) === u.richtig, b);
    chart?.setzeOverlays([...vorgaben(u), ...loesungsOverlay(u.loesung, kerzen)]);
    ctx.ergebnis.innerHTML = box(richtig ? 'positiv' : 'negativ', richtig ? 'Richtig!' : 'Nicht ganz.', markup(u.erklaerung));
    nochmalKnopf(ctx);
    ctx.fertig({ erledigt: true, richtig });
  });
}

// Rechenaufgabe zum Chart: Zahl eingeben, Toleranz wie im Quiz
function rechnen(ctx) {
  const { u, kerzen } = ctx;
  const chart = kerzen ? new KerzenChart(ctx.chartEl, kerzen, chartOptionen(u, { hoehe: u.chart?.hoehe ?? 280 })) : null;
  chart?.setzeOverlays(vorgaben(u));
  ctx.steuer.innerHTML = `
    <div class="eingabe-reihe"><input class="eingabe" inputmode="decimal" autocomplete="off" placeholder="Deine Antwort" aria-label="Deine Antwort"><span class="einheit">${esc(u.einheit ?? '')}</span></div>
    <div class="abstand"></div><ion-button expand="block">${icon('check', 20)}Prüfen</ion-button>`;
  const inp = ctx.steuer.querySelector('input');
  const pruef = () => {
    const wert = leseZahl(inp.value);
    if (wert === null) { inp.focus(); return; }
    const richtig = Math.abs(wert - u.loesung) <= (u.toleranz ?? 0.01);
    vibriere(richtig ? 'richtig' : 'falsch');
    inp.disabled = true;
    inp.classList.add(richtig ? 'richtig' : 'falsch');
    ctx.steuer.querySelector('ion-button').remove();
    chart?.setzeOverlays([...vorgaben(u), ...loesungsOverlay(u.loesungChart, kerzen)]);
    const loesungText = `${zahl(u.loesung, Number.isInteger(u.loesung) ? 0 : 2)} ${u.einheit ?? ''}`;
    ctx.ergebnis.innerHTML = box(richtig ? 'positiv' : 'negativ', richtig ? 'Richtig!' : `Leider falsch. Richtig ist ${loesungText}.`, markup(u.erklaerung));
    nochmalKnopf(ctx);
    ctx.fertig({ erledigt: true, richtig });
  };
  ctx.steuer.querySelector('ion-button').onclick = pruef;
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') pruef(); });
}

// Preisbereich antippen (z. B. Unterstützung): richtig, wenn der Tipp in der Zone liegt
function tippenPreis(ctx) {
  const { u, kerzen } = ctx;
  const chart = new KerzenChart(ctx.chartEl, kerzen, chartOptionen(u, { hoehe: u.chart?.hoehe ?? 300 }));
  chart.setzeOverlays(vorgaben(u));
  let wahl = null;
  ctx.steuer.innerHTML = `<p class="hinweis">Tippe im Chart auf die Höhe. Du kannst deine Wahl ändern, bis du auf „Prüfen“ tippst.</p>
    <ion-button expand="block" disabled>${icon('check', 20)}Prüfen</ion-button>`;
  const pruefen = ctx.steuer.querySelector('ion-button');
  chart.beiTipp(p => {
    if (!p.imPreisbereich) return;
    wahl = p.preis;
    chart.setzeOverlays([...vorgaben(u), { typ: 'linie', preis: wahl, farbe: 'akzent', text: 'Deine Wahl' }]);
    pruefen.disabled = false;
  });
  pruefen.onclick = () => {
    if (wahl === null) return;
    chart.beiTipp(null);
    const z = u.zone;
    const richtig = wahl >= z.von && wahl <= z.bis;
    vibriere(richtig ? 'richtig' : 'falsch');
    chart.setzeOverlays([...vorgaben(u), { typ: 'zone', von: z.von, bis: z.bis, farbe: 'gruen' },
      { typ: 'linie', preis: wahl, farbe: richtig ? 'gruen' : 'rot', text: 'Deine Wahl' }]);
    ctx.steuer.innerHTML = '';
    ctx.ergebnis.innerHTML = box(richtig ? 'positiv' : 'negativ', richtig ? 'Richtig!' : 'Nicht ganz. Die grüne Fläche zeigt die Zone.', markup(u.erklaerung));
    nochmalKnopf(ctx);
    ctx.fertig({ erledigt: true, richtig });
  };
}

function loesungsOverlay(l, kerzen) {
  if (!l || !kerzen) return [];
  const n = kerzen.length;
  if (l.linien || l.zonen || l.strecken || l.marker) {
    return [
      ...(l.zonen ?? []).map(z => ({ typ: 'zone', farbe: 'gruen', ...z })),
      ...(l.strecken ?? []).map(s => ({ typ: 'strecke', farbe: 'gruen', ...s })),
      ...(l.linien ?? []).map(x => ({ typ: 'linie', farbe: 'gruen', ...x })),
      ...(l.marker ?? []).map(m => ({ typ: 'marker', farbe: 'gruen', ...m }))
    ];
  }
  if (l?.zeige === 'anfangEnde') {
    return [
      { typ: 'strecke', i1: 0, p1: kerzen[0].c, i2: n - 1, p2: kerzen[n - 1].c, farbe: 'akzent', gestrichelt: true },
      { typ: 'marker', index: 0, text: 'Start', farbe: 'akzent' },
      { typ: 'marker', index: n - 1, text: 'Ende', farbe: 'akzent' }
    ];
  }
  if (l?.zeige === 'spanne') {
    const closes = kerzen.map(k => k.c);
    return [{ typ: 'zone', von: Math.min(...closes), bis: Math.max(...closes), farbe: 'gelb' }];
  }
  return [];
}

// ---------- Erkennen: Antippen ----------
function tippen(ctx) {
  const { u, kerzen } = ctx;
  const chart = new KerzenChart(ctx.chartEl, kerzen, chartOptionen(u, { hoehe: u.chart?.hoehe ?? 300 }));
  chart.setzeOverlays(vorgaben(u));
  let wahl = null;
  ctx.steuer.innerHTML = `<p class="hinweis">Tippe in den Chart. Du kannst deine Wahl ändern, bis du auf „Prüfen“ tippst. Finger gedrückt halten zeigt die Kurse jedes Tages.</p>
    <ion-button expand="block" disabled>${icon('check', 20)}Prüfen</ion-button>`;
  const pruefen = ctx.steuer.querySelector('ion-button');
  chart.beiTipp(p => {
    wahl = p.index;
    chart.setzeOverlays([...vorgaben(u), { typ: 'senkrecht', index: wahl, farbe: 'akzent', dick: 1, gestrichelt: true }, { typ: 'marker', index: wahl, text: 'Deine Wahl', farbe: 'akzent' }]);
    pruefen.disabled = false;
  });
  pruefen.onclick = () => {
    if (wahl === null) return;
    chart.beiTipp(null);
    const ziel = zielIndex(u.ziel, kerzen);
    const richtig = Math.abs(wahl - ziel) <= (u.toleranz ?? 0);
    vibriere(richtig ? 'richtig' : 'falsch');
    const ov = [...vorgaben(u), { typ: 'senkrecht', index: ziel, farbe: 'gruen', dick: 1, gestrichelt: true }, { typ: 'marker', index: ziel, text: 'Lösung', farbe: 'gruen' }];
    if (!richtig) ov.push({ typ: 'marker', index: wahl, text: 'Deine Wahl', farbe: 'rot', unten: true });
    chart.setzeOverlays(ov);
    ctx.steuer.innerHTML = '';
    ctx.ergebnis.innerHTML = box(richtig ? 'positiv' : 'negativ', richtig ? 'Richtig!' : 'Nicht ganz. Die grüne Markierung zeigt die Lösung.', markup(u.erklaerung));
    nochmalKnopf(ctx);
    ctx.fertig({ erledigt: true, richtig });
  };
}

function swings(kerzen, w, bis, feld) {
  const aus = [];
  for (let i = w; i <= Math.min(bis, kerzen.length - 1) - w; i++) {
    const fenster = kerzen.slice(i - w, i + w + 1).map(x => x[feld]);
    if (kerzen[i][feld] === (feld === 'l' ? Math.min(...fenster) : Math.max(...fenster))) aus.push(i);
  }
  return aus;
}

// Welche Kerze ist die richtige? Einfache Ziele als Text, berechnete Ziele als Objekt.
export function zielIndex(ziel, kerzen) {
  const groesste = wert => kerzen.reduce((b, k, i) => wert(k, i) > wert(kerzen[b], b) ? i : b, 0);
  if (typeof ziel === 'string') {
    return ({
      hoechstesHoch: () => groesste(k => k.h),
      tiefstesTief: () => groesste(k => -k.l),
      hoechstesVolumen: () => groesste(k => k.v),
      groessterKoerper: () => groesste(k => Math.abs(k.c - k.o)),
      laengsterUntererDocht: () => groesste(k => Math.min(k.o, k.c) - k.l),
      laengsterObererDocht: () => groesste(k => k.h - Math.max(k.o, k.c))
    })[ziel]();
  }
  const ab = ziel.ab ?? 0;
  if (ziel.typ === 'index') return ziel.index;
  if (ziel.typ === 'ersterTag') {
    // erster Tag ab "ab", an dem der Kurs den Preis berührt (Tief darunter bzw. Hoch darüber)
    for (let i = ab; i < kerzen.length; i++) {
      if (ziel.richtung === 'unter' ? kerzen[i].l <= ziel.preis : kerzen[i].h >= ziel.preis) return i;
    }
    return -1;
  }
  if (ziel.typ === 'ersterSchluss') {
    for (let i = ab; i < kerzen.length; i++) {
      if (ziel.richtung === 'unter' ? kerzen[i].c < ziel.preis : kerzen[i].c > ziel.preis) return i;
    }
    return -1;
  }
  if (ziel.typ === 'kreuz') {
    // erster Tag ab "ab", an dem der schnelle Durchschnitt den langsamen von unten (oben) kreuzt
    const s = linieFuer(kerzen, ziel.schnell), l = linieFuer(kerzen, ziel.langsam);
    for (let i = Math.max(ab, 1); i < kerzen.length; i++) {
      if ([s[i], l[i], s[i - 1], l[i - 1]].includes(null)) continue;
      if (ziel.richtung === 'unten' ? s[i - 1] >= l[i - 1] && s[i] < l[i] : s[i - 1] <= l[i - 1] && s[i] > l[i]) return i;
    }
    return -1;
  }
  if (ziel.typ === 'rsi') {
    const r = rsi(kerzen);
    for (let i = Math.max(ab, 1); i < kerzen.length; i++) {
      if (r[i] === null || r[i - 1] === null) continue;
      if (ziel.richtung === 'unter' ? r[i - 1] >= ziel.wert && r[i] < ziel.wert : r[i - 1] <= ziel.wert && r[i] > ziel.wert) return i;
    }
    return -1;
  }
  return -1;
}

// ---------- Entscheiden ----------
// Spielt den Trade ab Kerze "ab" durch. Gap über den Stop/das Ziel wird zum Eröffnungskurs ausgeführt.
export function simuliere(kerzen, ab, einstieg, stop, ziel) {
  for (let i = ab; i < kerzen.length; i++) {
    const k = kerzen[i];
    let ausstieg = null, grund = null;
    if (k.o <= stop) { ausstieg = k.o; grund = 'gapStop'; }
    else if (k.o >= ziel) { ausstieg = k.o; grund = 'gapZiel'; }
    else if (k.l <= stop) { ausstieg = stop; grund = 'stop'; }   // Annahme: Stop vor Ziel, wenn beides am selben Tag
    else if (k.h >= ziel) { ausstieg = ziel; grund = 'ziel'; }
    if (ausstieg !== null) return { index: i, ausstieg, grund, r: (ausstieg - einstieg) / (einstieg - stop) };
  }
  const letzte = kerzen.length - 1;
  return { index: letzte, ausstieg: kerzen[letzte].c, grund: 'ende', r: (kerzen[letzte].c - einstieg) / (einstieg - stop) };
}

function entscheidenUebung(ctx) {
  const { u, kerzen } = ctx;
  const ab = u.stopp;
  const einstieg = kerzen[ab - 1].c;
  const chart = new KerzenChart(ctx.chartEl, kerzen, chartOptionen(u, { sichtbar: ab, slots: kerzen.length, hoehe: u.chart?.hoehe ?? 340, polster: 0.3 }));
  const basis = [{ typ: 'ab', index: ab }, ...vorgaben(u)];
  chart.setzeOverlays(basis);

  // Durchschnittliche Tagesschwankung der letzten 14 Tage (für die Bewertung des Stops)
  const letzte = kerzen.slice(Math.max(0, ab - 14), ab);
  const schwankung = letzte.reduce((s, k) => s + (k.h - k.l), 0) / letzte.length;

  ctx.steuer.innerHTML = `
    <ion-card><ion-card-content class="klein-text">${markup(u.hilfe ?? '')}</ion-card-content></ion-card>
    <div class="knopf-reihe">
      <ion-button color="success" data-a="long">Einsteigen (Long)</ion-button>
      <ion-button color="medium" data-a="warten">Abwarten</ion-button>
    </div>${kreuzHinweis}`;
  ctx.steuer.querySelector('[data-a=long]').onclick = () => setzeStop();
  ctx.steuer.querySelector('[data-a=warten]').onclick = () => abwarten();

  let stop = null, ziel = null, laeuft = false;
  const linien = () => [
    ...basis,
    ...(stop !== null ? [{ typ: 'flaeche', von: einstieg, bis: stop, farbe: 'rot', ab: ab - 1 }] : []),
    ...(ziel !== null ? [{ typ: 'flaeche', von: einstieg, bis: ziel, farbe: 'gruen', ab: ab - 1 }] : []),
    { typ: 'linie', preis: einstieg, farbe: 'akzent', text: 'Einstieg' },
    ...(stop !== null ? [{ typ: 'linie', id: 'stop', preis: stop, farbe: 'rot', text: 'Stop-Loss', ziehbar: !laeuft }] : []),
    ...(ziel !== null ? [{ typ: 'linie', id: 'ziel', preis: ziel, farbe: 'gruen', text: 'Kursziel', ziehbar: !laeuft }] : [])
  ];
  const schritt = (titel, text) => `<ion-card><ion-card-content><h3>${titel}</h3><p class="hinweis" style="margin:0">${text}</p><p class="u-meldung" style="margin:8px 0 0;color:var(--warnung)"></p></ion-card-content></ion-card>`;

  // Linien mit dem Finger verschieben; Stop bleibt unter, Ziel über dem Einstieg
  chart.beiZiehen((id, preis) => {
    if (id === 'stop') stop = Math.min(preis, Math.round((einstieg - 0.01) * 100) / 100);
    if (id === 'ziel') ziel = Math.max(preis, Math.round((einstieg + 0.01) * 100) / 100);
    chart.setzeOverlays(linien());
    if (stop !== null && ziel !== null) aktualisiereWerte();
  });

  function setzeStop() {
    stop = ziel = null;
    chart.setzeOverlays(linien());
    ctx.steuer.innerHTML = schritt('1. Stop-Loss setzen', `Tippe im Chart auf die Höhe, bei der du aussteigen willst, falls der Kurs fällt. Er muss <b>unter</b> dem Einstieg (${zahl(einstieg)} €) liegen.`);
    chart.beiTipp(p => {
      if (!p.imPreisbereich) return;
      if (p.preis >= einstieg) {
        ctx.steuer.querySelector('.u-meldung').textContent = 'Der Stop muss unter dem Einstieg liegen. Tippe weiter unten.';
        vibriere('falsch');
        return;
      }
      stop = p.preis;
      chart.setzeOverlays(linien());
      setzeZiel();
    });
  }

  function setzeZiel() {
    ctx.steuer.innerHTML = schritt('2. Kursziel setzen', 'Tippe auf die Höhe, bei der du Gewinne mitnehmen willst. Es muss <b>über</b> dem Einstieg liegen.');
    chart.beiTipp(p => {
      if (!p.imPreisbereich) return;
      if (p.preis <= einstieg) {
        ctx.steuer.querySelector('.u-meldung').textContent = 'Das Ziel muss über dem Einstieg liegen. Tippe weiter oben.';
        vibriere('falsch');
        return;
      }
      ziel = p.preis;
      chart.setzeOverlays(linien());
      zusammenfassung();
    });
  }

  function werteHtml() {
    const risiko = einstieg - stop, crv = (ziel - einstieg) / risiko;
    const crvKlasse = crv >= 2 ? 'positiv' : crv >= 1.5 ? 'warnung' : 'negativ';
    return `
      <div class="zeile"><span class="wachsen">Einstieg</span><b>${zahl(einstieg)} €</b></div>
      <div class="zeile"><span class="wachsen">Stop-Loss</span><b class="stop">${zahl(stop)} €</b></div>
      <div class="zeile"><span class="wachsen">Kursziel</span><b class="ziel">${zahl(ziel)} €</b></div>
      <div class="abstand"></div>
      <div class="zeile"><span class="wachsen">Risiko pro Aktie (= 1 R)</span><b>${zahl(risiko)} €</b></div>
      <div class="zeile"><span class="wachsen">Chance-Risiko-Verhältnis</span><ion-chip class="${crvKlasse}">${zahl(crv, 1)} : 1</ion-chip></div>`;
  }
  function aktualisiereWerte() {
    const w = ctx.steuer.querySelector('.werte');
    if (w) w.innerHTML = werteHtml();
  }

  function zusammenfassung() {
    chart.beiTipp(null);
    ctx.steuer.innerHTML = `
      <ion-card><ion-card-content class="werte">${werteHtml()}</ion-card-content></ion-card>
      <p class="hinweis chart-tipp">${icon('target', 16)} Ziehe die Linien mit dem Finger, um Stop und Ziel zu verschieben.</p>
      <div class="knopf-reihe">
        <ion-button color="medium" data-a="neu">Neu setzen</ion-button>
        <ion-button data-a="los">Weiterlaufen lassen</ion-button>
      </div>`;
    ctx.steuer.querySelector('[data-a=neu]').onclick = setzeStop;
    ctx.steuer.querySelector('[data-a=los]').onclick = () => {
      laeuft = true;
      chart.beiZiehen(null);
      const erg = simuliere(kerzen, ab, einstieg, stop, ziel);
      liveAnzeige();
      abspielen(erg.index + 1, n => aktualisiereLive(n), () => {
        vibriere(erg.r > 0 ? 'ziel' : 'stop');
        // Nach dem Ausstieg den Rest zeigen: Was wäre danach passiert?
        chart.setzeSichtbar(kerzen.length);
        chart.setzeOverlays([...linien(), { typ: 'senkrecht', index: erg.index, farbe: 'text2', dick: 1, gestrichelt: true }, { typ: 'marker', index: erg.index, preis: erg.ausstieg, text: 'Ausstieg', farbe: erg.r > 0 ? 'gruen' : 'rot' }]);
        ctx.steuer.innerHTML = '';
        zeigeErgebnisLong(erg);
      });
    };
  }

  // Live-Anzeige während der Chart weiterläuft: Tag, offenes Ergebnis in R, Tempo
  let tempo = 130;
  function liveAnzeige(ohneR = false) {
    ctx.steuer.innerHTML = `
      <ion-card class="live"><ion-card-content>
        <div class="zeile"><span class="wachsen hinweis live-tag">Tag ${ab} von ${kerzen.length}</span>
          <ion-button size="small" color="medium" class="tempo">2× schneller</ion-button></div>
        ${ohneR ? '<div class="live-text">Du wartest ab und schaust zu …</div>' : `<div class="live-r">${rText(0)}</div><div class="hinweis mittig">offenes Ergebnis</div>`}
        <ion-progress-bar value="0"></ion-progress-bar>
      </ion-card-content></ion-card>`;
    const t = ctx.steuer.querySelector('.tempo');
    t.onclick = () => { tempo = 55; t.disabled = true; };
  }
  function aktualisiereLive(n, ohneR = false) {
    const tag = ctx.steuer.querySelector('.live-tag');
    if (!tag) return;
    tag.textContent = `Tag ${n} von ${kerzen.length}`;
    ctx.steuer.querySelector('ion-progress-bar').value = (n - ab) / (kerzen.length - ab);
    if (ohneR) return;
    const r = (kerzen[n - 1].c - einstieg) / (einstieg - stop);
    const el = ctx.steuer.querySelector('.live-r');
    el.textContent = rText(r);
    el.className = `live-r ${r > 0 ? 'plus' : r < 0 ? 'minus' : ''}`;
  }

  function abspielen(bis, jeKerze, danach) {
    let n = ab;
    const weiter = () => {
      if (!ctx.el.isConnected) return;
      n++;
      chart.setzeSichtbar(n);
      jeKerze(n);
      if (n >= bis) danach(); else setTimeout(weiter, tempo);
    };
    setTimeout(weiter, tempo);
  }

  function zeigeErgebnisLong(erg) {
    const risiko = einstieg - stop, crv = (ziel - einstieg) / risiko;
    const maengel = [];
    if (u.ideal === 'warten') maengel.push(u.wartenGrund ?? 'Die Ausgangslage sprach gegen einen Long-Einstieg: Der Kurs war im Abwärtstrend.');
    if (risiko < schwankung) maengel.push(`Dein Stop war sehr eng: ${zahl(risiko)} € Abstand, die normale Tagesschwankung lag bei etwa ${zahl(schwankung)} €. Schon normales Hin und Her kann dich dann ausstoppen.`);
    if (risiko > schwankung * 5) maengel.push(`Dein Stop war sehr weit weg (${zahl(risiko)} €). Das geht, dann musst du aber weniger Aktien kaufen (Positionsgröße, Tag 3).`);
    if (crv < 1.5) maengel.push(`Dein Chance-Risiko-Verhältnis war nur ${zahl(crv, 1)} : 1. Mit weniger als etwa 1,5 : 1 musst du sehr oft richtigliegen, um auf Dauer Gewinn zu machen.`);
    if (crv > 6) maengel.push(`Dein Ziel war sehr ehrgeizig (${zahl(crv, 1)} : 1). Solche Ziele werden in 1 bis 2 Wochen selten erreicht.`);
    const gut = maengel.length === 0;
    const plus = erg.r > 0;

    const grundText = {
      ziel: 'Das Kursziel wurde erreicht.',
      gapZiel: 'Der Kurs ist über Nacht über dein Ziel gesprungen. Ausgeführt wurde zum Eröffnungskurs, also sogar etwas besser.',
      stop: 'Der Stop-Loss wurde ausgelöst.',
      gapStop: `Der Kurs hat mit einer Kurslücke unter deinem Stop eröffnet. Ausgeführt wurde erst zum Eröffnungskurs von ${zahl(erg.ausstieg)} €, der Verlust ist deshalb größer als 1 R.`,
      ende: 'Weder Stop noch Ziel wurden erreicht. Am Ende des Übungszeitraums wurde zum Schlusskurs verkauft.'
    }[erg.grund];

    const urteil = gut && plus ? ['positiv', 'Gute Entscheidung, gutes Ergebnis.', 'Du hast nach Plan gehandelt, und der Markt hat mitgespielt.']
      : gut ? ['info', 'Gute Entscheidung, trotzdem verloren.', 'Das gehört dazu. Auch ein guter Trade geht oft schief. Wichtig ist, dass der Verlust durch den Stop begrenzt war. Über viele Trades setzt sich ein guter Plan durch.']
      : plus ? ['warnung', 'Gewonnen, aber mit Schwächen.', 'Das Ergebnis war positiv, die Entscheidung hatte aber Schwachstellen. Auf Dauer kostet so etwas Geld, auch wenn es diesmal gut ging.']
      : ['negativ', 'Verlust, und die Entscheidung hatte Schwächen.', 'Schau dir die Punkte unten an. Genau daraus lernst du am meisten.'];

    ctx.ergebnis.innerHTML = `
      <ion-card><ion-card-content>
        <div class="r-ergebnis ${plus ? 'plus' : 'minus'}"><span data-hoch="${erg.r}" data-stellen="1" data-vor="+" data-nach=" R">0 R</span></div>
        <p class="hinweis mittig" style="margin:0">${plus ? 'Gewinn' : 'Verlust'} pro Aktie: ${zahl(erg.ausstieg - einstieg)} € · 1 R = ${zahl(risiko)} €</p>
        <p style="margin:12px 0 0">${grundText}</p>
      </ion-card-content></ion-card>
      ${box(urteil[0], urteil[1], `<p>${urteil[2]}</p>${maengel.length ? `<ul>${maengel.map(m => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}`)}
      ${box('info', 'Auflösung', markup(u.aufloesung))}`;
    zaehleHoch(ctx.ergebnis);
    nochmalKnopf(ctx);
    ctx.fertig({ erledigt: true, entscheidung: 'long', r: Math.round(erg.r * 100) / 100, gut });
  }

  function abwarten() {
    liveAnzeige(true);
    abspielen(kerzen.length, n => aktualisiereLive(n, true), () => {
      // Was wäre mit einem Standard-Trade passiert? Stop unter dem Tief der letzten 10 Tage, Ziel 2 R.
      const tief = Math.min(...kerzen.slice(ab - 10, ab).map(k => k.l));
      const s = Math.round((tief - schwankung * 0.2) * 100) / 100;
      const z = Math.round((einstieg + 2 * (einstieg - s)) * 100) / 100;
      const erg = simuliere(kerzen, ab, einstieg, s, z);
      stop = s; ziel = z; laeuft = true;
      chart.setzeOverlays([...linien(), { typ: 'marker', index: erg.index, preis: erg.ausstieg, text: 'Ausstieg', farbe: erg.r > 0 ? 'gruen' : 'rot' }]);
      ctx.steuer.innerHTML = '';
      const gut = u.ideal === 'warten';
      vibriere(gut ? 'richtig' : 'falsch');
      const hypo = `Zum Vergleich: Ein Kauf mit Stop knapp unter dem Tief der letzten 10 Tage (${zahl(s)} €) und Ziel bei 2 R (${zahl(z)} €) hätte <b>${rText(erg.r)}</b> ergeben (im Chart eingezeichnet).`;
      const text = gut
        ? (erg.r > 0
          ? 'Abwarten war hier vernünftig, auch wenn ein Kauf diesmal Gewinn gebracht hätte. Ohne Rückenwind durch den Trend ist das eher Glück.'
          : 'Gute Entscheidung. Abwarten ist auch eine Entscheidung, und hier hat es dir einen Verlust erspart.')
        : (erg.r > 0
          ? 'Hier wäre ein Einstieg vernünftig gewesen. Abwarten kostet zwar kein Geld, aber wer gute Gelegenheiten auslässt, verschenkt auf Dauer Gewinne.'
          : 'Die Ausgangslage sprach eigentlich für einen Einstieg. Dass du dir hier einen Verlust erspart hast, war Glück und kein Zeichen, dass Abwarten besser war.');
      ctx.ergebnis.innerHTML = `
        ${box(gut ? 'positiv' : 'warnung', gut ? 'Abwarten passt hier.' : 'Hier hätte sich ein Einstieg angeboten.', `<p>${text}</p><p>${hypo}</p>`)}
        ${box('info', 'Auflösung', markup(u.aufloesung))}`;
      nochmalKnopf(ctx);
      ctx.fertig({ erledigt: true, entscheidung: 'warten', r: 0, gut });
    });
  }
}
