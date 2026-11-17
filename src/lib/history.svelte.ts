import { listConversations, sortConversations, type Conversation } from './storage/conversations';

export interface ConversationSummary {
  id: string;
  title: string;
  pinned: boolean;
  updatedAt: string;
  count: number;
}

export function summarize(c: Conversation): ConversationSummary {
  return {
    id: c.id,
    title: c.title,
    pinned: !!c.pinned,
    updatedAt: c.updatedAt,
    count: c.messages.length,
  };
}

/** Liste der Gespräche für die Seitenleiste (nur Kurzinfos, keine Nachrichten). */
class History {
  items = $state<ConversationSummary[]>([]);

  async refresh(): Promise<void> {
    this.items = (await listConversations()).map(summarize);
  }

  /** Ein Gespräch in der Liste aktualisieren oder hinzufügen. */
  upsert(c: Conversation): void {
    if (c.messages.length === 0) return;
    const s = summarize(c);
    const rest = this.items.filter((i) => i.id !== c.id);
    this.items = sortConversations([...rest, s]);
  }

  remove(id: string): void {
    this.items = this.items.filter((i) => i.id !== id);
  }

  clear(): void {
    this.items = [];
  }
}

export const history = new History();
