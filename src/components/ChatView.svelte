<script lang="ts">
  import { onMount } from 'svelte';
  import { avatar } from '../lib/avatar.svelte';
  import { chat } from '../lib/chat.svelte';
  import { network } from '../lib/network.svelte';
  import { session } from '../lib/session.svelte';
  import Composer from './Composer.svelte';
  import MessageList from './MessageList.svelte';
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

  onMount(() => {
    if (!chat.loaded) {
      chat.load().catch(() => (loadError = 'Der Verlauf konnte nicht geladen werden.'));
    }
    composer?.focus();
  });

  function submit() {
    const text = draft;
    draft = '';
    if (editing) {
      editing = false;
      void chat.editLast(text);
    } else {
      void chat.send(text);
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
    if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
    if (chat.streaming) {
      e.preventDefault();
      chat.stop();
    } else if (editing) {
      e.preventDefault();
      cancelEdit();
    }
  }
</script>

<svelte:window {onkeydown} />

<div class="chat">
  <header class="topbar">
    <div class="title">
      <img class="head-avatar" src={avatar.url} alt="" width="36" height="36" />
      <div class="name">
        <h1>Missa</h1>
        <StatusBadge />
      </div>
    </div>
    <div class="actions">
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

  <MessageList onedit={startEdit} />

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

<style>
  .chat {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100vh;
    height: 100dvh;
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
</style>
