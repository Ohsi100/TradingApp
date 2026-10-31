// Hauptprogramm: lädt die Inhalte, verwaltet die Seiten (Routen) und zeichnet sie.
import * as store from './store.js';
import * as leitner from './leitner.js';
import { zeigeUebung, optionKnopf, markiereOptionen, box } from './uebungen.js';
import { grafik } from './grafiken.js';
import { icon } from './icons.js';
import { toast, bestaetigen, vibriere, zaehleHoch, ruhigeBewegung } from './ui.js';
import { esc, markup, mischen, leseZahl, zahl, heute } from './util.js';

const app = document.getElementById('app');
const inhaltEl = document.getElementById('inhalt');
const titelEl = document.getElementById('titel');
const zurueckEl = document.getElementById('zurueck');
const tabbar = document.getElementById('tabbar');

let plan = [];          // Übersicht aller 10 Tage
const inhalte = {};     // Tag-Nr -> Inhalt aus content/tag-XX.json
let letzteTiefe = 0;    // für die Richtung der Seitenübergänge

// ---------- Start ----------
async function start() {
  const startZeit = performance.now();
  store.laden();
  zurueckEl.innerHTML = icon('chevron-left', 24);
  const tabs = [
    ['plan', '#/', 'calendar-days', 'Plan'],
    ['wiederholen', '#/wiederholen', 'repeat', 'Wiederholen'],
    ['glossar', '#/glossar', 'book-open', 'Glossar'],
    ['fortschritt', '#/fortschritt', 'chart-column', 'Fortschritt']
  ];
  tabbar.innerHTML = tabs.map(([tab, , ico, name]) => `<ion-tab-button tab="${tab}">${icon(ico, 22)}<ion-label>${name}</ion-label></ion-tab-button>`).join('');
  // Ohne <ion-tabs> wechselt Ionic die Seite nicht selbst. Wir hören auf das Tipp-Ereignis und wechseln selbst.
  tabbar.addEventListener('ionTabButtonClick', e => {
    const ziel = tabs.find(t => t[0] === e.detail.tab)?.[1];
    if (ziel) location.hash = ziel;
  });
  app.innerHTML = skeleton();
  try {
    plan = (await ladeJson('content/tage.json')).tage;
    await Promise.all(plan.filter(t => t.datei).map(async t => { inhalte[t.nr] = await ladeJson(t.datei); }));
  } catch (e) {
    splashWeg();
    app.innerHTML = leer('triangle-alert', 'Inhalte konnten nicht geladen werden', esc(e.message),
      '<ion-button onclick="location.reload()">Neu laden</ion-button>');
    return;
  }
  window.addEventListener('hashchange', zeichnen);
  zurueckEl.onclick = () => { location.hash = zurueckEl.dataset.ziel || '#/'; };
  zeichnen();
  // Ladebildschirm kurz stehen lassen, damit er nicht nur aufblitzt
  setTimeout(splashWeg, Math.max(0, 450 - (performance.now() - startZeit)));
  serviceWorker();
}

function splashWeg() {
  const s = document.getElementById('splash');
  if (!s) return;
  s.classList.add('weg');
  setTimeout(() => s.remove(), 300);
}

async function ladeJson(pfad) {
  const r = await fetch(pfad);
  if (!r.ok) throw new Error(`${pfad}: ${r.status}`);
  return r.json();
}

// ---------- Bausteine ----------
const skeleton = () => [1, 2, 3].map(() => `<div class="skeleton-karte">
  <ion-skeleton-text animated style="width:55%;height:18px"></ion-skeleton-text>
  <ion-skeleton-text animated style="width:85%"></ion-skeleton-text>
  <ion-skeleton-text animated style="width:40%"></ion-skeleton-text></div>`).join('');

function leer(ico, titel, text, aktion = '') {
  return `<div class="leer">${icon(ico, 40)}<h3>${titel}</h3><p>${text}</p>${aktion}</div>`;
}

const karte = (inhalt, klasse = '') => `<ion-card class="${klasse}"><ion-card-content>${inhalt}</ion-card-content></ion-card>`;
const prozent = x => Math.round(x * 100) + ' %';
const balken = x => `<ion-progress-bar value="${Math.min(1, x).toFixed(3)}"></ion-progress-bar>`;
const hoch = (wert, { stellen = 0, vor = '', nach = '' } = {}) =>
  `<span data-hoch="${wert}" data-stellen="${stellen}" data-vor="${vor}" data-nach="${nach}">${zahl(wert, stellen)}${nach}</span>`;

// Listeneintrag: Icon links, Titel + Untertitel, rechts Status
function eintrag({ href, ico, icoKlasse = '', start, titel, info, ende = '', klasse = '', detail = true }) {
  const links = start ?? `<span class="ico ${icoKlasse}" slot="start">${icon(ico, 24)}</span>`;
  return `<ion-item ${href ? `href="${href}" button detail="${detail}"` : 'detail="false"'} class="${klasse}">
    ${links}<ion-label><h3>${titel}</h3>${info ? `<p>${info}</p>` : ''}</ion-label>${ende}</ion-item>`;
}
const liste = items => `<ion-list class="gruppe" lines="full">${items.join('')}</ion-list>`;
const fertigChip = `<ion-chip class="positiv" slot="end">${icon('check', 16)}Fertig</ion-chip>`;

// ---------- Hilfen für Fortschritt ----------
const alleKarten = () => Object.values(inhalte).flatMap(t => t.vokabeln.map(k => ({ ...k, tag: t.nr })));
const faelligeKarten = () => alleKarten().filter(k => leitner.istFaellig(k.id));
const wackelKarten = () => alleKarten().filter(k => leitner.istWackel(k.id));

function tagFortschritt(nr) {
  const inhalt = inhalte[nr];
  if (!inhalt) return null;
  const t = store.tag(nr);
  const vok = inhalt.vokabeln.filter(k => (leitner.status(k.id)?.box ?? 0) >= 2).length / inhalt.vokabeln.length;
  const ueb = inhalt.uebungen.filter(u => t.uebungen[u.id]?.erledigt).length;
  const teile = {
    lektion: t.lektion ? 1 : 0,
    vokabeln: vok,
    quiz: t.quiz.beste !== null ? 1 : 0,
    uebungen: ueb / inhalt.uebungen.length
  };
  const gesamt = (teile.lektion + teile.vokabeln + teile.quiz + teile.uebungen) / 4;
  return { teile, gesamt, uebErledigt: ueb };
}

function gesamtFortschritt() {
  return plan.reduce((s, t) => s + (tagFortschritt(t.nr)?.gesamt ?? 0), 0) / plan.length;
}

// Alle Entscheidungen aus den Chart-Übungen, in der Reihenfolge, in der sie gemacht wurden
function entscheidungen() {
  const liste = [];
  for (const t of plan) {
    const inhalt = inhalte[t.nr];
    if (!inhalt) continue;
    const s = store.tag(t.nr);
    for (const u of inhalt.uebungen) {
      const e = s.uebungen[u.id];
      if (u.typ === 'entscheiden' && e?.erledigt) liste.push({ r: e.r ?? 0, zeit: e.zeit ?? 0, gut: e.gut, entscheidung: e.entscheidung });
    }
  }
  return liste.sort((a, b) => a.zeit - b.zeit);
}

