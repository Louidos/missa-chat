<script lang="ts">
  import { onMount } from 'svelte';
  import { chat } from '../lib/chat.svelte';
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
      <h1>Missa</h1>
      <StatusBadge />
    </div>
    <div class="actions">
      {#if session.hasPin}
        <button type="button" onclick={() => session.lock()}>Sperren</button>
      {/if}
      <button type="button" onclick={onsettings}>Einstellungen</button>
    </div>
  </header>

  {#if notice}<p class="notice" role="note">{notice}</p>{/if}
  {#if loadError}<p class="alert" role="alert">{loadError}</p>{/if}
  {#if session.link === 'error' && !chat.streaming}
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
