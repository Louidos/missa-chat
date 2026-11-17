<script lang="ts">
  import { chat } from '../lib/chat.svelte';
  import { searchConversations, type SearchHit } from '../lib/search';
  import { listConversations, type Conversation } from '../lib/storage/conversations';

  interface Props {
    open: boolean;
    onpicked?: () => void;
  }
  let { open = $bindable(false), onpicked }: Props = $props();
  let dialog: HTMLDialogElement | undefined = $state();
  let input: HTMLInputElement | undefined = $state();
  let query = $state('');
  let all = $state<Conversation[]>([]);

  const hits: SearchHit[] = $derived(searchConversations(all, query));

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      void listConversations().then((list) => {
        // Das offene Gespräch ist evtl. noch nicht gespeichert – aktuellen Stand nehmen.
        const current = $state.snapshot(chat.conversation) as Conversation;
        all = [current, ...list.filter((c) => c.id !== current.id)];
      });
      queueMicrotask(() => input?.select());
    }
    if (!open && dialog.open) dialog.close();
  });

  async function pick(hit: SearchHit) {
    open = false;
    await chat.open(hit.conversationId, { highlight: query.trim(), focusMessageId: hit.messageId });
    onpicked?.();
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && hits[0]) {
      e.preventDefault();
      void pick(hits[0]);
    }
  }
</script>

<dialog bind:this={dialog} onclose={() => (open = false)} aria-label="Suche in allen Gesprächen">
  <div class="field">
    <label for="search-input">Suche in allen Gesprächen</label>
    <input
      id="search-input"
      bind:this={input}
      type="search"
      bind:value={query}
      {onkeydown}
      placeholder="Wort oder Satz …"
      autocomplete="off"
    />
  </div>
  {#if query.trim().length >= 2}
    <p class="count" role="status">{hits.length === 0 ? 'Keine Treffer.' : `${hits.length} Treffer`}</p>
    <ul class="hits">
      {#each hits as hit (hit.messageId)}
        <li>
          <button type="button" onclick={() => pick(hit)}>
            <span class="meta">
              <strong>{hit.conversationTitle}</strong> · {hit.role === 'user' ? 'Louis' : 'Missa'} ·
              {new Date(hit.createdAt).toLocaleDateString('de-CH')}
            </span>
            <span class="snippet">
              {#each hit.snippet as part, i (i)}{#if part.mark}<mark>{part.text}</mark>{:else}{part.text}{/if}{/each}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="hint">Mindestens 2 Zeichen. Enter öffnet den ersten Treffer, Esc schliesst.</p>
  {/if}
</dialog>

<style>
  dialog {
    width: min(40rem, calc(100vw - 2rem));
    max-height: min(36rem, calc(100dvh - 4rem));
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    padding: 1rem;
  }
  dialog::backdrop {
    background: rgb(0 0 0 / 0.45);
  }
  .count {
    font-size: 0.85rem;
    color: var(--muted);
  }
  .hits {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.3rem;
  }
  .hits button {
    width: 100%;
    text-align: left;
    display: grid;
    gap: 0.15rem;
    padding: 0.5rem 0.7rem;
    background: var(--bg);
  }
  .meta {
    font-size: 0.8rem;
    color: var(--muted);
  }
  .snippet {
    overflow-wrap: anywhere;
  }
</style>
