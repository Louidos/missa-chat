/** Ob der Browser glaubt, online zu sein (navigator.onLine + online/offline-Ereignisse). */
class Network {
  online = $state(typeof navigator === 'undefined' ? true : navigator.onLine);
  #onOnline: Array<() => void> = [];

  constructor() {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => {
      this.online = true;
      for (const fn of this.#onOnline) fn();
    });
    window.addEventListener('offline', () => {
      this.online = false;
    });
  }

  /** Wird aufgerufen, sobald das Gerät wieder online ist. */
  onOnline(fn: () => void): void {
    this.#onOnline.push(fn);
  }
}

export const network = new Network();
