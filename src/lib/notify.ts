import { FEATURES } from './platform';
import { markdownToPlain } from './plaintext';

export interface NotifyPrefs {
  notify: boolean;
  notifyPreview: boolean;
}

/**
 * Nur wenn eingeschaltet, erlaubt und die App gerade nicht sichtbar ist. In der Windows-App
 * zählt auch ein Fenster, das hinter einem anderen liegt (`unfocused`).
 */
export function shouldNotify(
  p: NotifyPrefs,
  permission: NotificationPermission,
  visibility: DocumentVisibilityState,
  unfocused = false,
): boolean {
  return p.notify && permission === 'granted' && (visibility === 'hidden' || unfocused);
}

export function notificationText(p: NotifyPrefs, answer: string): { title: string; body: string } {
  const plain = markdownToPlain(answer).replace(/\s+/g, ' ');
  return {
    title: 'Missa hat geantwortet',
    body: p.notifyPreview && plain ? (plain.length > 140 ? `${plain.slice(0, 137)}…` : plain) : 'Tippe, um die Antwort zu lesen.',
  };
}

/**
 * Zeigt die Benachrichtigung – über den Service Worker (nötig am Handy) oder direkt. In der
 * Windows-App ersetzt das Tauri-Plugin `window.Notification` durch Windows-Benachrichtigungen.
 */
export async function showAnswerNotification(p: NotifyPrefs, answer: string): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  const unfocused = FEATURES.notifyWhenUnfocused && !document.hasFocus();
  if (!shouldNotify(p, Notification.permission, document.visibilityState, unfocused)) return false;
  const { title, body } = notificationText(p, answer);
  if (!FEATURES.serviceWorker) {
    // Windows-App: ohne Service Worker; das App-Symbol setzt Windows selbst.
    new Notification(title, { body });
    return true;
  }
  const options: NotificationOptions = { body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: 'missa-antwort' };
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg?.showNotification) {
      await reg.showNotification(title, options);
      return true;
    }
  } catch {
    /* auf direkten Weg ausweichen */
  }
  const n = new Notification(title, options);
  n.onclick = () => {
    window.focus();
    n.close();
  };
  return true;
}
