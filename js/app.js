// Hauptprogramm: lädt die Inhalte, verwaltet die Seiten (Routen) und zeichnet sie.
import * as store from './store.js';
import * as leitner from './leitner.js';
import { zeigeUebung } from './uebungen.js';
import { grafik } from './grafiken.js';
import { esc, markup, mischen, leseZahl, zahl, heute } from './util.js';

const app = document.getElementById('app');
const titelEl = document.getElementById('titel');
const zurueckEl = document.getElementById('zurueck');

let plan = [];          // Übersicht aller 10 Tage
const inhalte = {};     // Tag-Nr -> Inhalt aus content/tag-XX.json

// ---------- Start ----------
async function start() {
  store.laden();
  themeAnwenden();
  try {
    plan = (await ladeJson('content/tage.json')).tage;
    await Promise.all(plan.filter(t => t.datei).map(async t => { inhalte[t.nr] = await ladeJson(t.datei); }));
  } catch (e) {
    app.innerHTML = `<div class="karte"><h2>Inhalte konnten nicht geladen werden</h2><p>${esc(e.message)}</p></div>`;
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

function themeAnwenden() {
  document.documentElement.dataset.theme = store.d().einstellungen.theme || 'dunkel';
}

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

const prozent = x => Math.round(x * 100) + ' %';
const balken = x => `<div class="balken"><i style="width:${Math.round(x * 100)}%"></i></div>`;

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
  seite ??= { titel: 'Nicht gefunden', zurueck: '#/', html: '<div class="karte">Diese Seite gibt es nicht.</div>' };

  titelEl.textContent = seite.titel;
  zurueckEl.hidden = !seite.zurueck;
  zurueckEl.dataset.ziel = seite.zurueck || '';
  document.querySelectorAll('.leiste a').forEach(l => l.classList.toggle('aktiv', l.dataset.nav === (seite.nav ?? (a || 'plan'))));
  app.innerHTML = seite.html ?? '';
  seite.danach?.(app);
  window.scrollTo(0, 0);
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
      return `<div class="karte tag-karte gesperrt"><div class="tag-nr">${t.nr}</div>
        <div class="wachsen"><b>${esc(t.titel)}</b><div class="hinweis">Inhalte folgen</div></div></div>`;
    }
    return `<a class="karte tag-karte ${f.gesamt >= 1 ? 'fertig' : ''}" href="#/tag/${t.nr}">
      <div class="tag-nr">${f.gesamt >= 1 ? '✓' : t.nr}</div>
      <div class="wachsen" style="flex:1">
        <b>${esc(t.titel)}</b> ${empfohlen?.nr === t.nr ? '<span class="pille gruen">Heute</span>' : ''}
        <div class="hinweis">${prozent(f.gesamt)} erledigt</div>${balken(f.gesamt)}
      </div></a>`;
  }).join('');

  return {
    titel: 'Trading-Lernapp',
    html: `
      <div class="karte">
        <h2 style="margin:0 0 4px">Swing-Trading in 10 Tagen</h2>
        <div class="hinweis">Jeden Tag ca. 30 Minuten: Lektion, Vokabeln, Quiz, Chart-Übungen.</div>
        <div class="zeile" style="margin-top:10px"><span class="wachsen">Gesamtfortschritt</span><b>${prozent(gesamt)}</b></div>
        ${balken(gesamt)}
      </div>
      ${faellig ? `<a class="karte teil-karte" href="#/wiederholen/faellig" style="border-color:var(--akzent)">
          <span class="ico">🔁</span><div class="wachsen" style="flex:1"><b>Zuerst wiederholen</b>
          <div class="hinweis">${faellig} Begriff${faellig === 1 ? '' : 'e'} fällig</div></div><span>›</span></a>` : ''}
      ${tage}
      <p class="fusszeile">Lerninhalt, keine Anlageberatung.<br>Version ${esc(self.APP_VERSION)} · ${vorhanden.length} von 10 Tagen verfügbar</p>`
  };
}

