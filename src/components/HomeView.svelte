<script lang="ts">
  import { session } from '../lib/session.svelte';
  import StatusBadge from './StatusBadge.svelte';

  interface Props {
    notice?: string;
    onsettings: () => void;
  }
  let { notice = '', onsettings }: Props = $props();
</script>

<header class="topbar">
  <h1>Missa</h1>
  <div class="actions">
    {#if session.hasPin}
      <button type="button" onclick={() => session.lock()}>Sperren</button>
    {/if}
    <button type="button" onclick={onsettings}>Einstellungen</button>
  </div>
</header>

<main class="content">
  <StatusBadge />
  {#if notice}<p class="notice" role="note">{notice}</p>{/if}
  {#if session.link === 'error'}
    <div class="alert" role="alert">
      <p>{session.linkMessage}</p>
      <button type="button" onclick={() => session.refreshLink()}>Nochmal versuchen</button>
    </div>
  {/if}
  <p class="muted placeholder">Das Chat-Fenster kommt in der nächsten Version.</p>
</main>
