---
typ: vorlage
erstellt: 2026-10-31
---

# Designvorgaben für meine Apps

Gilt für alle Apps, die ich mit Claude Code baue. In jeder `CLAUDE.md` wird auf diese Datei verwiesen
und das passende Theme genannt. Ziel: Die Apps sollen wie professionelle Handy-Apps aussehen und
untereinander einheitlich wirken.

## Grundlage (für alle Apps)

### Bibliothek
- **Ionic** (Web Components, `@ionic/core`) als UI-Baukasten, Modus `md` (Android-/Material-Look).
- Ohne Build-Schritt nutzbar. Dateien **lokal im Projekt ablegen**, nicht zur Laufzeit von einem CDN laden (Offline-Fähigkeit).
- Fertige Ionic-Elemente bevorzugen statt Eigenbau: `ion-tabs`/`ion-tab-bar` (Hauptnavigation unten),
  `ion-header`/`ion-toolbar`, `ion-list`/`ion-item`, `ion-card`, `ion-button`, `ion-segment`,
  `ion-modal` (Bottom Sheets), `ion-toast` (kurze Rückmeldungen), `ion-progress-bar`, `ion-searchbar`, `ion-chip`.
- Farben ausschließlich über Ionic-CSS-Variablen bzw. die Design-Tokens unten setzen, keine verstreuten Hex-Werte im Code.

### Schrift
- **Inter** (lokal eingebunden, Variable Font), Fallback: `system-ui, sans-serif`.
- Größen: Titel 24–28 px / Abschnitt 18–20 px / Text 16 px / Klein 13–14 px. Nie unter 13 px.
- Zahlen in Tabellen und Kursen mit `font-variant-numeric: tabular-nums` (gleich breite Ziffern).

### Icons
- **Lucide** (lokal eingebunden), einheitlich Strichstärke 2, Größe 20–24 px.
- Keine Emojis als Ersatz für Icons in der Oberfläche.

### Abstände und Formen
- Abstandsraster in 4er-Schritten: 4 / 8 / 12 / 16 / 24 / 32 px. Seitenrand 16 px.
- Ecken: Karten 16 px, Buttons und Eingabefelder 12 px, Chips rund.
- Tippflächen mindestens 44 × 44 px, wichtige Aktionen unten im Daumenbereich.
- Wenig Schatten; Flächen eher über leicht unterschiedliche Hintergrundtöne trennen.

### Verhalten
- Kurze, dezente Animationen (150–250 ms), nichts Verspieltes.
- Leere Zustände immer gestalten (kurzer Text + Icon + nächste Aktion), nie leere weiße/schwarze Seiten.
- Ladezustände mit Skeletons statt Spinnern, wo möglich.
- Rückmeldungen über Toasts, Bestätigungsdialoge nur bei Löschen.
- Barrierearm: Kontrast mindestens WCAG AA (4,5:1 für Text), Bedeutung nie nur über Farbe.

### Qualitätscheck vor jeder Version
- Auf dem echten Handy ansehen (nicht nur Desktop-Browser), hoch und quer.
- Alle Texte auf Deutsch, einheitliche Begriffe, keine abgeschnittenen Wörter.
- Kein horizontales Scrollen, nichts unter der Statusleiste oder der Gestenleiste versteckt (Safe Areas).

## Theme "Dunkel & sachlich"
**Verwendet in:** Trading-Lernapp (und künftige Finanz-/Analyse-Apps)

Charakter: ruhig, konzentriert, datenorientiert – wie eine moderne Finanz-App. Wenig Farbe, Farbe trägt Bedeutung.

| Token | Wert | Verwendung |
|---|---|---|
| Hintergrund | `#0B0E14` | Seitenhintergrund |
| Fläche | `#151A23` | Karten, Listen |
| Fläche erhöht | `#1E2530` | Bottom Sheets, aktive Elemente |
| Linie | `#2A3240` | Trennlinien, Rahmen |
| Text | `#E6E9EF` | Haupttext |
| Text gedämpft | `#8B95A7` | Nebentext, Beschriftungen |
| Akzent | `#4C8DFF` | Primär-Buttons, Links, Fortschritt |
| Positiv | `#22C55E` | Gewinn, richtig, steigend |
| Negativ | `#EF4444` | Verlust, falsch, fallend |
| Warnung | `#F59E0B` | Hinweise, Risiko |

- Charts: Kerzen grün/rot wie oben, Gitterlinien sehr dezent (`#1E2530`), Achsenschrift gedämpft.
- Richtig/Falsch im Quiz zusätzlich mit Icon (Haken/Kreuz) kennzeichnen, nicht nur Farbe.
- Kein reines Schwarz und kein reines Weiß (schont die Augen abends).

## Theme "Hell & freundlich"
**Verwendet in:** Rezepte-App (und künftige Alltags-/Familien-Apps)

Charakter: warm, einladend, bildstark – Fotos der Gerichte stehen im Mittelpunkt.

| Token | Wert | Verwendung |
|---|---|---|
| Hintergrund | `#FAF8F5` | Seitenhintergrund (warmes Off-White) |
| Fläche | `#FFFFFF` | Karten |
| Linie | `#ECE7E0` | Trennlinien, Rahmen |
| Text | `#1F1B16` | Haupttext |
| Text gedämpft | `#6B6259` | Nebentext |
| Akzent | `#E0662F` | Primär-Buttons, aktive Tabs (warmes Orange) |
| Akzent hell | `#FCE9DF` | Chips, markierte Flächen |
| Positiv | `#3F9D5B` | Bestätigungen |
| Negativ | `#D64545` | Löschen, Fehler |

- Rezeptkarten mit großem Foto oben (Seitenverhältnis 4:3), Titel darunter, Zutaten-Chips.
- Etwas großzügigere Abstände als im dunklen Theme.
- Optional später ein automatischer Dunkelmodus, aber hell ist der Standard.

## Einbindung in eine neue App
In die `CLAUDE.md` der App schreiben:

> Design: Halte dich an `Designvorgaben.md` (Kopie im Projektordner), Theme "Dunkel & sachlich" bzw. "Hell & freundlich".
> Lege die Farben als CSS-Variablen in einer Datei `theme.css` an und nutze sie überall.

Zusätzlich hilft es, Claude Code 1–3 Screenshots von Apps zu zeigen, deren Stil mir gefällt (als Richtung, nicht zum Kopieren).
