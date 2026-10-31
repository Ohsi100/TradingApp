// Kleine Helfer für Ionic-Bausteine: Toasts (kurze Rückmeldungen) und Bestätigungsdialoge.

export async function toast(nachricht, { dauer = 2500, farbe, knopf } = {}) {
  const t = document.createElement('ion-toast');
  t.message = nachricht;
  t.duration = knopf ? 0 : dauer;
  t.position = 'bottom';
  t.positionAnchor = 'tabbar';
  if (farbe) t.color = farbe;
  if (knopf) t.buttons = [{ text: knopf.text, handler: knopf.aktion }];
  document.querySelector('ion-app').append(t);
  t.addEventListener('didDismiss', () => t.remove());
  await customElements.whenDefined('ion-toast');
  return t.present();
}

// Bestätigung nur bei Löschen bzw. Überschreiben (siehe Designvorgaben).
export function bestaetigen(titel, text, knopfText) {
  return new Promise(async aufloesen => {
    const a = document.createElement('ion-alert');
    a.header = titel;
    a.message = text;
    a.buttons = [
      { text: 'Abbrechen', role: 'cancel' },
      { text: knopfText, role: 'destructive', cssClass: 'alert-gefahr' }
    ];
    document.querySelector('ion-app').append(a);
    a.addEventListener('didDismiss', e => { a.remove(); aufloesen(e.detail.role === 'destructive'); });
    await customElements.whenDefined('ion-alert');
    a.present();
  });
}
