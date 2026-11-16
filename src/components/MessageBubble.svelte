<script lang="ts">
  import { copyText } from '../lib/clipboard';
  import { renderMarkdown } from '../lib/markdown';
  import type { ChatMessage } from '../lib/storage/conversations';

  interface Props {
    message: ChatMessage;
    isLast: boolean;
    isLastUser: boolean;
    busy: boolean;
    onregenerate: () => void;
    onedit: () => void;
    ondelete: () => void;
  }
  let { message, isLast, isLastUser, busy, onregenerate, onedit, ondelete }: Props = $props();

  const mine = $derived(message.role === 'user');
  const html = $derived(mine ? '' : renderMarkdown(message.content));
  const time = $derived(new Date(message.createdAt));
  const timeShort = $derived(
    time.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }),
  );
  const timeLong = $derived(time.toLocaleString('de-CH'));
  const typing = $derived(message.status === 'streaming' && message.content === '');

  let body: HTMLDivElement | undefined = $state();
  let copied = $state(false);

  // Kopier-Knöpfe an Codeblöcke hängen (nach jedem Rendern neu, da {@html} ersetzt wird).
  $effect(() => {
    void html;
    if (!body) return;
    for (const pre of body.querySelectorAll<HTMLPreElement>('pre.codeblock')) {
      if (pre.parentElement?.classList.contains('code-wrap')) continue;
      const wrap = document.createElement('div');
      wrap.className = 'code-wrap';
      const bar = document.createElement('div');
      bar.className = 'code-bar';
      const label = document.createElement('span');
      label.textContent = pre.dataset.lang ?? '';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'copy-code';
      btn.textContent = 'Kopieren';
      btn.setAttribute('aria-label', `Code kopieren${label.textContent ? ` (${label.textContent})` : ''}`);
      bar.append(label, btn);
      pre.replaceWith(wrap);
      wrap.append(bar, pre);
    }
  });

  async function onBodyClick(e: MouseEvent) {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button.copy-code');
    if (!btn) return;
    const code = btn.closest('.code-wrap')?.querySelector('code')?.textContent ?? '';
    if (await copyText(code)) {
      btn.textContent = 'Kopiert!';
      setTimeout(() => (btn.textContent = 'Kopieren'), 1500);
    }
  }

  async function copyMessage() {
    if (await copyText(message.content)) {
      copied = true;
      setTimeout(() => (copied = false), 1500);
    }
  }
</script>

<li class="msg" class:mine data-role={message.role} data-status={message.status}>
  {#if !mine}
    <img class="avatar" src="/avatar.svg" alt="" width="36" height="36" />
  {/if}
  <div class="col">
    <div class="bubble">
      {#if typing}
        <span class="typing" role="status" aria-label="Missa tippt …">
          <span></span><span></span><span></span>
        </span>
      {:else if mine}
        <p class="plain">{message.content}</p>
      {:else}
        <!-- eslint-disable-next-line svelte/no-at-html-tags -- mit DOMPurify bereinigt -->
        <div class="md" bind:this={body} onclick={onBodyClick} role="presentation">{@html html}</div>
      {/if}
      {#if message.status === 'queued'}
        <p class="state queued-note">⏳ Wartet auf Verbindung</p>
      {/if}
      {#if message.status === 'stopped'}
        <p class="state">Abgebrochen.</p>
      {/if}
      {#if message.status === 'error'}
        <div class="state error" role="alert">
          <span>{message.error ?? 'Fehler.'}</span>
          {#if isLast}
            <button type="button" onclick={onregenerate} disabled={busy}>Nochmal</button>
          {/if}
        </div>
      {/if}
    </div>
    <div class="meta">
      <time datetime={message.createdAt} title={timeLong}>{timeShort}</time>
      {#if message.status !== 'streaming' && message.content}
        <button type="button" class="mini" onclick={copyMessage} aria-label="Nachricht kopieren">
          {copied ? 'Kopiert!' : 'Kopieren'}
        </button>
      {/if}
      {#if !mine && isLast && message.status !== 'streaming' && message.status !== 'error'}
        <button type="button" class="mini" onclick={onregenerate} disabled={busy}>Neu erzeugen</button>
      {/if}
      {#if message.status === 'queued'}
        <button type="button" class="mini" onclick={ondelete} aria-label="Wartende Nachricht löschen">
          Löschen
        </button>
      {:else if mine && isLastUser && !busy}
        <button type="button" class="mini" onclick={onedit}>Bearbeiten</button>
      {/if}
    </div>
  </div>
</li>

<style>
  .msg {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
    max-width: 100%;
  }
  .msg.mine {
    justify-content: flex-end;
  }
  .avatar {
    flex: none;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 50%;
    margin-top: 0.15rem;
  }
  .col {
    display: flex;
    flex-direction: column;
    min-width: 0;
    max-width: min(85%, 42rem);
  }
  .mine .col {
    align-items: flex-end;
  }
  .bubble {
    padding: 0.6rem 0.9rem;
    border-radius: 1.1rem 1.1rem 1.1rem 0.3rem;
    background: var(--bubble-missa);
    color: var(--text);
    overflow-wrap: anywhere;
    min-width: 0;
    max-width: 100%;
  }
  .mine .bubble {
    border-radius: 1.1rem 1.1rem 0.3rem 1.1rem;
    background: var(--bubble-me);
    color: var(--bubble-me-text);
  }
  [data-status='queued'] .bubble {
    background: transparent;
    color: var(--text);
    border: 2px dashed var(--bubble-me);
  }
  .queued-note {
    color: var(--muted);
  }
  .plain {
    margin: 0;
    white-space: pre-wrap;
  }
  .state {
    margin: 0.4rem 0 0;
    font-size: 0.875rem;
    color: var(--muted);
    font-style: italic;
  }
  .state.error {
    color: var(--danger);
    font-style: normal;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  .state.error button {
    min-height: 2.25rem;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.6rem;
    align-items: center;
    font-size: 0.8rem;
    color: var(--muted);
    padding: 0.2rem 0.4rem;
  }
  .mini {
    min-height: 1.75rem;
    padding: 0 0.4rem;
    font-size: 0.8rem;
    background: none;
    border: none;
    color: var(--muted);
    text-decoration: underline;
  }
  .mini:hover {
    color: var(--text);
  }
  .typing {
    display: inline-flex;
    gap: 0.3rem;
    padding: 0.35rem 0;
  }
  .typing span {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--muted);
    animation: blink 1.2s infinite ease-in-out;
  }
  .typing span:nth-child(2) {
    animation-delay: 0.2s;
  }
  .typing span:nth-child(3) {
    animation-delay: 0.4s;
  }
  @keyframes blink {
    0%,
    80%,
    100% {
      opacity: 0.25;
      transform: translateY(0);
    }
    40% {
      opacity: 1;
      transform: translateY(-0.2rem);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .typing span {
      animation: none;
      opacity: 0.6;
    }
  }
</style>
