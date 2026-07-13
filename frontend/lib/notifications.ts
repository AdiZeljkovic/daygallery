/**
 * Sistemske notifikacije (Windows/Android style) preko Notification API.
 * Rade dok je panel otvoren ili minimiziran (PWA prozor / tab).
 * Fallback kad nema dozvole: pozivalac prikazuje in-app indikator.
 */

export type NotifyPermission = 'granted' | 'denied' | 'unsupported' | 'default';

export function getNotifyPermission(): NotifyPermission {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission as NotifyPermission;
}

export async function requestNotifyPermission(): Promise<NotifyPermission> {
  if (typeof Notification === 'undefined') return 'unsupported';
  try {
    return (await Notification.requestPermission()) as NotifyPermission;
  } catch {
    return 'denied';
  }
}

export function notify(title: string, body: string, tag?: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
  try {
    const n = new Notification(title, {
      body,
      tag, // isti tag = zamjena umjesto gomilanja
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    });
    // klik fokusira panel
    n.onclick = () => {
      window.focus();
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}

/** Registracija SW-a za PWA instalabilnost — poziva se jednom iz admin layouta. */
export function registerServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
