// Chart-Übungen: "Erkennen" (Auswahl oder Antippen) und "Entscheiden" (Long/Abwarten mit Stop und Ziel).
import { KerzenChart } from './chart.js';
import { erzeugeKurse } from './kurse.js';
import { icon } from './icons.js';
import { esc, markup, zahl } from './util.js';

// Gemeinsame Bausteine (auch von app.js genutzt)
export function optionKnopf(text, attr) {
  return `<button class="option" ${attr}><span class="option-text">${text}</span><span class="option-ico"></span></button>`;
}

// Markiert richtige/falsche Option mit Farbe UND Icon (Bedeutung nie nur über Farbe).
export function markiereOptionen(alle, istRichtig, gewaehlt) {
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

export function zeigeUebung(el, u, fertig, nochmal) {
  const kerzen = erzeugeKurse(u.kurse);
  const entscheiden = u.stufe === 'entscheiden';
  el.innerHTML = `
    <ion-card><ion-card-content>
      <ion-chip class="${entscheiden ? 'warnung' : 'akzent'}">${icon(entscheiden ? 'target' : 'scan-search', 16)}${entscheiden ? 'Entscheiden' : 'Erkennen'}</ion-chip>
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

// ---------- Erkennen: Auswahl ----------
function auswahl(ctx) {
  const { u, kerzen } = ctx;
  const chart = new KerzenChart(ctx.chartEl, kerzen, { hoehe: 280 });
  ctx.steuer.innerHTML = `<div class="optionen">${u.optionen.map((o, i) => optionKnopf(esc(o), `data-i="${i}"`)).join('')}</div>`;
  const alle = [...ctx.steuer.querySelectorAll('.option')];
  alle.forEach(b => b.onclick = () => {
    const richtig = Number(b.dataset.i) === u.richtig;
    markiereOptionen(alle, x => Number(x.dataset.i) === u.richtig, b);
    chart.setzeOverlays(loesungsOverlay(u.loesung, kerzen));
    ctx.ergebnis.innerHTML = box(richtig ? 'positiv' : 'negativ', richtig ? 'Richtig!' : 'Nicht ganz.', markup(u.erklaerung));
    nochmalKnopf(ctx);
    ctx.fertig({ erledigt: true, richtig });
  });
}

function loesungsOverlay(l, kerzen) {
  const n = kerzen.length;
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
  const chart = new KerzenChart(ctx.chartEl, kerzen, { hoehe: 300 });
  let wahl = null;
  ctx.steuer.innerHTML = `<p class="hinweis">Tippe in den Chart. Du kannst deine Wahl ändern, bis du auf „Prüfen“ tippst.</p>
    <ion-button expand="block" disabled>${icon('check', 20)}Prüfen</ion-button>`;
  const pruefen = ctx.steuer.querySelector('ion-button');
  chart.beiTipp(p => {
    wahl = p.index;
    chart.setzeOverlays([{ typ: 'senkrecht', index: wahl, farbe: 'akzent', dick: 1, gestrichelt: true }, { typ: 'marker', index: wahl, text: 'Deine Wahl', farbe: 'akzent' }]);
    pruefen.disabled = false;
  });
  pruefen.onclick = () => {
    if (wahl === null) return;
    chart.beiTipp(null);
    const ziel = zielIndex(u.ziel, kerzen);
    const richtig = Math.abs(wahl - ziel) <= (u.toleranz ?? 0);
    const ov = [{ typ: 'senkrecht', index: ziel, farbe: 'gruen', dick: 1, gestrichelt: true }, { typ: 'marker', index: ziel, text: 'Lösung', farbe: 'gruen' }];
    if (!richtig) ov.push({ typ: 'marker', index: wahl, text: 'Deine Wahl', farbe: 'rot', unten: true });
    chart.setzeOverlays(ov);
    ctx.steuer.innerHTML = '';
    ctx.ergebnis.innerHTML = box(richtig ? 'positiv' : 'negativ', richtig ? 'Richtig!' : 'Nicht ganz. Die grüne Markierung zeigt die Lösung.', markup(u.erklaerung));
    nochmalKnopf(ctx);
    ctx.fertig({ erledigt: true, richtig });
  };
}

function zielIndex(ziel, kerzen) {
  const feld = { hoechstesHoch: 'h', hoechstesVolumen: 'v' }[ziel];
  const tiefst = ziel === 'tiefstesTief';
  let best = 0;
  kerzen.forEach((k, i) => {
    if (tiefst ? k.l < kerzen[best].l : k[feld] > kerzen[best][feld]) best = i;
  });
  return best;
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
  const chart = new KerzenChart(ctx.chartEl, kerzen, { sichtbar: ab, slots: kerzen.length, hoehe: 330, polster: 0.3 });
  const basis = [{ typ: 'ab', index: ab }];
  chart.setzeOverlays(basis);

  // Durchschnittliche Tagesschwankung der letzten 14 Tage (für die Bewertung des Stops)
  const letzte = kerzen.slice(Math.max(0, ab - 14), ab);
  const schwankung = letzte.reduce((s, k) => s + (k.h - k.l), 0) / letzte.length;

  ctx.steuer.innerHTML = `
    <ion-card><ion-card-content class="klein-text">${markup(u.hilfe ?? '')}</ion-card-content></ion-card>
    <div class="knopf-reihe">
      <ion-button color="success" data-a="long">Einsteigen (Long)</ion-button>
      <ion-button color="medium" data-a="warten">Abwarten</ion-button>
    </div>`;
  ctx.steuer.querySelector('[data-a=long]').onclick = () => setzeStop();
  ctx.steuer.querySelector('[data-a=warten]').onclick = () => abwarten();

  let stop = null, ziel = null;
  const linien = () => [
    ...basis,
    { typ: 'linie', preis: einstieg, farbe: 'akzent', text: 'Einstieg' },
    ...(stop !== null ? [{ typ: 'linie', preis: stop, farbe: 'rot', text: 'Stop-Loss' }] : []),
    ...(ziel !== null ? [{ typ: 'linie', preis: ziel, farbe: 'gruen', text: 'Kursziel' }] : [])
  ];
  const schritt = (titel, text) => `<ion-card><ion-card-content><h3>${titel}</h3><p class="hinweis" style="margin:0">${text}</p><p class="u-meldung" style="margin:8px 0 0;color:var(--warnung)"></p></ion-card-content></ion-card>`;

  function setzeStop() {
    stop = ziel = null;
    chart.setzeOverlays(linien());
    ctx.steuer.innerHTML = schritt('1. Stop-Loss setzen', `Tippe im Chart auf die Höhe, bei der du aussteigen willst, falls der Kurs fällt. Er muss <b>unter</b> dem Einstieg (${zahl(einstieg)} €) liegen.`);
    chart.beiTipp(p => {
      if (!p.imPreisbereich) return;
      if (p.preis >= einstieg) {
        ctx.steuer.querySelector('.u-meldung').textContent = 'Der Stop muss unter dem Einstieg liegen. Tippe weiter unten.';
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
        return;
      }
      ziel = p.preis;
      chart.setzeOverlays(linien());
      zusammenfassung();
    });
  }

  function zusammenfassung() {
    chart.beiTipp(null);
    const risiko = einstieg - stop, chance = ziel - einstieg;
    ctx.steuer.innerHTML = `
      <ion-card><ion-card-content class="werte">
        <div class="zeile"><span class="wachsen">Einstieg</span><b>${zahl(einstieg)} €</b></div>
        <div class="zeile"><span class="wachsen">Stop-Loss</span><b class="stop">${zahl(stop)} €</b></div>
        <div class="zeile"><span class="wachsen">Kursziel</span><b class="ziel">${zahl(ziel)} €</b></div>
        <div class="abstand"></div>
        <div class="zeile"><span class="wachsen">Risiko pro Aktie (= 1 R)</span><b>${zahl(risiko)} €</b></div>
        <div class="zeile"><span class="wachsen">Chance-Risiko-Verhältnis</span><b>${zahl(chance / risiko, 1)} : 1</b></div>
      </ion-card-content></ion-card>
      <div class="knopf-reihe">
        <ion-button color="medium" data-a="neu">Neu setzen</ion-button>
        <ion-button data-a="los">Weiterlaufen lassen</ion-button>
      </div>`;
    ctx.steuer.querySelector('[data-a=neu]').onclick = setzeStop;
    ctx.steuer.querySelector('[data-a=los]').onclick = () => {
      ctx.steuer.innerHTML = '<p class="hinweis mittig">Der Chart läuft weiter …</p>';
      const erg = simuliere(kerzen, ab, einstieg, stop, ziel);
      abspielen(erg.index + 1, () => {
        // Nach dem Ausstieg den Rest zeigen: Was wäre danach passiert?
        chart.setzeSichtbar(kerzen.length);
        chart.setzeOverlays([...linien(), { typ: 'senkrecht', index: erg.index, farbe: 'text2', dick: 1, gestrichelt: true }, { typ: 'marker', index: erg.index, preis: erg.ausstieg, text: 'Ausstieg', farbe: erg.r > 0 ? 'gruen' : 'rot' }]);
        ctx.steuer.innerHTML = '';
        zeigeErgebnisLong(erg);
      });
    };
  }

  function abspielen(bis, danach) {
    let n = ab;
    const t = setInterval(() => {
      if (!ctx.el.isConnected) { clearInterval(t); return; }
      n++;
      chart.setzeSichtbar(n);
      if (n >= bis) { clearInterval(t); danach(); }
    }, 130);
  }

  function zeigeErgebnisLong(erg) {
    const risiko = einstieg - stop, crv = (ziel - einstieg) / risiko;
    const maengel = [];
    if (u.ideal === 'warten') maengel.push('Die Ausgangslage sprach gegen einen Long-Einstieg: Der Kurs war im Abwärtstrend.');
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
        <div class="r-ergebnis ${plus ? 'plus' : 'minus'}">${erg.r > 0 ? '+' : ''}${zahl(erg.r, 1)} R</div>
        <p class="hinweis mittig" style="margin:0">${plus ? 'Gewinn' : 'Verlust'} pro Aktie: ${zahl(erg.ausstieg - einstieg)} € · 1 R = ${zahl(risiko)} €</p>
        <p style="margin:12px 0 0">${grundText}</p>
      </ion-card-content></ion-card>
      ${box(urteil[0], urteil[1], `<p>${urteil[2]}</p>${maengel.length ? `<ul>${maengel.map(m => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}`)}
      ${box('info', 'Auflösung', markup(u.aufloesung))}`;
    nochmalKnopf(ctx);
    ctx.fertig({ erledigt: true, entscheidung: 'long', r: Math.round(erg.r * 100) / 100, gut });
  }

  function abwarten() {
    ctx.steuer.innerHTML = '<p class="hinweis mittig">Du wartest ab. Der Chart läuft weiter …</p>';
    abspielen(kerzen.length, () => {
      // Was wäre mit einem Standard-Trade passiert? Stop unter dem Tief der letzten 10 Tage, Ziel 2 R.
      const tief = Math.min(...kerzen.slice(ab - 10, ab).map(k => k.l));
      const s = Math.round((tief - schwankung * 0.2) * 100) / 100;
      const z = Math.round((einstieg + 2 * (einstieg - s)) * 100) / 100;
      const erg = simuliere(kerzen, ab, einstieg, s, z);
      stop = s; ziel = z;
      chart.setzeOverlays([...linien(), { typ: 'marker', index: erg.index, preis: erg.ausstieg, text: 'Ausstieg', farbe: erg.r > 0 ? 'gruen' : 'rot' }]);
      ctx.steuer.innerHTML = '';
      const gut = u.ideal === 'warten';
      const hypo = `Zum Vergleich: Ein Kauf mit Stop knapp unter dem Tief der letzten 10 Tage (${zahl(s)} €) und Ziel bei 2 R (${zahl(z)} €) hätte <b>${erg.r > 0 ? '+' : ''}${zahl(erg.r, 1)} R</b> ergeben (im Chart eingezeichnet).`;
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
