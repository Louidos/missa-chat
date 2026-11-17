<script lang="ts">
  import { chat } from '../lib/chat.svelte';
  import { buildExport, download, ImportError, parseImport } from '../lib/export';
  import { history } from '../lib/history.svelte';
  import { prefs, type Prefs } from '../lib/prefs.svelte';
  import { session } from '../lib/session.svelte';
  import { listConversations, putConversations, type Conversation } from '../lib/storage/conversations';

  let message = $state('');
  let error = $state('');

  async function exportAll() {
    error = '';
    const list = await listConversations();
    const current = $state.snapshot(chat.conversation) as Conversation;
    const all = current.messages.length ? [current, ...list.filter((c) => c.id !== current.id)] : list;
    const data = buildExport(all, session.connection, $state.snapshot(prefs.value) as unknown as Record<string, unknown>);
    download(
      JSON.stringify(data, null, 2),
      `missa-chat-export-${new Date().toISOString().slice(0, 10)}.json`,
      'application/json',
    );
    message = `${all.length} Gespräche exportiert (ohne Key).`;
  }

  async function onImport(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    message = '';
    error = '';
    try {
      const { conversations, prefs: imported } = parseImport(await file.text());
      await putConversations(conversations);
      const allowed: Partial<Prefs> = {};
      for (const k of Object.keys(prefs.value) as Array<keyof Prefs>) {
        if (k in imported) (allowed as Record<string, unknown>)[k] = imported[k];
      }
      if (Object.keys(allowed).length) await prefs.update(allowed);
      await history.refresh();
      if (conversations.some((c) => c.id === chat.conversation.id)) {
        const id = chat.conversation.id;
        await chat.startNew();
        await chat.open(id);
      }
      message = `${conversations.length} Gespräche importiert.`;
    } catch (err) {
      error = err instanceof ImportError ? err.message : 'Die Datei konnte nicht gelesen werden.';
    }
  }
</script>

<section class="card">
  <h2>Daten</h2>
  <p class="muted">
    Sichern oder auf ein anderes Gerät übertragen. Der Export enthält Gespräche, Adressen und Einstellungen –
    <strong>nie den API-Key</strong>. Beim Import werden Gespräche mit gleicher Kennung ersetzt.
  </p>
  <div class="row">
    <button type="button" onclick={exportAll}>Alles exportieren (JSON)</button>
    <label class="button-like">
      <input type="file" accept="application/json,.json" class="sr-only" onchange={onImport} />
      Importieren …
    </label>
  </div>
  {#if message}<p role="status">{message}</p>{/if}
  {#if error}<p class="alert" role="alert">{error}</p>{/if}
</section>

<style>
  .row {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .button-like {
    display: inline-flex;
    align-items: center;
    min-height: 2.75rem;
    padding: 0.4rem 1rem;
    border-radius: 0.9rem;
    border: 1px solid var(--border);
    background: var(--surface-2);
    cursor: pointer;
  }
  .button-like:focus-within {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
</style>
