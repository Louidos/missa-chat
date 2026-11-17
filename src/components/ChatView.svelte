<script lang="ts">
  import { onMount } from 'svelte';
  import { avatar } from '../lib/avatar.svelte';
  import { chat } from '../lib/chat.svelte';
  import { commandStore } from '../lib/commandStore.svelte';
  import { EMERGENCY_TEXT, expand, parseCommand } from '../lib/commands';
  import { network } from '../lib/network.svelte';
  import { session } from '../lib/session.svelte';
  import Composer from './Composer.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import QuickBar from './QuickBar.svelte';
  import MessageList from './MessageList.svelte';
  import SearchDialog from './SearchDialog.svelte';
  import Sidebar from './Sidebar.svelte';
  import StatusBadge from './StatusBadge.svelte';

  interface Props {
    notice?: string;
    onsettings: () => void;
  }
  let { notice = '', onsettings }: Props = $props();

  let draft = $state('');
  let editing = $state(false);
  let composer: Composer | undefined = $state();
  let loadError = $state('');
  let drawer = $state(false);
  let commandHint = $state('');
  let confirmEmergency = $state(false);
  let emergency = $state<{ state: 'sending' | 'done' | 'error' | 'queued'; text: string } | null>(null);
  let searchOpen = $state(false);

  onMount(() => {
    if (!chat.loaded) {
      chat.load().catch(() => (loadError = 'Der Verlauf konnte nicht geladen werden.'));
    }
    composer?.focus();
  });

  /** Sendet Text oder führt einen Slash-Befehl aus. */
  function sendText(input: string) {
    commandHint = '';
    let text = input;
    const parsed = parseCommand(input, commandStore.list);
    if (parsed) {
      const { command, args } = parsed;
      if (command.action === 'neues-gespraech') {
        void commandStore.recordUse(command.name);
        void chat.startNew();
        return;
      }
      const expanded = expand(command, args);
      if (!expanded) {
        draft = `/${command.name} `;
        commandHint = `/${command.name} braucht noch etwas dahinter: ${command.placeholder ?? 'Text'}`;
        composer?.focus();
        return;
      }
      void commandStore.recordUse(command.name);
      text = expanded;
    }
    void chat.send(text);
  }

  function submit() {
    const text = draft;
    draft = '';
    if (editing) {
      editing = false;
      void chat.editLast(text);
    } else {
      sendText(text);
    }
  }

  async function sendEmergency() {
    // Laufende Antwort wirklich beenden, sonst würde der Notfall-Stopp nicht gesendet.
    await chat.stopAndWait();
    emergency = { state: 'sending', text: '' };
    await chat.send(EMERGENCY_TEXT);
    const last = chat.messages.at(-1);
    if (last?.role === 'user' && last.status === 'queued') {
      emergency = {
        state: 'queued',
        text: 'Keine Verbindung! Der Notfall-Stopp wartet und geht raus, sobald die Verbindung steht.',
      };
    } else if (last?.role === 'assistant' && last.status === 'done') {
      emergency = { state: 'done', text: last.content };
    } else {
      emergency = { state: 'error', text: last?.error ?? 'Der Notfall-Stopp konnte nicht bestätigt werden.' };
    }
  }

  function startEdit() {
    const msg = chat.messages[chat.lastUserIndex];
    if (!msg || chat.streaming) return;
    draft = msg.content;
    editing = true;
    composer?.focus();
  }

  function cancelEdit() {
    editing = false;
    draft = '';
  }

  function onkeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      searchOpen = true;
      return;
    }
    if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
    if (drawer) {
      e.preventDefault();
      drawer = false;
    } else if (chat.streaming) {
      e.preventDefault();
      chat.stop();
    } else if (editing) {
      e.preventDefault();
      cancelEdit();
    }
  }
</script>

<svelte:window {onkeydown} />

<div class="layout" class:drawer-open={drawer}>
<aside id="sidebar" class="side">
  <Sidebar onpicked={() => (drawer = false)} onsearch={() => ((drawer = false), (searchOpen = true))} />