// ---------- Tagesansicht ----------
function seiteTag(nr) {
  const inhalt = inhalte[nr];
  const f = tagFortschritt(nr);
  const faellig = faelligeKarten().length;
  const t = store.tag(nr);
  const status = x => x >= 1 ? '<span class="haken">✓</span>' : x > 0 ? `<span class="hinweis">${prozent(x)}</span>` : '<span class="hinweis">›</span>';
  const teil = (href, ico, name, info, x) => `<a class="karte teil-karte" href="${href}"><span class="ico">${ico}</span>
    <div style="flex:1"><b>${name}</b><div class="hinweis">${info}</div></div>${status(x)}</a>`;

  return {
    titel: `Tag ${nr}: ${inhalt.titel}`,
    zurueck: '#/',
    nav: 'plan',
    html: `
      <div class="karte"><div class="hinweis">Ziel für heute</div><div>${esc(inhalt.ziel)}</div>${balken(f.gesamt)}</div>
      ${faellig ? teil('#/wiederholen/faellig', '🔁', 'Wiederholung zuerst', `${faellig} fällige Begriffe`, 0) : ''}
      ${teil(`#/tag/${nr}/lektion`, '📘', '1. Lektion', `${inhalt.lektion.length} Häppchen · ca. 10 Min`, f.teile.lektion)}
      ${teil(`#/tag/${nr}/vokabeln`, '🗂️', '2. Vokabeln', `${inhalt.vokabeln.length} Begriffe · ca. 5 Min`, f.teile.vokabeln)}
      ${teil(`#/tag/${nr}/quiz`, '❓', '3. Quiz', t.quiz.beste !== null ? `Bestes Ergebnis: ${t.quiz.beste} von ${inhalt.quiz.length}` : `${inhalt.quiz.length} Fragen · ca. 5 Min`, f.teile.quiz)}
      ${teil(`#/tag/${nr}/uebungen`, '📈', '4. Chart-Übungen', `${f.uebErledigt} von ${inhalt.uebungen.length} erledigt · ca. 10 Min`, f.teile.uebungen)}`
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
      <div class="karte lektion">
        <h2>${esc(h.titel)}</h2>
        ${grafik(h.grafik)}
        <div class="text">${markup(h.text)}</div>
        ${h.merke ? `<div class="merke">${markup(h.merke)}</div>` : ''}
      </div>
      <div class="punkte">${inhalt.lektion.map((_, j) => `<i class="${j <= i ? 'an' : ''}"></i>`).join('')}</div>
      <div class="knopf-reihe">
        <button class="knopf zweit" id="zurueck-k" ${i === 0 ? 'disabled' : ''}>‹ Zurück</button>
        <button class="knopf" id="weiter-k">${letzte ? 'Abschließen ✓' : 'Weiter ›'}</button>
      </div>
      <p class="hinweis" style="text-align:center">Tipp: Du kannst auch wischen.</p>`,
    danach(el) {
      const geh = j => { location.hash = `#/tag/${nr}/lektion/${j}`; };
      const weiter = () => {
        if (letzte) {
          store.tag(nr).lektion = true;
          store.speichern();
          location.hash = `#/tag/${nr}/vokabeln`;
        } else geh(i + 1);
      };
      el.querySelector('#weiter-k').onclick = weiter;
      el.querySelector('#zurueck-k').onclick = () => i > 0 && geh(i - 1);
      let x0 = null;
      const box = el.querySelector('.lektion');
      box.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
      box.addEventListener('touchend', e => {
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
  const modus = (m, ico, name, info) => `<a class="karte teil-karte" href="#/tag/${nr}/vokabeln/${m}"><span class="ico">${ico}</span>
    <div style="flex:1"><b>${name}</b><div class="hinweis">${info}</div></div><span class="hinweis">›</span></a>`;
  return {
    titel: `Tag ${nr}: Vokabeln`,
    zurueck: `#/tag/${nr}`,
    nav: 'plan',
    html: `
      <div class="karte zeile" style="justify-content:space-around;text-align:center">
        <div><b style="font-size:22px">${neu}</b><div class="hinweis">neu</div></div>
        <div><b style="font-size:22px">${sicher}</b><div class="hinweis">sicher</div></div>
        <div><b style="font-size:22px">${wackel}</b><div class="hinweis">wackelig</div></div>
      </div>
      ${modus('gemischt', '🔀', 'Gemischt (empfohlen)', 'Alle Abfragearten durcheinander')}
      ${modus('karte', '🗂️', 'Begriff → Erklärung', 'Karteikarte umdrehen, selbst bewerten')}
      ${modus('umgekehrt', '↩️', 'Erklärung → Begriff', 'Welcher Begriff ist gemeint?')}
      ${modus('mc', '☑️', 'Multiple Choice', 'Richtige Antwort aus vier auswählen')}
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
      const box = el.querySelector('#sitzung');
      if (!karten.length) {
        box.innerHTML = `<div class="karte"><h3>Nichts zu tun 🎉</h3><p>Gerade sind keine Begriffe offen.</p></div>
          <a class="knopf breit" href="${zurueck}">Zurück</a>`;
        return;
      }
      const pool = alleKarten();
      const schlange = mischen(karten);
      const nochmal = new Set();
      let zaehler = { gewusst: 0, unsicher: 0, nicht: 0 }, erledigt = 0;

      const naechste = () => {
        if (!schlange.length) return ende();
        const k = schlange.shift();
        const m = modus === 'gemischt' ? mischen(['karte', 'umgekehrt', 'mc'])[0] : modus;
        const kopf = `<div class="hinweis" style="text-align:center;margin-bottom:8px">${erledigt + 1} von ${erledigt + schlange.length + 1}</div>`;
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

      const vorder = (k, m) => m === 'karte'
        ? `<div class="begriff">${esc(k.de)}</div><div class="en" style="margin-top:6px">${esc(k.en)}</div>`
        : `<div style="font-size:19px">${esc(maskiere(k.erklaerung, k))}</div>`;
      const rueck = (k, m) => m === 'karte'
        ? `<div class="rueckseite">${esc(k.erklaerung)}${k.beispiel ? `<div class="beispiel">Beispiel: ${esc(k.beispiel)}</div>` : ''}</div>`
        : `<div class="begriff">${esc(k.de)}</div><div class="en" style="margin-top:6px">${esc(k.en)}</div>
           ${k.beispiel ? `<div class="beispiel" style="text-align:left">Beispiel: ${esc(k.beispiel)}</div>` : ''}`;

      function zeigeKarte(k, m, kopf) {
        box.innerHTML = `${kopf}
          <div class="karte kartei" id="kartei">${vorder(k, m)}<div class="tipp-hinweis">Antippen zum Umdrehen</div></div>
          <div id="bewertung"></div>`;
        box.querySelector('#kartei').onclick = function () {
          if (this.dataset.offen) return;
          this.dataset.offen = '1';
          this.innerHTML = vorder(k, m) + '<hr style="border:0;border-top:1px solid var(--rand);margin:14px 0;width:100%">' + rueck(k, m);
          box.querySelector('#bewertung').innerHTML = `<div class="knopf-reihe drei">
            <button class="knopf rot" data-e="nicht">Nicht gewusst</button>
            <button class="knopf zweit" data-e="unsicher">Unsicher</button>
            <button class="knopf gruen" data-e="gewusst">Gewusst</button></div>`;
          box.querySelectorAll('[data-e]').forEach(b => b.onclick = () => bewerte(k, b.dataset.e));
        };
      }

      function zeigeMC(k, kopf) {
        const richtung = Math.random() < 0.5 ? 'begriff' : 'erklaerung';
        const andere = mischen(pool.filter(x => x.id !== k.id)).slice(0, 3);
        const optionen = mischen([k, ...andere]);
        const frage = richtung === 'begriff'
          ? `<div class="hinweis">Was bedeutet …</div><div class="begriff" style="font-size:22px">${esc(k.de)}</div><div class="en">${esc(k.en)}</div>`
          : `<div class="hinweis">Welcher Begriff passt?</div><div style="font-size:18px">${esc(maskiere(k.erklaerung, k))}</div>`;
        const text = o => richtung === 'begriff' ? esc(o.erklaerung) : `<b>${esc(o.de)}</b> <span class="en">${esc(o.en)}</span>`;
        box.innerHTML = `${kopf}<div class="karte">${frage}</div>
          <div class="optionen">${optionen.map(o => `<button class="option" data-id="${o.id}">${text(o)}</button>`).join('')}</div>
          <div id="mc-erg"></div>`;
        box.querySelectorAll('.option').forEach(b => b.onclick = () => {
          const ok = b.dataset.id === k.id;
          box.querySelectorAll('.option').forEach(x => {
            x.disabled = true;
            if (x.dataset.id === k.id) x.classList.add('richtig');
            else if (x === b) x.classList.add('falsch');
          });
          box.querySelector('#mc-erg').innerHTML = `
            <div class="erklaerung ${ok ? 'gut' : 'schlecht'}"><b>${ok ? 'Richtig!' : 'Leider falsch.'}</b>
              <p><b>${esc(k.de)}</b> <span class="en">${esc(k.en)}</span>: ${esc(k.erklaerung)}</p></div>
            <div class="abstand"></div><button class="knopf breit">Weiter</button>`;
          box.querySelector('#mc-erg .knopf').onclick = () => bewerte(k, ok ? 'gewusst' : 'nicht');
        });
      }

      function ende() {
        box.innerHTML = `<div class="karte" style="text-align:center"><h3>Geschafft!</h3>
          <div class="zeile" style="justify-content:space-around;margin-top:10px">
            <div><b style="font-size:22px;color:var(--gruen)">${zaehler.gewusst}</b><div class="hinweis">gewusst</div></div>
            <div><b style="font-size:22px">${zaehler.unsicher}</b><div class="hinweis">unsicher</div></div>
            <div><b style="font-size:22px;color:var(--rot)">${zaehler.nicht}</b><div class="hinweis">nicht gewusst</div></div>
          </div></div>
          <div class="knopf-spalte"><a class="knopf breit" href="${zurueck}">Fertig</a></div>`;
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
      const box = el.querySelector('#quiz');
      let i = 0, punkte = 0;

      const zeige = () => {
        if (i >= fragen.length) return ende();
        const f = fragen[i];
        let antwort = '';
        if (f.typ === 'mc') antwort = `<div class="optionen">${f.optionen.map((o, j) => `<button class="option" data-j="${j}">${esc(o)}</button>`).join('')}</div>`;
        else if (f.typ === 'wf') antwort = `<div class="optionen"><button class="option" data-j="1">Richtig</button><button class="option" data-j="0">Falsch</button></div>`;
        else if (f.typ === 'rechnen') antwort = `<div class="eingabe-reihe"><input class="eingabe" inputmode="decimal" autocomplete="off" placeholder="Deine Antwort"><span class="einheit">${esc(f.einheit ?? '')}</span></div>
          <div class="abstand"></div><button class="knopf breit" id="pruefen">Prüfen</button>`;
        box.innerHTML = `<div class="hinweis" style="text-align:center;margin-bottom:8px">Frage ${i + 1} von ${fragen.length}</div>
          <div class="karte">${f.typ === 'wf' ? '<div class="hinweis">Richtig oder falsch?</div>' : ''}${markup(f.frage)}</div>
          ${antwort}<div id="q-erg"></div>`;

        const aufloesen = ok => {
          if (ok) punkte++;
          box.querySelector('#q-erg').innerHTML = `
            <div class="erklaerung ${ok ? 'gut' : 'schlecht'}"><b>${ok ? 'Richtig!' : 'Leider falsch.'}</b>${markup(f.erklaerung)}</div>
            <div class="abstand"></div><button class="knopf breit">${i + 1 < fragen.length ? 'Nächste Frage' : 'Ergebnis ansehen'}</button>`;
          box.querySelector('#q-erg .knopf').onclick = () => { i++; zeige(); };
        };

        if (f.typ === 'rechnen') {
          const inp = box.querySelector('input');
          const pruef = () => {
            const wert = leseZahl(inp.value);
            if (wert === null) { inp.focus(); return; }
            inp.disabled = true;
            box.querySelector('#pruefen').remove();
            const ok = Math.abs(wert - f.loesung) <= (f.toleranz ?? 0);
            inp.style.borderColor = ok ? 'var(--gruen)' : 'var(--rot)';
            aufloesen(ok);
            if (!ok) box.querySelector('#q-erg .erklaerung b').textContent = `Leider falsch. Richtig ist ${zahl(f.loesung, Number.isInteger(f.loesung) ? 0 : 2)} ${f.einheit ?? ''}.`;
          };
          box.querySelector('#pruefen').onclick = pruef;
          inp.addEventListener('keydown', e => { if (e.key === 'Enter') pruef(); });
        } else {
          const richtigJ = f.typ === 'wf' ? (f.richtig ? 1 : 0) : f.richtig;
          box.querySelectorAll('.option').forEach(b => b.onclick = () => {
            const j = Number(b.dataset.j);
            box.querySelectorAll('.option').forEach(x => {
              x.disabled = true;
              if (Number(x.dataset.j) === richtigJ) x.classList.add('richtig');
              else if (x === b) x.classList.add('falsch');
            });
            aufloesen(j === richtigJ);
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
        box.innerHTML = `<div class="karte" style="text-align:center">
            <div class="r-ergebnis ${quote >= 0.7 ? 'plus' : 'minus'}">${punkte} / ${fragen.length}</div>
            <p>${quote === 1 ? 'Perfekt!' : quote >= 0.7 ? 'Gut gemacht!' : 'Schau dir die Lektion ruhig noch einmal an und versuch es erneut.'}</p>
          </div>
          <div class="knopf-spalte">
            <a class="knopf breit" href="#/tag/${nr}/uebungen">Weiter zu den Chart-Übungen</a>
            <button class="knopf zweit breit" id="nochmal">Quiz wiederholen</button>
          </div>`;
        box.querySelector('#nochmal').onclick = () => { i = 0; punkte = 0; zeige(); };
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
    const info = !s?.erledigt ? '' : u.typ === 'entscheiden'
      ? (s.entscheidung === 'warten' ? 'abgewartet' : `${s.r > 0 ? '+' : ''}${zahl(s.r, 1)} R`)
      : (s.richtig ? 'richtig' : 'falsch');
    return `<a class="karte teil-karte" href="#/tag/${nr}/uebung/${i}">
      <span class="ico">${u.stufe === 'entscheiden' ? '🎯' : '🔍'}</span>
      <div style="flex:1"><b>${i + 1}. ${esc(u.titel)}</b><div class="hinweis">${u.stufe === 'entscheiden' ? 'Entscheiden' : 'Erkennen'}${info ? ' · ' + info : ''}</div></div>
      ${s?.erledigt ? '<span class="haken">✓</span>' : '<span class="hinweis">›</span>'}</a>`;
  }).join('');
  return {
    titel: `Tag ${nr}: Chart-Übungen`,
    zurueck: `#/tag/${nr}`,
    nav: 'plan',
    html: `<div class="warnung">Alle Charts sind <b>simulierte Übungsdaten</b>, keine echten Aktien.</div>${zeilen}`
  };
}

function seiteUebung(nr, i) {
  const liste = inhalte[nr].uebungen;
  const u = liste[i];
  if (!u) return null;
  return {
    titel: `Übung ${i + 1}/${liste.length}`,
    zurueck: `#/tag/${nr}/uebungen`,
    nav: 'plan',
    html: '<div id="uebung"></div><div id="weiter-box"></div>',
    danach(el) {
      const box = el.querySelector('#uebung');
      const weiter = el.querySelector('#weiter-box');
      const starten = () => {
        weiter.innerHTML = '';
        zeigeUebung(box, u, ergebnis => {
          store.tag(nr).uebungen[u.id] = { ...ergebnis, datum: heute() };
          store.speichern();
          weiter.innerHTML = i + 1 < liste.length
            ? `<div class="abstand"></div><a class="knopf breit" href="#/tag/${nr}/uebung/${i + 1}">Nächste Übung ›</a>`
            : `<div class="abstand"></div><a class="knopf breit" href="#/tag/${nr}">Tag ${nr} abschließen ✓</a>`;
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
  return {
    titel: 'Wiederholen',
    html: `
      <div class="karte"><h3>Fällige Begriffe</h3>
        <p class="hinweis" style="margin-top:0">Begriffe, die laut Leitner-System heute wieder drankommen.</p>
        <a class="knopf breit ${faellig.length ? '' : 'zweit'}" href="#/wiederholen/faellig">${faellig.length} wiederholen</a></div>
      <div class="karte"><h3>Wackelkandidaten</h3>
        <p class="hinweis" style="margin-top:0">Begriffe, die du schon einmal nicht wusstest und die noch nicht sicher sitzen.</p>
        ${wackel.length ? `<ul class="liste-kompakt">${wackel.map(k => `<li><b>${esc(k.de)}</b> <span class="en">${esc(k.en)}</span></li>`).join('')}</ul><div class="abstand"></div>` : ''}
        <a class="knopf breit ${wackel.length ? '' : 'zweit'}" href="#/wiederholen/wackel">${wackel.length} üben</a></div>`
  };
}

// ---------- Glossar ----------
function seiteGlossar() {
  const karten = alleKarten().sort((a, b) => a.de.localeCompare(b.de, 'de'));
  const zeile = k => {
    const s = leitner.status(k.id);
    const pille = !s ? '' : leitner.istSicher(k.id) ? '<span class="pille gruen">sicher</span>' : leitner.istWackel(k.id) ? '<span class="pille rot">wackelig</span>' : `<span class="pille">Fach ${s.box}</span>`;
    return `<li data-suche="${esc((k.de + ' ' + k.en + ' ' + k.erklaerung).toLowerCase())}">
      <div class="zeile"><b class="wachsen">${esc(k.de)} <span class="en" style="font-weight:400">${esc(k.en)}</span></b>${pille}</div>
      <div class="klein-text">${esc(k.erklaerung)}</div>
      ${k.beispiel ? `<div class="hinweis">Beispiel: ${esc(k.beispiel)}</div>` : ''}</li>`;
  };
  return {
    titel: 'Glossar',
    html: `<input class="eingabe" id="suche" placeholder="Suchen (deutsch oder englisch)" style="font-size:17px;margin-bottom:12px">
      <div class="karte"><ul class="liste-kompakt" id="glossar">${karten.map(zeile).join('')}</ul></div>`,
    danach(el) {
      el.querySelector('#suche').addEventListener('input', e => {
        const q = e.target.value.trim().toLowerCase();
        el.querySelectorAll('#glossar li').forEach(li => { li.hidden = q && !li.dataset.suche.includes(q); });
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
  const theme = store.d().einstellungen.theme || 'dunkel';
  const stat = (zahlText, text) => `<div class="karte"><div class="zahl">${zahlText}</div><div class="hinweis">${text}</div></div>`;

  return {
    titel: 'Fortschritt',
    html: `
      ${store.istSpeicherOk() ? '' : '<div class="warnung">Der Browser erlaubt gerade kein Speichern. Dein Fortschritt geht beim Schließen verloren.</div>'}
      <div class="statistik">
        ${stat(`${tageFertig}/10`, 'Tage erledigt')}
        ${stat(`${lektionen}`, 'Lektionen gelesen')}
        ${stat(fragen ? prozent(richtig / fragen) : '–', 'Quiz-Quote (letzter Versuch)')}
        ${stat(`${uebungen}/${uebGesamt}`, 'Chart-Übungen')}
        ${stat(`${sicher}`, 'sichere Begriffe')}
        ${stat(`${wackel.length}`, 'Wackelkandidaten')}
      </div>
      <div class="karte"><h3>Karteikasten</h3>
        <div class="leitner-boxen">${boxen.map((n, i) => `<div><b>${n}</b><span>Fach ${i + 1}</span></div>`).join('')}</div>
        <p class="hinweis" style="margin-bottom:0">${neu} Begriffe noch nicht gelernt. Fach 4 und 5 gelten als sicher.</p></div>
      ${wackel.length ? `<div class="karte"><h3>Wackelkandidaten</h3><ul class="liste-kompakt">${wackel.map(k => `<li><b>${esc(k.de)}</b> <span class="en">${esc(k.en)}</span></li>`).join('')}</ul></div>` : ''}
      <div class="karte"><h3>Sicherung</h3>
        <p class="hinweis" style="margin-top:0">Dein Fortschritt liegt nur auf diesem Handy. Speichere ab und zu eine Sicherung, z. B. in deinen Downloads oder in der Cloud.</p>
        <div class="knopf-spalte">
          <button class="knopf" id="export">Sicherung speichern (JSON)</button>
          <button class="knopf zweit" id="import">Sicherung laden</button>
          <input type="file" id="datei" accept="application/json,.json" hidden>
        </div><p class="u-meldung hinweis" id="meldung"></p></div>
      <div class="karte"><h3>Darstellung</h3>
        <select class="eingabe" id="theme">
          <option value="dunkel" ${theme === 'dunkel' ? 'selected' : ''}>Dunkel</option>
          <option value="hell" ${theme === 'hell' ? 'selected' : ''}>Hell</option>
          <option value="system" ${theme === 'system' ? 'selected' : ''}>Wie das Handy</option>
        </select></div>
      <div class="karte"><h3>Zurücksetzen</h3>
        <p class="hinweis" style="margin-top:0">Löscht deinen gesamten Lernfortschritt auf diesem Gerät.</p>
        <button class="knopf rot breit" id="reset">Fortschritt löschen</button></div>
      <p class="fusszeile">Lerninhalt, keine Anlageberatung. Alle Charts sind simulierte Übungsdaten.<br>Version ${esc(self.APP_VERSION)}</p>`,
    danach(el) {
      const meldung = t => { el.querySelector('#meldung').textContent = t; };
      el.querySelector('#export').onclick = () => {
        const blob = new Blob([store.exportieren()], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `trading-lernapp-sicherung-${heute()}.json`;
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        meldung('Sicherung wurde gespeichert (Ordner „Downloads“).');
      };
      const datei = el.querySelector('#datei');
      el.querySelector('#import').onclick = () => datei.click();
      datei.onchange = async () => {
        const f = datei.files[0];
        if (!f) return;
        if (!confirm('Aktuellen Fortschritt durch die Sicherung ersetzen?')) return;
        try {
          store.importieren(await f.text());
          themeAnwenden();
          zeichnen();
        } catch (e) {
          meldung('Fehler: ' + e.message);
        }
      };
      el.querySelector('#theme').onchange = e => {
        store.d().einstellungen.theme = e.target.value;
        store.speichern();
        themeAnwenden();
      };
      el.querySelector('#reset').onclick = () => {
        if (confirm('Wirklich den gesamten Lernfortschritt löschen? Das lässt sich nicht rückgängig machen.')) {
          store.zuruecksetzen();
          zeichnen();
        }
      };
    }
  };
}

// ---------- Offline & Updates ----------
function serviceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const banner = document.getElementById('update-banner');
  navigator.serviceWorker.register('sw.js').then(reg => {
    const zeigeBanner = w => {
      banner.hidden = false;
      document.getElementById('update-knopf').onclick = () => w.postMessage('skipWaiting');
    };
    if (reg.waiting && navigator.serviceWorker.controller) zeigeBanner(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const neu = reg.installing;
      neu?.addEventListener('statechange', () => {
        if (neu.state === 'installed' && navigator.serviceWorker.controller) zeigeBanner(neu);
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
