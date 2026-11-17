import { resizeImage } from './images';
import { getDb } from './storage/db';

export const DEFAULT_AVATAR = '/avatar.svg';
/** Eigene Avatare werden auf diese Kantenlänge verkleinert. */
export const AVATAR_SIZE = 256;
const AVATAR_ID = 'avatar';

class AvatarStore {
  url = $state(DEFAULT_AVATAR);
  custom = $state(false);

  async load(): Promise<void> {
    const db = await getDb();
    const v = await db.get('settings', AVATAR_ID);
    if (typeof v === 'string' && v.startsWith('data:image/')) {
      this.url = v;
      this.custom = true;
    }
  }

  /** Bild verkleinern und lokal speichern. */
  async set(file: File): Promise<void> {
    if (!file.type.startsWith('image/')) throw new Error('Bitte ein Bild wählen.');
    const img = await resizeImage(file, AVATAR_SIZE, 'image/webp', 0.9);
    const db = await getDb();
    await db.put('settings', img.dataUrl, AVATAR_ID);
    this.url = img.dataUrl;
    this.custom = true;
  }

  async clear(): Promise<void> {
    const db = await getDb();
    await db.delete('settings', AVATAR_ID);
    this.reset();
  }

  reset(): void {
    this.url = DEFAULT_AVATAR;
    this.custom = false;
  }
}

export const avatar = new AvatarStore();
