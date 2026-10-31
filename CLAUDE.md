# CLAUDE.md – Trading-Lernapp

Diese Datei ist die Anleitung für Claude Code. Sie gehört in den App-Ordner
`Documents\2ndbrain\Projekte\trading-lernapp\CLAUDE.md` (Kopie aus dem Vault).

## Ziel
Eine private Lern-App, mit der der Nutzer in 10 Tagen Urlaub (ca. 30 Minuten pro Tag, nur Handy)
die Grundbegriffe und Grundlagen des Swing-Tradings (Haltedauer 1–2 Wochen) lernt.
Schwerpunkt: Vokabular, Quiz und Chart-Übungen. Kein echtes Handeln, keine Broker-Anbindung.
Gründlich statt schnell: Qualität der Lerninhalte ist wichtiger als Funktionsumfang.

## Harte Anforderungen
- **PWA**, läuft komplett auf dem Handy (Android, Chrome), installierbar über "Zum Startbildschirm hinzufügen".
- **Voll offline** nach dem ersten Laden (Service Worker, alle Inhalte und Bibliotheken lokal gebündelt, keine CDN-Abhängigkeit zur Laufzeit).
- **Kein Server, kein Backend, kein Login.** Hosting als statische Seite über **GitHub Pages** (öffentliches Repo).
- **Keine persönlichen Daten im Repo.** Lernfortschritt nur lokal im Browser (IndexedDB oder localStorage, mit try/catch).
- **Export/Import** des Lernfortschritts als JSON-Datei (Backup, falls Browserdaten gelöscht werden).
- Sprache der Oberfläche: Deutsch. Fachbegriffe immer zusätzlich mit englischem Originalbegriff.
- Mobile first, gut mit einer Hand bedienbar, Dark Mode, große Tippflächen.
- Einfacher Tech-Stack, ohne Build-Schritt bevorzugt (HTML/CSS/Vanilla-JS oder ein sehr leichtes Framework). Lerninhalte als getrennte JSON-Dateien, damit sie später leicht erweitert werden können.
- Für Charts: z. B. TradingView "lightweight-charts" (Open Source, lokal einbinden) oder eigenes Canvas/SVG.
- Version-Hinweis und "Update verfügbar"-Meldung, wenn eine neue Version auf GitHub Pages liegt.

## Funktionen Version 1 (Urlaub)

### 1. Tagesplan (Startseite)
- 10 Lerntage, jeder Tag ca. 30 Min: ~10 Min Lektion, ~10 Min Vokabeln/Quiz, ~10 Min Chart-Übungen.
- Tage bauen aufeinander auf; freies Springen trotzdem erlaubt.
- Fortschrittsanzeige pro Tag und gesamt.

### 2. Vokabeltrainer (Karteikarten)
- Ca. 100–150 Begriffe, jedem Lerntag zugeordnet.
- Karte: deutscher Begriff + englischer Fachbegriff, kurze Erklärung (1–3 Sätze), konkretes Zahlenbeispiel wo sinnvoll.
- Abfrage in beide Richtungen (Begriff → Erklärung, Erklärung → Begriff) und als Multiple Choice.
- **Leitner-System / Spaced Repetition**: Unsicheres kommt öfter dran, "Wackelkandidaten"-Liste.
- Tägliche Wiederholung fälliger Karten vor neuen Inhalten.

### 3. Lektionen
- Kurze Texte in Häppchen (Swipe- oder Weiter-Ansicht), mit Grafiken/Mini-Charts wo hilfreich.
- Jede Lektion endet mit 5–8 Quizfragen (Multiple Choice, Richtig/Falsch, Rechenaufgaben z. B. Positionsgröße, CRV).
- Zu jeder Antwort eine Erklärung, warum richtig oder falsch.

### 4. Chart-Übungen
Simulierte, realistisch aussehende Kursdaten (Kerzencharts mit Volumen), reproduzierbar per Seed,
gezielt so erzeugt, dass sie das jeweilige Muster klar zeigen. Klar kennzeichnen: "simulierte Übungsdaten".
- **Stufe "Erkennen"**: Fragen am Chart, z. B. "Aufwärtstrend, Abwärtstrend oder seitwärts?",
  "Tippe auf die Unterstützung", "Wo ist das letzte höhere Tief?", "Hat der Ausbruch Volumen-Bestätigung?".
  Antwort per Antippen im Chart oder Auswahl; danach Auflösung mit eingezeichneter Lösung.
