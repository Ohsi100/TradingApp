// Erzeugt simulierte Kursdaten (Tageskerzen mit Volumen).
// Gleicher Seed = immer derselbe Chart. Die "phasen" steuern, welches Muster entsteht.
//
// Beispiel: { seed: 7, start: 50, phasen: [{ tage: 40, trend: 0.5, vola: 1.4 }] }
//   trend  = durchschnittliche Veränderung pro Tag in %
//   vola   = Schwankung pro Tag in %
//   seitwaerts: true  = Kurs pendelt um den Startkurs der Phase
//   gap    = Kurslücke am ersten Tag der Phase in % (z. B. -6)
//   volumen = Faktor für das Volumen in dieser Phase (Standard 1)

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function erzeugeKurse({ seed = 1, start = 50, basisVolumen = 1_000_000, phasen }) {
  const zufall = mulberry32(seed);
  const gauss = () => {
    const u = Math.max(zufall(), 1e-9), v = zufall();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const r2 = x => Math.round(x * 100) / 100;

  const kerzen = [];
  let vorher = start;
  for (const p of phasen) {
    const sigma = (p.vola ?? 1.5) / 100;
    const drift = (p.trend ?? 0) / 100;
    const mitte = vorher;
    for (let i = 0; i < p.tage; i++) {
      let luecke = gauss() * sigma * 0.25;
      if (i === 0 && p.gap) luecke += p.gap / 100;
      const o = vorher * (1 + luecke);
      let ret = drift + gauss() * sigma;
      if (p.seitwaerts) ret += 0.18 * (mitte - o) / o;
      let c = o * (1 + ret);
      let h = Math.max(o, c) * (1 + Math.abs(gauss()) * sigma * 0.5);
      let l = Math.min(o, c) * (1 - Math.abs(gauss()) * sigma * 0.5);
      // Besondere Kerzenformen (nur am ersten Tag der Phase), z. B. für die Übungen an Tag 4
      if (i === 0 && p.form === 'hammer') {        // kleiner Körper oben, langer unterer Docht
        c = o * (1 + sigma * 0.3); h = c * (1 + sigma * 0.15); l = o * (1 - sigma * 3.5);
      } else if (i === 0 && p.form === 'sternschnuppe') { // kleiner Körper unten, langer oberer Docht
        c = o * (1 - sigma * 0.3); l = c * (1 - sigma * 0.15); h = o * (1 + sigma * 3.5);
      } else if (i === 0 && p.form === 'doji') {   // Eröffnung = Schluss, Dochte auf beiden Seiten
        c = o * (1 + sigma * 0.02); h = o * (1 + sigma * 1.4); l = o * (1 - sigma * 1.4);
      } else if (i === 0 && p.form === 'gross') {  // sehr großer Körper in Trendrichtung
        c = o * (1 + Math.sign(drift || 1) * sigma * 4.5);
        h = Math.max(o, c) * (1 + sigma * 0.2); l = Math.min(o, c) * (1 - sigma * 0.2);
      }
      const bewegung = Math.abs(c - vorher) / vorher;
      const v = basisVolumen * (p.volumen ?? 1) * Math.exp(0.25 * gauss()) * (1 + 10 * bewegung);
      kerzen.push({ o: r2(o), h: r2(h), l: r2(l), c: r2(c), v: Math.round(v) });
      vorher = c;
    }
  }
  return kerzen;
}
