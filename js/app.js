// Hauptprogramm: lädt die Inhalte, verwaltet die Seiten (Routen) und zeichnet sie.
import * as store from './store.js';
import * as leitner from './leitner.js';
import { zeigeUebung, optionKnopf, markiereOptionen, box } from './uebungen.js';
import { grafik } from './grafiken.js';
import { icon } from './icons.js';
import { toast, bestaetigen } from './ui.js';
import { esc, markup, mischen, leseZahl, zahl, heute } from './util.js';

const app = document.getElementById('app');
const inhaltEl = document.getElementById('inhalt');
const titelEl = document.getElementById('titel');
const zurueckEl = document.getElementById('zurueck');
const tabbar = document.getElementById('tabbar');

let plan = [];          // Übersicht aller 10 Tage
const inhalte = {};     // Tag-Nr -> Inhalt aus content/tag-XX.json

// ---------- Start ----------
async function start() {
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
    app.innerHTML = leer('triangle-alert', 'Inhalte konnten nicht geladen werden', esc(e.message),
      '<ion-button onclick="location.reload()">Neu laden</ion-button>');
    return;
  }
  window.addEventListener('hashchange', zeichnen);
  zurueckEl.onclick = () => { location.hash = zurueckEl.dataset.ziel || '#/'; };
  zeichnen();
  serviceWorker();
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

const karte = inhalt => `<ion-card><ion-card-content>${inhalt}</ion-card-content></ion-card>`;
const prozent = x => Math.round(x * 100) + ' %';
const balken = x => `<ion-progress-bar value="${Math.min(1, x).toFixed(3)}"></ion-progress-bar>`;

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
  inhaltEl.scrollToTop?.(0);
}