function quizQuote() {
  let fragen = 0, richtig = 0;
  for (const t of plan) {
    const inhalt = inhalte[t.nr];
    const s = inhalt && store.tag(t.nr);
    if (s && s.quiz.letzte !== null) { fragen += inhalt.quiz.length; richtig += s.quiz.letzte; }
  }
  return fragen ? richtig / fragen : null;
}

// Wo geht es weiter? Fällige Wiederholung zuerst, dann der erste unfertige Teil des ersten unfertigen Tages.
function naechsterSchritt() {
  const faellig = faelligeKarten().length;
  if (faellig) return { titel: 'Wiederholen', info: `${faellig} fällige Begriffe zuerst`, href: '#/wiederholen/faellig' };
  for (const t of plan) {
    const inhalt = inhalte[t.nr];
    if (!inhalt) continue;
    const f = tagFortschritt(t.nr), s = store.tag(t.nr);
    if (f.gesamt >= 1) {
      if (!s.abgeschlossen) return { titel: `Tag ${t.nr} abschließen`, info: 'Deine Zusammenfassung', href: `#/tag/${t.nr}/abschluss` };
      continue;
    }
    if (!f.teile.lektion) {
      const pos = s.lektionPos ?? 0;
      return { titel: `Tag ${t.nr} · Lektion`, info: pos ? `Häppchen ${pos + 1} von ${inhalt.lektion.length}` : inhalt.titel, href: `#/tag/${t.nr}/lektion/${pos}` };
    }
    if (f.teile.vokabeln < 1) {
      const neu = inhalt.vokabeln.filter(k => !leitner.istGesehen(k.id)).length;
      return { titel: `Tag ${t.nr} · Vokabeln`, info: neu ? `${neu} neue Begriffe` : 'Begriffe festigen', href: `#/tag/${t.nr}/vokabeln/gemischt` };
    }
    if (!f.teile.quiz) return { titel: `Tag ${t.nr} · Quiz`, info: `${inhalt.quiz.length} Fragen`, href: `#/tag/${t.nr}/quiz` };
    const i = inhalt.uebungen.findIndex(u => !s.uebungen[u.id]?.erledigt);
    return { titel: `Tag ${t.nr} · Chart-Übung ${i + 1}`, info: inhalt.uebungen[i].titel, href: `#/tag/${t.nr}/uebung/${i}` };
  }
  return { titel: 'Alles erledigt', info: 'Neue Lerntage folgen bald', href: '#/fortschritt' };
}

// ---------- Kleine Grafiken (SVG) ----------
function ring(anteil) {
  const wert = Math.round(anteil * 100);
  return `<div class="ring-box">
    <svg viewBox="0 0 120 120" class="ring" aria-hidden="true">
      <circle cx="60" cy="60" r="52" class="ring-bahn"/>
      <circle cx="60" cy="60" r="52" class="ring-wert" pathLength="100" style="--wert:${wert}"/>
    </svg>
    <div class="ring-text"><b>${hoch(wert, { nach: ' %' })}</b><span>gesamt</span></div></div>`;
}

// Kurve der Entscheidungen: Summe der R-Ergebnisse nach jeder Entscheidung
function rKurve(liste) {
  const punkte = [0];
  liste.forEach(e => punkte.push(punkte[punkte.length - 1] + e.r));
  const w = 300, h = 90, rand = 8;
  const min = Math.min(0, ...punkte), max = Math.max(0, ...punkte);
  const sp = max - min || 1;
  const x = i => rand + i * (w - 2 * rand) / Math.max(1, punkte.length - 1);
  const y = v => rand + (max - v) / sp * (h - 2 * rand);
  const pfad = punkte.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const flaeche = `${pfad} L${x(punkte.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
  const summe = punkte[punkte.length - 1];
  const farbe = summe >= 0 ? 'var(--positiv)' : 'var(--negativ)';
  return `<svg viewBox="0 0 ${w} ${h}" class="r-kurve" role="img" aria-label="Verlauf deiner Entscheidungen in R">
    <line x1="${rand}" x2="${w - rand}" y1="${y(0)}" y2="${y(0)}" class="null-linie"/>
    <path d="${flaeche}" style="fill:${farbe};opacity:.12"/>
    <path d="${pfad}" pathLength="1" class="kurve" style="stroke:${farbe}"/>
    ${punkte.slice(1).map((v, i) => `<circle cx="${x(i + 1)}" cy="${y(v)}" r="3.5" style="fill:${liste[i].r > 0 ? 'var(--positiv)' : liste[i].r < 0 ? 'var(--negativ)' : 'var(--text-gedaempft)'}"/>`).join('')}
  </svg>`;
}

// ---------- Router ----------
function zeichnen() {
  const teile = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [a, b, c, d] = teile;
  let seite;
  if (!a) seite = seitePlan();
  else if (a === 'tag' && inhalte[b]) {
    const nr = Number(b);
    if (!c) seite = seiteTag(nr);
    else if (c === 'lektion') seite = seiteLektion(nr, Number(d) || 0);
    else if (c === 'vokabeln' && !d) seite = seiteVokabelMenue(nr);
    else if (c === 'vokabeln') seite = seiteVokabelSitzung(inhalte[nr].vokabeln, d, `#/tag/${nr}/vokabeln`, `Tag ${nr}: Vokabeln`);
    else if (c === 'quiz') seite = seiteQuiz(nr);
    else if (c === 'uebungen') seite = seiteUebungen(nr);
    else if (c === 'uebung') seite = seiteUebung(nr, Number(d));
    else if (c === 'abschluss') seite = seiteAbschluss(nr);
  }
  else if (a === 'wiederholen' && !b) seite = seiteWiederholen();
  else if (a === 'wiederholen' && b === 'faellig') seite = seiteVokabelSitzung(faelligeKarten(), 'gemischt', '#/wiederholen', 'Wiederholung');
  else if (a === 'wiederholen' && b === 'wackel') seite = seiteVokabelSitzung(wackelKarten(), 'gemischt', '#/wiederholen', 'Wackelkandidaten');
  else if (a === 'glossar') seite = seiteGlossar();
  else if (a === 'fortschritt') seite = seiteFortschritt();
  seite ??= { titel: 'Nicht gefunden', zurueck: '#/', html: leer('inbox', 'Diese Seite gibt es nicht', 'Vielleicht ein alter Link.', '<ion-button href="#/">Zum Tagesplan</ion-button>') };

  titelEl.textContent = seite.titel;
  zurueckEl.hidden = !seite.zurueck;
  zurueckEl.dataset.ziel = seite.zurueck || '';
  tabbar.selectedTab = seite.nav ?? (a || 'plan');
  app.innerHTML = seite.html ?? '';
  seite.danach?.(app);
  zaehleHoch(app);
  uebergang(teile.length);
  inhaltEl.scrollToTop?.(0);
}

