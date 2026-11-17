<script lang="ts">
  import { chat } from '../lib/chat.svelte';
  import { conversationToMarkdown, download, safeFileName } from '../lib/export';
  import { history } from '../lib/history.svelte';
  import { getConversation } from '../lib/storage/conversations';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import PromptDialog from './PromptDialog.svelte';

  interface Props {
    /** Nach Auswahl (am Handy: Leiste schliessen). */
    onpicked?: () => void;
    onsearch: () => void;
  }
  let { onpicked, onsearch }: Props = $props();

  let menuFor = $state<string | null>(null);
  let renameId = $state<string | null>(null);
  let renameOpen = $state(false);
  let deleteId = $state<string | null>(null);
  let deleteOpen = $state(false);

  const renameTitle = $derived(history.items.find((i) => i.id === renameId)?.title ?? '');
  const deleteTitle = $derived(history.items.find((i) => i.id === deleteId)?.title ?? '');

  function fmt(iso: string): string {
    const d = new Date(iso);
    const today = new Date();
    return d.toDateString() === today.toDateString()
      ? d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  async function pick(id: string) {
    menuFor = null;
    await chat.open(id);
    onpicked?.();
  }

  async function exportMd(id: string) {
    menuFor = null;
    const c = id === chat.conversation.id ? $state.snapshot(chat.conversation) : await getConversation(id);
    if (!c) return;
    download(conversationToMarkdown(c), safeFileName(c.title, 'md'), 'text/markdown;charset=utf-8');
  }
</script>

<nav class="sidebar" aria-label="Gespräche">
  <div class="top">
    <button
      type="button"
      class="primary new"
      onclick={async () => {
        await chat.startNew();
        onpicked?.();
      }}
    >
      + Neues Gespräch
    </button>
    <button type="button" class="icon" onclick={onsearch} aria-label="Suchen (Ctrl+K)" title="Suchen (Ctrl+K)">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
    </button>
  </div>

  {#if history.items.length === 0}
    <p class="muted empty">Noch keine Gespräche.</p>
  {:else}
    <ul>
      {#each history.items as item (item.id)}
        <li class:active={item.id === chat.conversation.id}>
          <button
            type="button"
            class="item"
            onclick={() => pick(item.id)}
            aria-current={item.id === chat.conversation.id ? 'true' : undefined}
          >
            <span class="title">{#if item.pinned}<span aria-label="angeheftet">📌 </span>{/if}{item.title}</span>
            <span class="date">{fmt(item.updatedAt)}</span>
          </button>
          <button
            type="button"
            class="more"
            aria-label="Aktionen für „{item.title}“"
            aria-expanded={menuFor === item.id}
            onclick={() => (menuFor = menuFor === item.id ? null : item.id)}
          >
            ⋯
          </button>
          {#if menuFor === item.id}
            <div class="menu" role="group" aria-label="Aktionen">
              <button type="button" onclick={() => ((menuFor = null), chat.togglePin(item.id))}>
                {item.pinned ? 'Lösen' : 'Anheften'}
              </button>
              <button type="button" onclick={() => ((menuFor = null), (renameId = item.id), (renameOpen = true))}>
                Umbenennen
              </button>
              <button type="button" onclick={() => exportMd(item.id)}>Als Markdown exportieren</button>
              <button
                type="button"
                class="danger-text"
                onclick={() => ((menuFor = null), (deleteId = item.id), (deleteOpen = true))}
              >
                Löschen …
              </button>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</nav>

<PromptDialog
  bind:open={renameOpen}
  title="Gespräch umbenennen"
  label="Neuer Titel"
  value={renameTitle}
  confirmLabel="Speichern"
  onconfirm={(t) => (renameId ? chat.rename(renameId, t) : undefined)}
/>

<ConfirmDialog
  bind:open={deleteOpen}
  title="Gespräch löschen?"
  message={`„${deleteTitle}“ wird von diesem Gerät gelöscht. Das lässt sich nicht rückgängig machen.`}
  confirmLabel="Löschen"
  danger
  onconfirm={() => (deleteId ? chat.remove(deleteId) : undefined)}
/>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    height: 100%;
    min-height: 0;
    padding: 0.75rem 0.5rem;
  }
  .top {
    display: flex;
    gap: 0.5rem;
  }
  .new {
    flex: 1;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    flex: 1;
    display: grid;
    align-content: start;
    gap: 0.15rem;
  }
  li {
    position: relative;
    display: flex;
    align-items: stretch;
    border-radius: 0.9rem;
  }
  li.active {
    background: var(--surface-2);
  }
  .item {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.05rem;
    background: none;
    border: none;
    text-align: left;
    padding: 0.45rem 0.6rem;
  }
  .title {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }
  .date {
    font-size: 0.75rem;
    color: var(--muted);
  }
  .more {
    background: none;
    border: none;
    width: 2.5rem;
    padding: 0;
    font-size: 1.2rem;
  }
  .menu {
    position: absolute;
    right: 0.25rem;
    top: 100%;
    z-index: 5;
    display: grid;
    min-width: 13rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 0.9rem;
    box-shadow: var(--shadow-soft);
    padding: 0.3rem;
  }
  .menu button {
    background: none;
    border: none;
    text-align: left;
    border-radius: 0.6rem;
  }
  .menu button:hover {
    background: var(--surface-2);
  }
  .danger-text {
    color: var(--danger);
  }
  .empty {
    padding: 0.5rem;
  }
</style>