</aside>
{#if drawer}
  <button type="button" class="scrim" aria-label="Gesprächsliste schliessen" onclick={() => (drawer = false)}></button>
{/if}
<div class="chat">
  <header class="topbar">
    <button
      type="button"
      class="icon menu-btn"
      aria-label="Gespräche"
      aria-controls="sidebar"
      aria-expanded={drawer}
      onclick={() => (drawer = !drawer)}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
    </button>
    <div class="title">
      <img class="head-avatar" src={avatar.url} alt="" width="36" height="36" />
      <div class="name">
        <h1>Missa</h1>
        <StatusBadge />
      </div>
    </div>
    <div class="actions">
      <button
        type="button"
        class="icon emergency"
        onclick={() => (confirmEmergency = true)}
        aria-label="Notfall-Stopp"
        title="Notfall-Stopp"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 2h8l6 6v8l-6 6H8l-6-6V8z" /><path d="M12 7v6M12 16.5v.5" /></svg>
      </button>
      {#if session.hasPin}
        <button type="button" class="icon" onclick={() => session.lock()} aria-label="Sperren" title="Sperren">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>
        </button>
      {/if}
      <button type="button" class="icon" onclick={onsettings} aria-label="Einstellungen" title="Einstellungen">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>
      </button>
    </div>
  </header>

  {#if notice}<p class="notice" role="note">{notice}</p>{/if}
  {#if loadError}<p class="alert" role="alert">{loadError}</p>{/if}
  {#if !network.online}
    <p class="notice offline" role="note">
      Du bist offline. Neue Nachrichten warten und gehen raus, sobald die Verbindung zurück ist.
    </p>
  {:else if session.link === 'error' && !chat.streaming}
    <div class="alert linkerror" role="alert">
      <span>{session.linkMessage}</span>
      <button type="button" onclick={() => session.refreshLink()}>Nochmal versuchen</button>
    </div>
  {/if}

  {#if emergency}
    <div class="emergency-result" role="alert" data-state={emergency.state}>
      <strong>
        {#if emergency.state === 'sending'}Notfall-Stopp wird gesendet …{:else if emergency.state === 'done'}Notfall-Stopp gesendet – Missa antwortet:{:else if emergency.state === 'queued'}Notfall-Stopp wartet!{:else}Notfall-Stopp: Fehler{/if}
      </strong>
      {#if emergency.text}<p>{emergency.text}</p>{/if}
      {#if emergency.state !== 'sending'}
        <button type="button" onclick={() => (emergency = null)}>Schliessen</button>
      {/if}
    </div>
  {/if}

  <MessageList onedit={startEdit} />

  {#if commandHint}<p class="command-hint" role="status">{commandHint}</p>{/if}
  <QuickBar {draft} onsend={(t) => sendText(t)} onfill={(t) => ((draft = t), composer?.focus())} />

  <Composer
    bind:this={composer}
    bind:value={draft}
    streaming={chat.streaming}
    {editing}
    disabled={!chat.loaded}
    onsubmit={submit}
    onstop={() => chat.stop()}
    oncanceledit={cancelEdit}
  />
</div>
</div>

<SearchDialog bind:open={searchOpen} />

<ConfirmDialog
  bind:open={confirmEmergency}
  title="Notfall-Stopp senden?"
  message={`Missa bekommt sofort die Nachricht „${EMERGENCY_TEXT}“ und soll alles anhalten, was gerade läuft.`}
  confirmLabel="Ja, Notfall-Stopp senden"
  danger
  onconfirm={sendEmergency}
/>

<style>
  .layout {
    display: grid;
    grid-template-columns: 1fr;
    height: 100vh;
    height: 100dvh;
  }
  .side {
    position: fixed;
    inset: 0 auto 0 0;
    width: min(85vw, 20rem);
    z-index: 20;
    background: var(--surface);
    box-shadow: var(--shadow-soft);
    transform: translateX(-105%);
    visibility: hidden;
    transition:
      transform 0.2s ease,
      visibility 0.2s;
  }
  .drawer-open .side {
    transform: none;
    visibility: visible;
  }
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 15;
    background: rgb(0 0 0 / 0.4);
    border: none;
    border-radius: 0;
  }
  @media (min-width: 900px) {
    .layout {
      grid-template-columns: 17rem 1fr;
      gap: 1rem;
    }
    .side {
      position: static;
      width: auto;
      transform: none;
      visibility: visible;
      box-shadow: none;
      background: none;
      border-right: 1px solid var(--border);
      height: 100dvh;
    }
    .menu-btn,
    .scrim {
      display: none;
    }
  }
  .chat {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100vh;
    height: 100dvh;
    width: 100%;
    max-width: 48rem;
    margin: 0 auto;
    min-width: 0;
  }
  .topbar {
    padding-top: 0.75rem;
    margin-bottom: 0.25rem;
    flex-wrap: nowrap;
  }
  .title {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-width: 0;
    flex: 1;
  }
  .actions {
    flex: none;
  }
  .head-avatar {
    flex: none;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    object-fit: cover;
  }
  .name {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 0.1rem;
  }
  .name h1 {
    font-size: 1.2rem;
    margin: 0;
    line-height: 1.2;
  }
  .linkerror {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }
  .notice {
    margin: 0 0 0.5rem;
  }
  .emergency {
    background: var(--danger);
    color: var(--surface);
    border-color: transparent;
  }
  .emergency-result {
    border: 3px solid var(--danger);
    border-radius: var(--radius);
    background: var(--surface);
    padding: 0.75rem 1rem;
    margin-bottom: 0.5rem;
  }
  .emergency-result strong {
    color: var(--danger);
    font-size: 1.1rem;
  }
  .emergency-result p {
    margin: 0.4rem 0;
    white-space: pre-wrap;
  }
  .command-hint {
    margin: 0.25rem 0 0;
    font-size: 0.875rem;
    color: var(--muted);
  }
</style>