// Seitenübergang: tiefer = von rechts, zurück = von links, Tabwechsel = einblenden
function uebergang(tiefe) {
  if (ruhigeBewegung()) return;
  const klasse = tiefe > letzteTiefe ? 'rein-vor' : tiefe < letzteTiefe ? 'rein-zurueck' : 'rein';
  letzteTiefe = tiefe;
  app.classList.remove('rein-vor', 'rein-zurueck', 'rein');
  void app.offsetWidth;
  app.classList.add(klasse);
}

// ---------- Startseite (Cockpit) ----------
function seitePlan() {
  const fortschritte = plan.map(t => tagFortschritt(t.nr));
  const vorhanden = fortschritte.filter(Boolean);
  const gesamt = gesamtFortschritt();
  const serie = store.lernserie();
  const schritt = naechsterSchritt();
  const ents = entscheidungen();
  const summeR = ents.reduce((s, e) => s + e.r, 0);
  const karten = alleKarten();
  const sicher = karten.filter(k => leitner.istSicher(k.id)).length;
  const gelernt = karten.filter(k => (leitner.status(k.id)?.box ?? 0) >= 2).length;
  const quote = quizQuote();
  const uebErledigt = vorhanden.reduce((s, f) => s + f.uebErledigt, 0);
  const uebGesamt = plan.reduce((s, t) => s + (inhalte[t.nr]?.uebungen.length ?? 0), 0);
  const empfohlen = plan.find((t, i) => fortschritte[i] && fortschritte[i].gesamt < 1);

  const tage = plan.map((t, i) => {
    const f = fortschritte[i];
    if (!f) {
      return eintrag({ start: `<div class="tag-nr" slot="start">${t.nr}</div>`, titel: esc(t.titel), info: 'Inhalte folgen',
        ende: `<span slot="end" class="hinweis">${icon('lock', 18)}</span>`, klasse: 'item-gesperrt' });
    }
    const fertig = f.gesamt >= 1;
    return eintrag({
      href: `#/tag/${t.nr}`,
      start: `<div class="tag-nr ${fertig ? 'fertig' : ''}" slot="start">${fertig ? icon('check', 20) : t.nr}</div>`,
      titel: esc(t.titel),
      info: `${prozent(f.gesamt)} erledigt`,
      ende: empfohlen?.nr === t.nr ? '<ion-chip class="akzent" slot="end">Heute</ion-chip>' : '',
      klasse: empfohlen?.nr === t.nr ? 'hervor' : ''
    });
  });

  const kachel = (wert, text) => `<div class="kachel"><div class="zahl">${wert}</div><div class="hinweis">${text}</div></div>`;
  const serieText = serie.tage === 0 ? 'Starte heute deine Lernserie'
    : `<b>${serie.tage}</b> ${serie.tage === 1 ? 'Tag' : 'Tage'} in Folge gelernt`;

  return {
    titel: 'Trading-Lernapp',
    html: `
      ${karte(`
        <div class="cockpit-kopf">
          ${ring(gesamt)}
          <div class="cockpit-info">
            <div class="karte-titel">Swing-Trading in 10 Tagen</div>
            <div class="serie">${icon('calendar-days', 18)}<span>${serieText}</span></div>
            <div class="serie ${serie.heuteGelernt ? 'positiv' : ''}">${icon(serie.heuteGelernt ? 'circle-check' : 'target', 18)}<span>${serie.heuteGelernt ? 'Heute schon gelernt' : 'Heute noch offen'}</span></div>
          </div>
        </div>
        <ion-button expand="block" class="weiter-knopf" href="${schritt.href}">
          <div class="weiter-inhalt"><span>Weiter lernen</span><small>${esc(schritt.titel)} · ${esc(schritt.info)}</small></div>${icon('chevron-right', 22)}
        </ion-button>`, 'cockpit')}
      <div class="statistik drei">
        ${kachel(hoch(gelernt), 'Begriffe gelernt')}
        ${kachel(quote === null ? '–' : hoch(Math.round(quote * 100), { nach: ' %' }), 'Quiz-Quote')}
        ${kachel(`${hoch(uebErledigt)}/${uebGesamt}`, 'Chart-Übungen')}
      </div>
      ${karte(`
        <div class="zeile"><div class="wachsen"><h3 style="margin:0">Deine Entscheidungen</h3>
          <div class="hinweis">${ents.length ? `${ents.length} Entscheidung${ents.length === 1 ? '' : 'en'} in den Chart-Übungen` : 'Summe aller Ergebnisse in R'}</div></div>
          ${ents.length ? `<div class="r-summe ${summeR > 0 ? 'plus' : summeR < 0 ? 'minus' : ''}">${hoch(summeR, { stellen: 1, vor: '+', nach: ' R' })}</div>` : ''}</div>
        ${ents.length ? rKurve(ents) : `<p class="hinweis" style="margin:12px 0 0">Noch keine Entscheidungen. Die erste wartet in den Chart-Übungen von Tag 1.</p>`}`)}
      <h3 class="abschnitt">Lernplan</h3>
      ${liste(tage)}
      <p class="fusszeile">Lerninhalt, keine Anlageberatung.<br>Version ${esc(self.APP_VERSION)} · ${vorhanden.length} von 10 Tagen verfügbar · ${sicher} Begriffe sicher</p>`
  };
}

