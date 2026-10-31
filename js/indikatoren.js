// Technische Indikatoren, berechnet aus den Kerzen. Rückgabe: Array gleicher Länge, null solange zu wenig Daten.

export function sma(werte, n) {
  const aus = new Array(werte.length).fill(null);
  let summe = 0;
  for (let i = 0; i < werte.length; i++) {
    summe += werte[i];
    if (i >= n) summe -= werte[i - n];
    if (i >= n - 1) aus[i] = summe / n;
  }
  return aus;
}

// EMA: startet mit dem SMA der ersten n Werte, danach Gewichtung 2/(n+1)
export function ema(werte, n) {
  const aus = new Array(werte.length).fill(null);
  const k = 2 / (n + 1);
  let start = werte.findIndex(v => v !== null);
  if (start < 0 || werte.length - start < n) return aus;
  let wert = 0;
  for (let i = start; i < start + n; i++) wert += werte[i];
  wert /= n;
  aus[start + n - 1] = wert;
  for (let i = start + n; i < werte.length; i++) { wert = werte[i] * k + wert * (1 - k); aus[i] = wert; }
  return aus;
}

// RSI nach Wilder (Standard 14 Tage): 100 - 100 / (1 + Ø Gewinn / Ø Verlust)
export function rsi(kerzen, n = 14) {
  const aus = new Array(kerzen.length).fill(null);
  let gewinn = 0, verlust = 0;
  for (let i = 1; i < kerzen.length; i++) {
    const d = kerzen[i].c - kerzen[i - 1].c;
    const g = Math.max(d, 0), v = Math.max(-d, 0);
    if (i <= n) {
      gewinn += g; verlust += v;
      if (i === n) { gewinn /= n; verlust /= n; aus[i] = verlust === 0 ? 100 : 100 - 100 / (1 + gewinn / verlust); }
    } else {
      gewinn = (gewinn * (n - 1) + g) / n;
      verlust = (verlust * (n - 1) + v) / n;
      aus[i] = verlust === 0 ? 100 : 100 - 100 / (1 + gewinn / verlust);
    }
  }
  return aus;
}

// MACD (12, 26, 9): Linie = EMA12 - EMA26, Signal = EMA9 der Linie, Histogramm = Linie - Signal
export function macd(kerzen) {
  const c = kerzen.map(k => k.c);
  const e12 = ema(c, 12), e26 = ema(c, 26);
  const linie = c.map((_, i) => e12[i] !== null && e26[i] !== null ? e12[i] - e26[i] : null);
  const signal = ema(linie, 9);
  const histo = linie.map((v, i) => v !== null && signal[i] !== null ? v - signal[i] : null);
  return { linie, signal, histo };
}

export function linieFuer(kerzen, def) {
  const c = kerzen.map(k => k.c);
  return def.typ === 'ema' ? ema(c, def.laenge) : sma(c, def.laenge);
}
