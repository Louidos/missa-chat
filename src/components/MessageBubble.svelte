<script lang="ts">
  import { avatar } from '../lib/avatar.svelte';
  import { copyText } from '../lib/clipboard';
  import { renderMarkdown } from '../lib/markdown';
  import { fold, splitMatches } from '../lib/search';
  import { formatSize } from '../lib/attachments';
  import { prefs } from '../lib/prefs.svelte';
  import { speech } from '../lib/speech.svelte';
  import { formatStats } from '../lib/stats';
  import type { ChatMessage } from '../lib/storage/conversations';

  interface Props {
    message: ChatMessage;
    isLast: boolean;
    isLastUser: boolean;
    busy: boolean;
    onregenerate: () => void;
    onedit: () => void;
    ondelete: () => void;
    /** Suchbegriff, der hervorgehoben wird. */
    highlight?: string;
  }
  let { message, isLast, isLastUser, busy, onregenerate, onedit, ondelete, highlight = '' }: Props =
    $props();
  const userParts = $derived(splitMatches(message.content, highlight));

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

  // Suchtreffer in Missas (bereits bereinigtem) Text hervorheben – nur Textknoten.
  $effect(() => {
    void html;
    const q = fold(highlight.trim());
    if (!body || q.length < 2) return;
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    for (const node of nodes) {
      const parts = splitMatches(node.data, highlight);
      if (!parts.some((p) => p.mark)) continue;
      const frag = document.createDocumentFragment();
      for (const p of parts) {
        if (p.mark) {
          const m = document.createElement('mark');
          m.textContent = p.text;
          frag.append(m);
        } else frag.append(p.text);
      }
      node.replaceWith(frag);
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

<li class="msg" class:mine id="msg-{message.id}" data-role={message.role} data-status={message.status}>
  {#if !mine}
    <img
      class="avatar"
      class:breathing={message.status === 'streaming'}
      src={avatar.url}
      alt=""
      width="36"
      height="36"
    />
  {/if}
  <div class="col">
    <div class="bubble">
      {#if typing}
        <span class="typing" role="status" aria-label="Missa tippt …">
          <span></span><span></span><span></span>
        </span>
      {:else if mine}
        {#if message.attachments?.length}
          <div class="atts">
            {#each message.attachments as a, i (i)}
              {#if a.kind === 'image'}
                <img class="att-img" src={a.dataUrl} alt={a.name} width={a.width} height={a.height} />
              {:else}
                <span class="att-file">📎 {a.name} · {formatSize(a.size)}</span>
              {/if}
            {/each}
          </div>
        {/if}
        <p class="plain">{#each userParts as part, i (i)}{#if part.mark}<mark>{part.text}</mark>{:else}{part.text}{/if}{/each}</p>
      {:else}
        <!-- eslint-disable-next-line svelte/no-at-html-tags -- mit DOMPurify bereinigt -->
        <div class="md" bind:this={body} onclick={onBodyClick} role="presentation">{@html html}</div>
      {/if}
      {#if message.notice}
        <p class="state notice-note">{message.notice}</p>
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
      {#if !mine && speech.available && message.status !== 'streaming' && message.content}
        {#if speech.speakingId === message.id}
          <button type="button" class="mini" onclick={() => speech.stop()}>Vorlesen stoppen</button>
        {:else}
          <button type="button" class="mini" onclick={() => speech.speak(message.id, message.content)}>Vorlesen</button>
        {/if}
      {/if}
      {#if !mine && isLast && message.status !== 'streaming' && message.status !== 'error'}
        <button type="button" class="mini" onclick={onregenerate} disabled={busy}>Neu erzeugen</button>
      {/if}
      {#if message.notice}
        <p class="state notice-note">{message.notice}</p>
      {/if}
      {#if message.status === 'queued'}
        <button type="button" class="mini" onclick={ondelete} aria-label="Wartende Nachricht löschen">
          Löschen
        </button>
      {:else if mine && isLastUser && !busy}
        <button type="button" class="mini" onclick={onedit}>Bearbeiten</button>
      {/if}
    </div>
    {#if !mine && prefs.value.nerdStats && message.stats}
      <p class="stats" aria-label="Statistik zur Antwort">
        {#each formatStats(message.stats) as part, i (i)}<span>{part}</span>{/each}
      </p>
    {/if}
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
    object-fit: cover;
    margin-top: 0.15rem;
    box-shadow: 0 0 0 2px var(--surface);
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
    padding: 0.65rem 0.95rem;
    border-radius: 1.3rem 1.3rem 1.3rem 0.4rem;
    background: var(--bubble-missa);
    box-shadow: var(--shadow-soft);
    color: var(--text);
    overflow-wrap: anywhere;
    min-width: 0;
    max-width: 100%;
  }
  .mine .bubble {
    border-radius: 1.3rem 1.3rem 0.4rem 1.3rem;
    background: var(--bubble-me);
    color: var(--bubble-me-text);
  }
  .atts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 0.4rem;
  }
  .att-img {
    max-width: min(16rem, 100%);
    max-height: 12rem;
    width: auto;
    height: auto;
    border-radius: 0.7rem;
    display: block;
  }
  .att-file {
    display: inline-block;
    padding: 0.2rem 0.5rem;
    border-radius: 0.6rem;
    background: rgb(255 255 255 / 0.18);
    font-size: 0.9rem;
  }
  .notice-note {
    color: inherit;
    opacity: 0.95;
  }
  .plain:empty {
    display: none;
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
  .stats {
    margin: 0 0.4rem;
    font-size: 0.75rem;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    display: flex;
    flex-wrap: wrap;
    gap: 0 0.6rem;
  }
  .stats span + span::before {
    content: '·';
    margin-right: 0.6rem;
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