// ---------- Tagesansicht ----------
function seiteTag(nr) {
  const inhalt = inhalte[nr];
  const f = tagFortschritt(nr);
  const faellig = faelligeKarten().length;
  const t = store.tag(nr);
  const status = x => x >= 1 ? fertigChip : x > 0 ? `<span slot="end" class="hinweis zahlen">${prozent(x)}</span>` : '';
  const teil = (href, ico, name, info, x) => eintrag({ href, ico, icoKlasse: x >= 1 ? 'positiv' : '', titel: name, info, ende: status(x), detail: x < 1 });

  return {
    titel: `Tag ${nr}: ${inhalt.titel}`,
    zurueck: '#/',
    nav: 'plan',
    html: `
      ${karte(`<div class="hinweis">Ziel für heute</div><div>${esc(inhalt.ziel)}</div>${balken(f.gesamt)}`)}
      ${faellig ? liste([eintrag({ href: '#/wiederholen/faellig', ico: 'repeat', titel: 'Wiederholung zuerst', info: `${faellig} fällige Begriffe`, klasse: 'hervor' })]) : ''}
      ${liste([
        teil(`#/tag/${nr}/lektion/${t.lektion ? 0 : (t.lektionPos ?? 0)}`, 'book-open-text', '1. Lektion', `${inhalt.lektion.length} Häppchen · ca. 10 Min`, f.teile.lektion),
        teil(`#/tag/${nr}/vokabeln`, 'layers', '2. Vokabeln', `${inhalt.vokabeln.length} Begriffe · ca. 5 Min`, f.teile.vokabeln),
        teil(`#/tag/${nr}/quiz`, 'circle-help', '3. Quiz', t.quiz.beste !== null ? `Bestes Ergebnis: ${t.quiz.beste} von ${inhalt.quiz.length}` : `${inhalt.quiz.length} Fragen · ca. 5 Min`, f.teile.quiz),
        teil(`#/tag/${nr}/uebungen`, 'chart-candlestick', '4. Chart-Übungen', `${f.uebErledigt} von ${inhalt.uebungen.length} erledigt · ca. 10 Min`, f.teile.uebungen)
      ])}
      ${liste([eintrag({ href: `#/tag/${nr}/abschluss`, ico: 'flag', icoKlasse: f.gesamt >= 1 ? 'positiv' : '', titel: 'Tagesabschluss',
        info: f.gesamt >= 1 ? 'Deine Zusammenfassung von heute' : 'Wird freigeschaltet, wenn alle vier Teile erledigt sind', klasse: f.gesamt >= 1 ? 'hervor' : '' })])}`
  };
}

// ---------- Lektion ----------
function seiteLektion(nr, i) {
  const inhalt = inhalte[nr];
  const n = inhalt.lektion.length;
  i = Math.max(0, Math.min(n - 1, i));
  const h = inhalt.lektion[i];
  const letzte = i === n - 1;
  const s = store.tag(nr);
  if (!s.lektion) { s.lektionPos = i; store.speichern(); }
  return {
    titel: `Lektion ${i + 1}/${n}`,
    zurueck: `#/tag/${nr}`,
    nav: 'plan',
    html: `
      <ion-card class="lektion"><ion-card-content>
        <h2>${esc(h.titel)}</h2>
        ${grafik(h.grafik)}
        <div class="text">${markup(h.text)}</div>
        ${h.merke ? `<div class="merke">${markup(h.merke)}</div>` : ''}
      </ion-card-content></ion-card>
      <div class="punkte">${inhalt.lektion.map((_, j) => `<i class="${j <= i ? 'an' : ''}"></i>`).join('')}</div>
      <div class="knopf-reihe">
        <ion-button color="medium" id="zurueck-k" ${i === 0 ? 'disabled' : ''}>${icon('chevron-left', 20)}Zurück</ion-button>
        <ion-button id="weiter-k">${letzte ? `${icon('check', 20)}Abschließen` : `Weiter${icon('chevron-right', 20)}`}</ion-button>
      </div>
      <p class="hinweis mittig">Tipp: Du kannst auch wischen.</p>`,
    danach(el) {
      const geh = j => { location.hash = `#/tag/${nr}/lektion/${j}`; };
      const weiter = () => {
        if (letzte) {
          store.tag(nr).lektion = true;
          store.speichern();
          store.aktivitaet();
          vibriere('richtig');
          toast('Lektion abgeschlossen. Weiter mit den Vokabeln.', { farbe: 'success' });
          location.hash = `#/tag/${nr}/vokabeln`;
        } else geh(i + 1);
      };
      el.querySelector('#weiter-k').onclick = weiter;
      el.querySelector('#zurueck-k').onclick = () => i > 0 && geh(i - 1);
      let x0 = null;
      const kasten = el.querySelector('.lektion');
      kasten.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
      kasten.addEventListener('touchend', e => {
        if (x0 === null) return;
        const dx = e.changedTouches[0].clientX - x0;
        x0 = null;
        if (dx < -60 && !letzte) geh(i + 1);
        else if (dx > 60 && i > 0) geh(i - 1);
      });
    }
  };
}

// ---------- Vokabeln ----------
function seiteVokabelMenue(nr) {
  const karten = inhalte[nr].vokabeln;
  const neu = karten.filter(k => !leitner.istGesehen(k.id)).length;
  const sicher = karten.filter(k => leitner.istSicher(k.id)).length;
  const wackel = karten.filter(k => leitner.istWackel(k.id)).length;
  const modus = (m, ico, name, info) => eintrag({ href: `#/tag/${nr}/vokabeln/${m}`, ico, titel: name, info });
  return {
    titel: `Tag ${nr}: Vokabeln`,
    zurueck: `#/tag/${nr}`,
    nav: 'plan',
    html: `
      ${karte(`<div class="drei-zahlen">
        <div><b>${hoch(neu)}</b><span class="hinweis">neu</span></div>
        <div><b class="positiv">${hoch(sicher)}</b><span class="hinweis">sicher</span></div>
        <div><b class="negativ">${hoch(wackel)}</b><span class="hinweis">wackelig</span></div></div>`)}
      ${liste([
        modus('gemischt', 'shuffle', 'Gemischt (empfohlen)', 'Alle Abfragearten durcheinander'),
        modus('karte', 'layers', 'Begriff → Erklärung', 'Karteikarte umdrehen, selbst bewerten'),
        modus('umgekehrt', 'arrow-right-left', 'Erklärung → Begriff', 'Welcher Begriff ist gemeint?'),
        modus('mc', 'list-checks', 'Multiple Choice', 'Richtige Antwort aus vier auswählen')
      ])}
      <p class="hinweis">Unsichere Begriffe kommen öfter dran (Leitner-System). Begriffe, die du sicher kannst, siehst du erst nach einigen Tagen wieder.</p>`
  };
}

function maskiere(text, k) {
  let t = text;
  for (const w of [k.de, ...k.de.split(/\s*\/\s*/), k.en, ...k.en.split(/\s*\/\s*/)]) {
    if (w.length < 3) continue;
    t = t.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '▢▢▢');
  }
  return t;
}

