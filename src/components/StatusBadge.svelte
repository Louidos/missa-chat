<script lang="ts">
  import { session } from '../lib/session.svelte';

  const kindLabel = $derived(session.activeKind === 'internal' ? 'Heimnetz' : 'extern');
</script>

<div class="status" role="status" aria-live="polite" data-status={session.link}>
  <span class="dot" aria-hidden="true"></span>
  {#if session.link === 'checking'}
    Verbinde …
  {:else if session.link === 'connected'}
    <span>Verbunden · <strong>{session.connection?.model}</strong> · {kindLabel}</span>
  {:else if session.link === 'error'}
    Nicht verbunden
  {:else}
    Unbekannt
  {/if}
</div>

<style>
  .status {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.9rem;
    padding: 0.3rem 0.7rem;
    border-radius: 999px;
    background: var(--surface-2);
    justify-self: start;
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
  [data-status='error'] .dot {
    background: var(--danger);
  }
  [data-status='checking'] .dot {
    background: var(--warn);
  }
</style>