- **Stufe "Entscheiden"**: Chart stoppt an einem Punkt. Nutzer wählt "Einsteigen (Long)" oder "Abwarten",
  setzt bei Einstieg Stop-Loss und Kursziel per Antippen. Dann läuft der Chart weiter (Animation),
  Ergebnis wird in R (Vielfachen des Risikos) angezeigt, mit Kommentar zur Qualität der Entscheidung
  (gute Entscheidung kann auch verlieren – das explizit erklären).
- Pro Lerntag 5–10 passende Übungen, Schwierigkeit steigend.

### 5. Fortschritt
- Erledigte Tage/Lektionen, Quiz-Quote, Anzahl sicherer Begriffe, Wackelkandidaten.
- Abschlusstest an Tag 10 über alle Themen.

## Lehrplan (10 Tage)
1. **Börse & Grundbegriffe**: Aktie, Index, ETF, Börse/außerbörslich, Kurs, Bid/Ask, Spread, Ordergebühren, Long/Short, Swing-Trading vs. Daytrading vs. Buy-and-Hold.
2. **Orderarten**: Market, Limit, Stop (Stop-Loss), Stop-Limit, Trailing Stop, Gültigkeit, Slippage, Kurslücke (Gap) und warum ein Stop bei Gaps schlechter ausgeführt werden kann.
3. **Risikomanagement**: Risiko pro Trade (z. B. 1 %), Positionsgröße berechnen, Chance-Risiko-Verhältnis (CRV), R-Multiple, Trefferquote vs. CRV, Drawdown, warum Verluste asymmetrisch wirken (−50 % braucht +100 %).
4. **Charts lesen**: Linien- vs. Kerzenchart, OHLC, Kerzenkörper/Docht, Zeiteinheiten (Tag/Woche für Swing), Volumen, lineare vs. logarithmische Skala.
5. **Trends**: höhere Hochs/höhere Tiefs, Trendlinien, Seitwärtsphase, Trendbruch und Trendwechsel.
6. **Unterstützung & Widerstand**: Zonen statt Linien, Rollentausch, Ausbruch, Fehlausbruch, Pullback.
7. **Gleitende Durchschnitte & Volumen**: SMA/EMA, 20/50/200 Tage, Golden/Death Cross, Volumen als Bestätigung.
8. **Oszillatoren**: RSI, MACD (Grundidee), überkauft/überverkauft, Divergenz, Grenzen von Indikatoren.
9. **Swing-Setups & Umfeld**: Pullback im Aufwärtstrend, Ausbruch aus Seitwärtsphase; Marktumfeld (Gesamtmarkt, Sektor), Quartalszahlen-Termine und News als Risiko; Produkte: Aktien/ETFs vs. Hebelprodukte (CFDs, Knock-outs, Optionsscheine) mit deutlicher Risikowarnung; Grundbegriff Abgeltungsteuer (ohne Steuerberatung).
10. **Psychologie & Trading-Plan**: FOMO, Revenge Trading, Stop verschieben, Overtrading; was in einen Trading-Plan gehört, Trade-Journal; Abschlusstest.

## Fachliche Qualität
- Inhalte müssen fachlich korrekt sein. Keine Gewinnversprechen, keine konkreten Kaufempfehlungen.
- Hinweis in der App: Lerninhalt, keine Anlageberatung.
- Lerninhalte nach dem Erstellen vom Nutzer im Claude-Chat gegenprüfen lassen (Inhalte liegen dafür als lesbare JSON-Dateien vor).

## Später (Version 2, nach dem Urlaub – noch nicht bauen)
- Positionsgrößen- und CRV-Rechner, Trade-Plan-Checkliste, Trade-Journal fürs Demokonto mit Auswertung,
  Export als Text für die Analyse im Claude-Chat. Architektur so anlegen, dass das ergänzt werden kann.

## Arbeitsweise
- Erst einen klickbaren Prototyp mit Tag 1 komplett (Lektion, Vokabeln, Quiz, Chart-Übungen) bauen,
  auf dem Handy testen, dann die übrigen Tage mit Inhalten füllen.
- Am Ende: Schritt-für-Schritt-Anleitung für GitHub Pages und die Installation auf dem Android-Handy.
- Die App vor dem Urlaub vollständig auf dem Handy offline testen (Flugmodus).