function seiteVokabelSitzung(karten, modus, zurueck, titel) {
  return {
    titel, zurueck, nav: zurueck.startsWith('#/wiederholen') ? 'wiederholen' : 'plan',
    html: '<div id="sitzung"></div>',
    danach(el) {
      const kasten = el.querySelector('#sitzung');
      if (!karten.length) {
        kasten.innerHTML = leer('circle-check', 'Alles erledigt', 'Gerade sind keine Begriffe offen. Schau morgen wieder vorbei.',
          `<ion-button href="${zurueck}">Zurück</ion-button>`);
        return;
      }
      const pool = alleKarten();
      const schlange = mischen(karten);
      const nochmal = new Set();
      const zaehler = { gewusst: 0, unsicher: 0, nicht: 0 };
      let erledigt = 0;

      const naechste = () => {
        if (!schlange.length) return ende();
        const k = schlange.shift();
        const m = modus === 'gemischt' ? mischen(['karte', 'umgekehrt', 'mc'])[0] : modus;
        const gesamt = erledigt + schlange.length + 1;
        const kopf = `<div class="zaehler">${erledigt + 1} von ${gesamt}</div>${balken(erledigt / gesamt)}<div class="abstand"></div>`;
        if (m === 'mc') zeigeMC(k, kopf); else zeigeKarte(k, m, kopf);
      };

      const bewerte = (k, ergebnis) => {
        leitner.bewerten(k.id, ergebnis);
        zaehler[ergebnis]++;
        erledigt++;
        if (ergebnis === 'nicht' && !nochmal.has(k.id)) {
          nochmal.add(k.id);
          schlange.push(k);
        }
        naechste();
      };

      const begriffHtml = k => `<div class="begriff">${esc(k.de)}</div><div class="en" style="margin-top:6px">${esc(k.en)}</div>`;
      const vorder = (k, m) => m === 'karte' ? begriffHtml(k) : `<div style="font-size:18px">${esc(maskiere(k.erklaerung, k))}</div>`;
      const rueck = (k, m) => m === 'karte'
        ? `<div class="begriff klein">${esc(k.de)}</div><div class="rueckseite">${esc(k.erklaerung)}${k.beispiel ? `<div class="beispiel">Beispiel: ${esc(k.beispiel)}</div>` : ''}</div>`
        : `${begriffHtml(k)}${k.beispiel ? `<div class="beispiel">Beispiel: ${esc(k.beispiel)}</div>` : ''}`;

      // Karteikarte mit echter Drehung (Vorder- und Rückseite)
      function zeigeKarte(k, m, kopf) {
        kasten.innerHTML = `${kopf}
          <div class="flip" id="kartei" role="button" aria-label="Karte umdrehen">
            <div class="flip-innen">
              <div class="flip-seite vorne">${vorder(k, m)}<div class="tipp-hinweis">${icon('refresh-cw', 16)}Antippen zum Umdrehen</div></div>
              <div class="flip-seite hinten">${rueck(k, m)}</div>
            </div>
          </div>
          <div id="bewertung"></div>`;
        const flip = kasten.querySelector('#kartei');
        flip.onclick = () => {
          if (flip.classList.contains('umgedreht')) return;
          flip.classList.add('umgedreht');
          vibriere('tipp');
          kasten.querySelector('#bewertung').innerHTML = `<div class="knopf-reihe drei einblenden">
            <ion-button color="danger" data-e="nicht">Nicht gewusst</ion-button>
            <ion-button color="medium" data-e="unsicher">Unsicher</ion-button>
            <ion-button color="success" data-e="gewusst">Gewusst</ion-button></div>`;
          kasten.querySelectorAll('[data-e]').forEach(b => b.onclick = () => {
            vibriere(b.dataset.e === 'gewusst' ? 'richtig' : b.dataset.e === 'nicht' ? 'falsch' : 'tipp');
            bewerte(k, b.dataset.e);
          });
        };
      }

      function zeigeMC(k, kopf) {
        const richtung = Math.random() < 0.5 ? 'begriff' : 'erklaerung';
        const andere = mischen(pool.filter(x => x.id !== k.id)).slice(0, 3);
        const optionen = mischen([k, ...andere]);
        const frage = richtung === 'begriff'
          ? `<div class="hinweis">Was bedeutet …</div><div class="karte-titel" style="margin-top:4px">${esc(k.de)}</div><div class="en">${esc(k.en)}</div>`
          : `<div class="hinweis">Welcher Begriff passt?</div><div style="font-size:18px;margin-top:4px">${esc(maskiere(k.erklaerung, k))}</div>`;
        const text = o => richtung === 'begriff' ? esc(o.erklaerung) : `<b>${esc(o.de)}</b> <span class="en">${esc(o.en)}</span>`;
        kasten.innerHTML = `${kopf}${karte(frage)}
          <div class="optionen">${optionen.map(o => optionKnopf(text(o), `data-id="${o.id}"`)).join('')}</div>
          <div id="mc-erg"></div>`;
        const alle = [...kasten.querySelectorAll('.option')];
        alle.forEach(b => b.onclick = () => {
          const ok = b.dataset.id === k.id;
          markiereOptionen(alle, x => x.dataset.id === k.id, b);
          kasten.querySelector('#mc-erg').innerHTML = `
            ${box(ok ? 'positiv' : 'negativ', ok ? 'Richtig!' : 'Leider falsch.', `<p><b>${esc(k.de)}</b> <span class="en">${esc(k.en)}</span>: ${esc(k.erklaerung)}</p>`)}
            <div class="abstand"></div><ion-button expand="block">Weiter${icon('chevron-right', 20)}</ion-button>`;
          kasten.querySelector('#mc-erg ion-button').onclick = () => bewerte(k, ok ? 'gewusst' : 'nicht');
        });
      }

      function ende() {
        kasten.innerHTML = `
          <div class="leer">${icon('sparkles', 40)}<h3>Geschafft!</h3></div>
          ${karte(`<div class="drei-zahlen">
            <div><b class="positiv">${hoch(zaehler.gewusst)}</b><span class="hinweis">gewusst</span></div>
            <div><b>${hoch(zaehler.unsicher)}</b><span class="hinweis">unsicher</span></div>
            <div><b class="negativ">${hoch(zaehler.nicht)}</b><span class="hinweis">nicht gewusst</span></div></div>`)}
          <ion-button expand="block" href="${zurueck}">Fertig</ion-button>`;
        zaehleHoch(kasten);
      }

      naechste();
    }
  };
}

