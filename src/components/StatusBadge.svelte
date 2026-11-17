<script lang="ts">
  import { chat } from '../lib/chat.svelte';
  import { network } from '../lib/network.svelte';
  import { session } from '../lib/session.svelte';

  const kindLabel = $derived(session.activeKind === 'internal' ? 'Heimnetz' : 'extern');
  const state = $derived(network.online ? session.link : 'offline');
  const waiting = $derived(chat.queued.length);
</script>

<div class="status" role="status" aria-live="polite" data-status={state}>
  <span class="dot" aria-hidden="true"></span>
  {#if state === 'offline'}
    <span>Offline{waiting ? ` · ${waiting} wartend` : ''}</span>
  {:else if session.link === 'checking'}
    <span>Verbinde …</span>
  {:else if session.link === 'connected'}
    <span>Verbunden · <strong>{session.connection?.model}</strong> · {kindLabel}</span>
  {:else if session.link === 'error'}
    <span>Server nicht erreichbar{waiting ? ` · ${waiting} wartend` : ''}</span>
  {:else}
    <span>Unbekannt</span>
  {/if}
</div>

<style>
  .status {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
    padding: 0.1rem 0.55rem;
    border-radius: 999px;
    background: var(--surface-2);
    justify-self: start;
    min-width: 0;
    max-width: 100%;
    white-space: nowrap;
  }
  .status > span:last-child {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dot {
    flex: none;
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    background: var(--muted);
  }
  [data-status='connected'] .dot {
    background: var(--ok);
  }
  [data-status='error'] .dot,
  [data-status='offline'] .dot {
    background: var(--danger);
  }
  [data-status='checking'] .dot {
    background: var(--warn);
  }
</style>