// ---------- Tagesplan ----------
function seitePlan() {
  const fortschritte = plan.map(t => tagFortschritt(t.nr));
  const vorhanden = fortschritte.filter(Boolean);
  const gesamt = fortschritte.reduce((s, f) => s + (f?.gesamt ?? 0), 0) / plan.length;
  const empfohlen = plan.find((t, i) => fortschritte[i] && fortschritte[i].gesamt < 1);
  const faellig = faelligeKarten().length;

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

  return {
    titel: 'Trading-Lernapp',
    html: `
      ${karte(`<div class="karte-titel">Swing-Trading in 10 Tagen</div>
        <div class="hinweis">Jeden Tag ca. 30 Minuten: Lektion, Vokabeln, Quiz, Chart-Übungen.</div>
        <div class="zeile" style="margin-top:12px"><span class="wachsen">Gesamtfortschritt</span><b class="zahlen">${prozent(gesamt)}</b></div>
        ${balken(gesamt)}`)}
      ${faellig ? liste([eintrag({ href: '#/wiederholen/faellig', ico: 'repeat', titel: 'Zuerst wiederholen', info: `${faellig} Begriff${faellig === 1 ? '' : 'e'} fällig`, klasse: 'hervor' })]) : ''}
      ${liste(tage)}
      <p class="fusszeile">Lerninhalt, keine Anlageberatung.<br>Version ${esc(self.APP_VERSION)} · ${vorhanden.length} von 10 Tagen verfügbar</p>`
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
        teil(`#/tag/${nr}/lektion`, 'book-open-text', '1. Lektion', `${inhalt.lektion.length} Häppchen · ca. 10 Min`, f.teile.lektion),
        teil(`#/tag/${nr}/vokabeln`, 'layers', '2. Vokabeln', `${inhalt.vokabeln.length} Begriffe · ca. 5 Min`, f.teile.vokabeln),
        teil(`#/tag/${nr}/quiz`, 'circle-help', '3. Quiz', t.quiz.beste !== null ? `Bestes Ergebnis: ${t.quiz.beste} von ${inhalt.quiz.length}` : `${inhalt.quiz.length} Fragen · ca. 5 Min`, f.teile.quiz),
        teil(`#/tag/${nr}/uebungen`, 'chart-candlestick', '4. Chart-Übungen', `${f.uebErledigt} von ${inhalt.uebungen.length} erledigt · ca. 10 Min`, f.teile.uebungen)
      ])}`
  };
}

// ---------- Lektion ----------
function seiteLektion(nr, i) {
  const inhalt = inhalte[nr];
  const n = inhalt.lektion.length;
  i = Math.max(0, Math.min(n - 1, i));
  const h = inhalt.lektion[i];
  const letzte = i === n - 1;
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
        <div><b>${neu}</b><span class="hinweis">neu</span></div>
        <div><b class="positiv">${sicher}</b><span class="hinweis">sicher</span></div>
        <div><b class="negativ">${wackel}</b><span class="hinweis">wackelig</span></div></div>`)}
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
        const kopf = `<div class="zaehler">${erledigt + 1} von ${erledigt + schlange.length + 1}</div>`;
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
        ? `<div class="rueckseite">${esc(k.erklaerung)}${k.beispiel ? `<div class="beispiel">Beispiel: ${esc(k.beispiel)}</div>` : ''}</div>`
        : `${begriffHtml(k)}${k.beispiel ? `<div class="beispiel">Beispiel: ${esc(k.beispiel)}</div>` : ''}`;

      function zeigeKarte(k, m, kopf) {
        kasten.innerHTML = `${kopf}
          <div class="kartei" id="kartei">${vorder(k, m)}<div class="tipp-hinweis">${icon('refresh-cw', 16)}Antippen zum Umdrehen</div></div>
          <div id="bewertung"></div>`;
        kasten.querySelector('#kartei').onclick = function () {
          if (this.dataset.offen) return;
          this.dataset.offen = '1';
          this.innerHTML = vorder(k, m) + '<hr>' + rueck(k, m);
          kasten.querySelector('#bewertung').innerHTML = `<div class="knopf-reihe drei">
            <ion-button color="danger" data-e="nicht">Nicht gewusst</ion-button>
            <ion-button color="medium" data-e="unsicher">Unsicher</ion-button>
            <ion-button color="success" data-e="gewusst">Gewusst</ion-button></div>`;
          kasten.querySelectorAll('[data-e]').forEach(b => b.onclick = () => bewerte(k, b.dataset.e));
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
            <div><b class="positiv">${zaehler.gewusst}</b><span class="hinweis">gewusst</span></div>
            <div><b>${zaehler.unsicher}</b><span class="hinweis">unsicher</span></div>
            <div><b class="negativ">${zaehler.nicht}</b><span class="hinweis">nicht gewusst</span></div></div>`)}
          <ion-button expand="block" href="${zurueck}">Fertig</ion-button>`;
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
        kasten.innerHTML = `<div class="zaehler">Frage ${i + 1} von ${fragen.length}</div>
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
        const quote = punkte / fragen.length;
        kasten.innerHTML = `
          ${karte(`<div class="r-ergebnis ${quote >= 0.7 ? 'plus' : 'minus'}">${punkte} / ${fragen.length}</div>
            <p class="mittig">${quote === 1 ? 'Perfekt!' : quote >= 0.7 ? 'Gut gemacht!' : 'Schau dir die Lektion ruhig noch einmal an und versuch es erneut.'}</p>`)}
          <div class="knopf-spalte">
            <ion-button expand="block" href="#/tag/${nr}/uebungen">${icon('chart-candlestick', 20)}Weiter zu den Chart-Übungen</ion-button>
            <ion-button expand="block" color="medium" id="nochmal">${icon('refresh-cw', 18)}Quiz wiederholen</ion-button>
          </div>`;
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
          store.tag(nr).uebungen[u.id] = { ...ergebnis, datum: heute() };
          store.speichern();
          weiter.innerHTML = i + 1 < alleUeb.length
            ? `<div class="abstand"></div><ion-button expand="block" href="#/tag/${nr}/uebung/${i + 1}">Nächste Übung${icon('chevron-right', 20)}</ion-button>`
            : `<div class="abstand"></div><ion-button expand="block" href="#/tag/${nr}">${icon('flag', 20)}Tag ${nr} abschließen</ion-button>`;
        }, starten);
      };
      starten();
    }
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
  let fragen = 0, richtig = 0, lektionen = 0, tageFertig = 0, uebungen = 0, uebGesamt = 0;
  for (const t of plan) {
    const inhalt = inhalte[t.nr];
    if (!inhalt) continue;
    const s = store.tag(t.nr);
    if (s.quiz.letzte !== null) { fragen += inhalt.quiz.length; richtig += s.quiz.letzte; }
    if (s.lektion) lektionen++;
    if (tagFortschritt(t.nr).gesamt >= 1) tageFertig++;
    uebungen += inhalt.uebungen.filter(u => s.uebungen[u.id]?.erledigt).length;
    uebGesamt += inhalt.uebungen.length;
  }
  const kachel = (wert, text) => `<div class="kachel"><div class="zahl">${wert}</div><div class="hinweis">${text}</div></div>`;

  return {
    titel: 'Fortschritt',
    html: `
      ${store.istSpeicherOk() ? '' : box('warnung', 'Speichern nicht möglich', '<p>Der Browser erlaubt gerade kein Speichern. Dein Fortschritt geht beim Schließen verloren.</p>')}
      <div class="statistik">
        ${kachel(`${tageFertig}/10`, 'Tage erledigt')}
        ${kachel(`${lektionen}`, 'Lektionen gelesen')}
        ${kachel(fragen ? prozent(richtig / fragen) : '–', 'Quiz-Quote (letzter Versuch)')}
        ${kachel(`${uebungen}/${uebGesamt}`, 'Chart-Übungen')}
        ${kachel(`${sicher}`, 'sichere Begriffe')}
        ${kachel(`${wackel.length}`, 'Wackelkandidaten')}
      </div>
      ${karte(`<h3>Karteikasten</h3>
        <div class="leitner-boxen">${boxen.map((n, i) => `<div><b>${n}</b><span>Fach ${i + 1}</span></div>`).join('')}</div>
        <p class="hinweis" style="margin-bottom:0">${neu} Begriffe noch nicht gelernt. Fach 4 und 5 gelten als sicher.</p>`)}
      ${wackel.length ? karte(`<h3>Wackelkandidaten</h3>${wackel.map(k => `<div class="glossar-eintrag"><b>${esc(k.de)}</b> <span class="en">${esc(k.en)}</span></div>`).join('')}`) : ''}
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