// ---------- Quiz ----------
function seiteQuiz(nr) {
  const fragen = inhalte[nr].quiz;
  return {
    titel: `Tag ${nr}: Quiz`,
    zurueck: `#/tag/${nr}`,
    nav: 'plan',
    html: '<div id="quiz"></div>',
    danach(el) {
      const kasten = el.querySelector('#quiz');
      let i = 0, punkte = 0;

      const zeige = () => {
        if (i >= fragen.length) return ende();
        const f = fragen[i];
        let antwort = '';
        if (f.typ === 'mc') antwort = `<div class="optionen">${f.optionen.map((o, j) => optionKnopf(esc(o), `data-j="${j}"`)).join('')}</div>`;
        else if (f.typ === 'wf') antwort = `<div class="optionen">${optionKnopf('Richtig', 'data-j="1"')}${optionKnopf('Falsch', 'data-j="0"')}</div>`;
        else if (f.typ === 'rechnen') antwort = `<div class="eingabe-reihe"><input class="eingabe" inputmode="decimal" autocomplete="off" placeholder="Deine Antwort" aria-label="Deine Antwort"><span class="einheit">${esc(f.einheit ?? '')}</span></div>
          <div class="abstand"></div><ion-button expand="block" id="pruefen">${icon('check', 20)}Prüfen</ion-button>`;
        kasten.innerHTML = `<div class="zaehler">Frage ${i + 1} von ${fragen.length}</div>${balken(i / fragen.length)}<div class="abstand"></div>
          ${karte(`${f.typ === 'wf' ? '<div class="hinweis">Richtig oder falsch?</div>' : ''}${markup(f.frage)}`)}
          ${antwort}<div id="q-erg"></div>`;

        const aufloesen = (ok, titel) => {
          if (ok) punkte++;
          kasten.querySelector('#q-erg').innerHTML = `
            ${box(ok ? 'positiv' : 'negativ', titel ?? (ok ? 'Richtig!' : 'Leider falsch.'), markup(f.erklaerung))}
            <div class="abstand"></div><ion-button expand="block">${i + 1 < fragen.length ? 'Nächste Frage' : 'Ergebnis ansehen'}${icon('chevron-right', 20)}</ion-button>`;
          kasten.querySelector('#q-erg ion-button').onclick = () => { i++; zeige(); };
        };

        if (f.typ === 'rechnen') {
          const inp = kasten.querySelector('input');
          const pruef = () => {
            const wert = leseZahl(inp.value);
            if (wert === null) { inp.focus(); return; }
            inp.disabled = true;
            kasten.querySelector('#pruefen').remove();
            const ok = Math.abs(wert - f.loesung) <= (f.toleranz ?? 0);
            vibriere(ok ? 'richtig' : 'falsch');
            inp.classList.add(ok ? 'richtig' : 'falsch');
            aufloesen(ok, ok ? 'Richtig!' : `Leider falsch. Richtig ist ${zahl(f.loesung, Number.isInteger(f.loesung) ? 0 : 2)} ${f.einheit ?? ''}.`);
          };
          kasten.querySelector('#pruefen').onclick = pruef;
          inp.addEventListener('keydown', e => { if (e.key === 'Enter') pruef(); });
        } else {
          const richtigJ = f.typ === 'wf' ? (f.richtig ? 1 : 0) : f.richtig;
          const alle = [...kasten.querySelectorAll('.option')];
          alle.forEach(b => b.onclick = () => {
            markiereOptionen(alle, x => Number(x.dataset.j) === richtigJ, b);
            aufloesen(Number(b.dataset.j) === richtigJ);
          });
        }
      };

      const ende = () => {
        const t = store.tag(nr);
        t.quiz.letzte = punkte;
        t.quiz.beste = Math.max(t.quiz.beste ?? 0, punkte);
        t.quiz.versuche++;
        store.speichern();
        store.aktivitaet();
        const quote = punkte / fragen.length;
        kasten.innerHTML = `
          ${karte(`<div class="r-ergebnis ${quote >= 0.7 ? 'plus' : 'minus'}">${hoch(punkte)} / ${fragen.length}</div>
            <p class="mittig">${quote === 1 ? 'Perfekt!' : quote >= 0.7 ? 'Gut gemacht!' : 'Schau dir die Lektion ruhig noch einmal an und versuch es erneut.'}</p>`)}
          <div class="knopf-spalte">
            <ion-button expand="block" href="#/tag/${nr}/uebungen">${icon('chart-candlestick', 20)}Weiter zu den Chart-Übungen</ion-button>
            <ion-button expand="block" color="medium" id="nochmal">${icon('refresh-cw', 18)}Quiz wiederholen</ion-button>
          </div>`;
        zaehleHoch(kasten);
        kasten.querySelector('#nochmal').onclick = () => { i = 0; punkte = 0; zeige(); };
      };

      zeige();
    }
  };
}

// ---------- Chart-Übungen ----------
function seiteUebungen(nr) {
  const inhalt = inhalte[nr];
  const t = store.tag(nr);
  const zeilen = inhalt.uebungen.map((u, i) => {
    const s = t.uebungen[u.id];
    const ergebnis = !s?.erledigt ? '' : u.typ === 'entscheiden'
      ? (s.entscheidung === 'warten' ? 'abgewartet' : `${s.r > 0 ? '+' : ''}${zahl(s.r, 1)} R`)
      : (s.richtig ? 'richtig' : 'falsch');
    return eintrag({
      href: `#/tag/${nr}/uebung/${i}`,
      ico: u.stufe === 'entscheiden' ? 'target' : 'scan-search',
      icoKlasse: s?.erledigt ? 'positiv' : '',
      titel: `${i + 1}. ${esc(u.titel)}`,
      info: `${u.stufe === 'entscheiden' ? 'Entscheiden' : 'Erkennen'}${ergebnis ? ' · ' + ergebnis : ''}`,
      ende: s?.erledigt ? `<span slot="end" style="color:var(--positiv)">${icon('circle-check', 22)}</span>` : ''
    });
  });
  return {
    titel: `Tag ${nr}: Chart-Übungen`,
    zurueck: `#/tag/${nr}`,
    nav: 'plan',
    html: `<div class="box warnung oben"><div class="box-titel">${icon('info', 18)}<span>Simulierte Übungsdaten</span></div><p style="margin-top:4px">Alle Charts sind erzeugt, keine echten Aktien.</p></div>${liste(zeilen)}`
  };
}

function seiteUebung(nr, i) {
  const alleUeb = inhalte[nr].uebungen;
  const u = alleUeb[i];
  if (!u) return null;
  return {
    titel: `Übung ${i + 1}/${alleUeb.length}`,
    zurueck: `#/tag/${nr}/uebungen`,
    nav: 'plan',
    html: '<div id="uebung"></div><div id="weiter-box"></div>',
    danach(el) {
      const kasten = el.querySelector('#uebung');
      const weiter = el.querySelector('#weiter-box');
      const starten = () => {
        weiter.innerHTML = '';
        zeigeUebung(kasten, u, ergebnis => {
          store.tag(nr).uebungen[u.id] = { ...ergebnis, datum: heute(), zeit: Date.now() };
          store.speichern();
          store.aktivitaet();
          weiter.innerHTML = i + 1 < alleUeb.length
            ? `<div class="abstand"></div><ion-button expand="block" href="#/tag/${nr}/uebung/${i + 1}">Nächste Übung${icon('chevron-right', 20)}</ion-button>`
            : `<div class="abstand"></div><ion-button expand="block" href="#/tag/${nr}/abschluss">${icon('flag', 20)}Zum Tagesabschluss</ion-button>`;
        }, starten);
      };
      starten();
    }
  };
}

// ---------- Tagesabschluss ----------
function seiteAbschluss(nr) {
  const inhalt = inhalte[nr];
  const f = tagFortschritt(nr);
  const s = store.tag(nr);
  const fertig = f.gesamt >= 1;
  const naechster = plan.find(t => t.nr === nr + 1);

  if (!fertig) {
    const offen = [
      [!f.teile.lektion, 'Lektion', `#/tag/${nr}/lektion/${s.lektionPos ?? 0}`, 'book-open-text'],
      [f.teile.vokabeln < 1, 'Vokabeln', `#/tag/${nr}/vokabeln/gemischt`, 'layers'],
      [!f.teile.quiz, 'Quiz', `#/tag/${nr}/quiz`, 'circle-help'],
      [f.teile.uebungen < 1, 'Chart-Übungen', `#/tag/${nr}/uebungen`, 'chart-candlestick']
    ].filter(x => x[0]);
    return {
      titel: `Tag ${nr}: Abschluss`, zurueck: `#/tag/${nr}`, nav: 'plan',
      html: `${leer('flag', 'Fast geschafft', `Noch ${offen.length} ${offen.length === 1 ? 'Teil' : 'Teile'} offen, dann ist Tag ${nr} abgeschlossen.`)}
        ${liste(offen.map(([, name, href, ico]) => eintrag({ href, ico, titel: name, info: 'Noch offen' })))}
        <p class="hinweis">Bei den Vokabeln zählt ein Begriff als gelernt, wenn du ihn mindestens einmal gewusst hast.</p>`
    };
  }

  if (!s.abgeschlossen) { s.abgeschlossen = heute(); store.speichern(); }
  const ueb = inhalt.uebungen.map(u => ({ u, e: s.uebungen[u.id] }));
  const erkennen = ueb.filter(x => x.u.typ !== 'entscheiden');
  const erkanntRichtig = erkennen.filter(x => x.e?.richtig).length;
  const ents = ueb.filter(x => x.u.typ === 'entscheiden');
  const summeR = ents.reduce((sum, x) => sum + (x.e?.r ?? 0), 0);
  const guteEnts = ents.filter(x => x.e?.gut).length;
  const sicher = inhalt.vokabeln.filter(k => leitner.istSicher(k.id)).length;
  const gelernt = inhalt.vokabeln.filter(k => (leitner.status(k.id)?.box ?? 0) >= 2).length;
  const kachel = (wert, text) => `<div class="kachel"><div class="zahl">${wert}</div><div class="hinweis">${text}</div></div>`;
  const kp = inhalt.abschluss?.kernpunkte ?? [];

  return {
    titel: `Tag ${nr}: Abschluss`, zurueck: `#/tag/${nr}`, nav: 'plan',
    html: `
      <div class="abschluss-kopf">
        <div class="abschluss-symbol">${icon('flag', 32)}</div>
        <h2>Tag ${nr} geschafft</h2>
        <p class="hinweis">${esc(inhalt.titel)}</p>
      </div>
      <div class="statistik">
        ${kachel(`${hoch(s.quiz.beste ?? 0)}/${inhalt.quiz.length}`, 'Quiz (bestes Ergebnis)')}
        ${kachel(`${hoch(gelernt)}/${inhalt.vokabeln.length}`, `Begriffe gelernt · ${sicher} sicher`)}
        ${kachel(`${hoch(erkanntRichtig)}/${erkennen.length}`, 'Charts richtig erkannt')}
        ${kachel(`<span class="${summeR > 0 ? 'text-positiv' : summeR < 0 ? 'text-negativ' : ''}">${hoch(summeR, { stellen: 1, vor: '+', nach: ' R' })}</span>`, `Entscheidungen · ${guteEnts} von ${ents.length} gut begründet`)}
      </div>
      ${kp.length ? karte(`<h3>Das Wichtigste von heute</h3><ul class="kernpunkte">${kp.map(p => `<li>${icon('circle-check', 20)}<span>${esc(p)}</span></li>`).join('')}</ul>`) : ''}
      ${naechster ? karte(`<div class="hinweis">Als Nächstes</div><h3>Tag ${naechster.nr}: ${esc(naechster.titel)}</h3>
        ${inhalt.abschluss?.vorschau ? `<p style="margin:0">${esc(inhalt.abschluss.vorschau)}</p>` : ''}
        ${inhalte[naechster.nr] ? `<div class="abstand"></div><ion-button expand="block" href="#/tag/${naechster.nr}">Tag ${naechster.nr} starten${icon('chevron-right', 20)}</ion-button>`
          : `<div class="abstand"></div><ion-chip class="warnung">${icon('lock', 14)}Inhalte folgen</ion-chip>`}`) : ''}
      <ion-button expand="block" color="medium" href="#/">Zum Tagesplan</ion-button>`,
    danach() { vibriere('ziel'); }
  };
}

// ---------- Wiederholen ----------
function seiteWiederholen() {
  const faellig = faelligeKarten();
  const wackel = wackelKarten();
  if (!alleKarten().some(k => leitner.istGesehen(k.id))) {
    return { titel: 'Wiederholen', html: leer('repeat', 'Noch nichts zu wiederholen', 'Sobald du die ersten Vokabeln gelernt hast, erscheinen sie hier zur Wiederholung.', '<ion-button href="#/tag/1/vokabeln">Vokabeln lernen</ion-button>') };
  }
  return {
    titel: 'Wiederholen',
    html: `
      ${karte(`<h3>Fällige Begriffe</h3>
        <p class="hinweis" style="margin-top:0">Begriffe, die laut Leitner-System heute wieder drankommen.</p>
        <ion-button expand="block" href="#/wiederholen/faellig" ${faellig.length ? '' : 'color="medium"'}>${icon('repeat', 20)}${faellig.length} wiederholen</ion-button>`)}
      ${karte(`<h3>Wackelkandidaten</h3>
        <p class="hinweis" style="margin-top:0">Begriffe, die du schon einmal nicht wusstest und die noch nicht sicher sitzen.</p>
        ${wackel.length ? `${wackel.map(k => `<div class="glossar-eintrag"><b>${esc(k.de)}</b> <span class="en">${esc(k.en)}</span></div>`).join('')}<div class="abstand"></div>` : ''}
        <ion-button expand="block" href="#/wiederholen/wackel" ${wackel.length ? '' : 'color="medium"'}>${icon('target', 20)}${wackel.length} üben</ion-button>`)}`
  };
}

// ---------- Glossar ----------
function seiteGlossar() {
  const karten = alleKarten().sort((a, b) => a.de.localeCompare(b.de, 'de'));
  const zeile = k => {
    const s = leitner.status(k.id);
    const chip = !s ? '' : leitner.istSicher(k.id) ? `<ion-chip class="positiv">${icon('check', 14)}sicher</ion-chip>`
      : leitner.istWackel(k.id) ? `<ion-chip class="negativ">${icon('triangle-alert', 14)}wackelig</ion-chip>` : `<ion-chip>Fach ${s.box}</ion-chip>`;
    return `<div class="glossar-eintrag" data-suche="${esc((k.de + ' ' + k.en + ' ' + k.erklaerung).toLowerCase())}">
      <div class="zeile"><b class="wachsen">${esc(k.de)} <span class="en" style="font-weight:400">${esc(k.en)}</span></b>${chip}</div>
      <div class="klein-text">${esc(k.erklaerung)}</div>
      ${k.beispiel ? `<div class="hinweis">Beispiel: ${esc(k.beispiel)}</div>` : ''}</div>`;
  };
  return {
    titel: 'Glossar',
    html: `<ion-searchbar id="suche" placeholder="Suchen (deutsch oder englisch)" debounce="100"></ion-searchbar>
      ${karte(`<div id="glossar">${karten.map(zeile).join('')}</div><div id="keine" hidden>${leer('search', 'Nichts gefunden', 'Versuch es mit einem anderen Wort, auch auf Englisch.')}</div>`)}`,
    danach(el) {
      el.querySelector('#suche').addEventListener('ionInput', e => {
        const q = (e.detail.value ?? '').trim().toLowerCase();
        let treffer = 0;
        el.querySelectorAll('#glossar .glossar-eintrag').forEach(x => {
          x.hidden = !!q && !x.dataset.suche.includes(q);
          if (!x.hidden) treffer++;
        });
        el.querySelector('#keine').hidden = treffer > 0;
      });
    }
  };
}

// ---------- Fortschritt ----------
function seiteFortschritt() {
  const karten = alleKarten();
  const boxen = [1, 2, 3, 4, 5].map(b => karten.filter(k => leitner.status(k.id)?.box === b).length);
  const neu = karten.filter(k => !leitner.istGesehen(k.id)).length;
  const sicher = karten.filter(k => leitner.istSicher(k.id)).length;
  const wackel = wackelKarten();
  let lektionen = 0, tageFertig = 0, uebungen = 0, uebGesamt = 0;
  for (const t of plan) {
    const inhalt = inhalte[t.nr];
    if (!inhalt) continue;
    const s = store.tag(t.nr);
    if (s.lektion) lektionen++;
    if (tagFortschritt(t.nr).gesamt >= 1) tageFertig++;
    uebungen += inhalt.uebungen.filter(u => s.uebungen[u.id]?.erledigt).length;
    uebGesamt += inhalt.uebungen.length;
  }
  const quote = quizQuote();
  const serie = store.lernserie();
  const kachel = (wert, text) => `<div class="kachel"><div class="zahl">${wert}</div><div class="hinweis">${text}</div></div>`;
  const vibration = store.d().einstellungen.vibration !== false;

  return {
    titel: 'Fortschritt',
    html: `
      ${store.istSpeicherOk() ? '' : box('warnung', 'Speichern nicht möglich', '<p>Der Browser erlaubt gerade kein Speichern. Dein Fortschritt geht beim Schließen verloren.</p>')}
      <div class="statistik">
        ${kachel(`${hoch(tageFertig)}/10`, 'Tage erledigt')}
        ${kachel(hoch(serie.tage), 'Tage in Folge gelernt')}
        ${kachel(quote === null ? '–' : hoch(Math.round(quote * 100), { nach: ' %' }), 'Quiz-Quote (letzter Versuch)')}
        ${kachel(`${hoch(uebungen)}/${uebGesamt}`, 'Chart-Übungen')}
        ${kachel(hoch(sicher), 'sichere Begriffe')}
        ${kachel(hoch(wackel.length), 'Wackelkandidaten')}
      </div>
      ${karte(`<h3>Karteikasten</h3>
        <div class="leitner-boxen">${boxen.map((n, i) => `<div><b>${hoch(n)}</b><span>Fach ${i + 1}</span></div>`).join('')}</div>
        <p class="hinweis" style="margin-bottom:0">${neu} Begriffe noch nicht gelernt. ${lektionen} Lektion${lektionen === 1 ? '' : 'en'} gelesen. Fach 4 und 5 gelten als sicher.</p>`)}
      ${wackel.length ? karte(`<h3>Wackelkandidaten</h3>${wackel.map(k => `<div class="glossar-eintrag"><b>${esc(k.de)}</b> <span class="en">${esc(k.en)}</span></div>`).join('')}`) : ''}
      <h3 class="abschnitt">Einstellungen</h3>
      <ion-list class="gruppe" lines="none">
        <ion-item><ion-toggle id="vibration" justify="space-between" ${vibration ? 'checked' : ''}>Vibration bei Antworten und im Chart</ion-toggle></ion-item>
      </ion-list>
      ${karte(`<h3>Sicherung</h3>
        <p class="hinweis" style="margin-top:0">Dein Fortschritt liegt nur auf diesem Handy. Speichere ab und zu eine Sicherung, z. B. in deinen Downloads oder in der Cloud.</p>
        <div class="knopf-spalte">
          <ion-button expand="block" id="export">${icon('download', 20)}Sicherung speichern</ion-button>
          <ion-button expand="block" color="medium" id="import">${icon('upload', 20)}Sicherung laden</ion-button>
          <input type="file" id="datei" accept="application/json,.json" hidden>
        </div>`)}
      ${karte(`<h3>Zurücksetzen</h3>
        <p class="hinweis" style="margin-top:0">Löscht deinen gesamten Lernfortschritt auf diesem Gerät.</p>
        <ion-button expand="block" color="danger" fill="outline" id="reset">${icon('trash-2', 20)}Fortschritt löschen</ion-button>`)}
      <p class="fusszeile">Lerninhalt, keine Anlageberatung. Alle Charts sind simulierte Übungsdaten.<br>Version ${esc(self.APP_VERSION)}</p>`,
    danach(el) {
      el.querySelector('#vibration').addEventListener('ionChange', e => {
        store.d().einstellungen.vibration = e.detail.checked;
        store.speichern();
        vibriere('richtig');
      });
      el.querySelector('#export').onclick = () => {
        const blob = new Blob([store.exportieren()], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `trading-lernapp-sicherung-${heute()}.json`;
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        toast('Sicherung gespeichert (Ordner „Downloads“).', { farbe: 'success' });
      };
      const datei = el.querySelector('#datei');
      el.querySelector('#import').onclick = () => datei.click();
      datei.onchange = async () => {
        const f = datei.files[0];
        if (!f) return;
        if (!await bestaetigen('Sicherung laden?', 'Dein aktueller Fortschritt wird durch die Sicherung ersetzt.', 'Ersetzen')) return;
        try {
          store.importieren(await f.text());
          zeichnen();
          toast('Sicherung geladen.', { farbe: 'success' });
        } catch (e) {
          toast('Fehler: ' + e.message, { farbe: 'danger', dauer: 4000 });
        }
      };
      el.querySelector('#reset').onclick = async () => {
        if (await bestaetigen('Fortschritt löschen?', 'Das lässt sich nicht rückgängig machen. Speichere vorher eine Sicherung, wenn du unsicher bist.', 'Löschen')) {
          store.zuruecksetzen();
          zeichnen();
          toast('Fortschritt gelöscht.');
        }
      };
    }
  };
}

// ---------- Offline & Updates ----------
function serviceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // updateViaCache 'none': bei der Update-Prüfung nie den Browser-Zwischenspeicher nutzen (sonst bis zu 10 Min. Verzögerung).
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
    const zeigeHinweis = w => toast('Update verfügbar', { knopf: { text: 'Jetzt laden', aktion: () => w.postMessage('skipWaiting') } });
    if (reg.waiting && navigator.serviceWorker.controller) zeigeHinweis(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const neu = reg.installing;
      neu?.addEventListener('statechange', () => {
        if (neu.state === 'installed' && navigator.serviceWorker.controller) zeigeHinweis(neu);
      });
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(() => {});
  // Nur neu laden, wenn ein Update übernommen wurde (nicht beim allerersten Besuch).
  const hatteController = !!navigator.serviceWorker.controller;
  let neuGeladen = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hatteController || neuGeladen) return;
    neuGeladen = true;
    location.reload();
  });
}

start();
