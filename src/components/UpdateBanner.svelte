<script lang="ts">
  import { onMount } from 'svelte';

  let needRefresh = $state(false);
  let busy = $state(false);
  let update: ((reload?: boolean) => Promise<void>) | null = null;

  onMount(() => {
    if (!('serviceWorker' in navigator)) return;
    // Erst zur Laufzeit laden: das Modul gibt es nur im Build mit vite-plugin-pwa.
    void import('virtual:pwa-register').then(({ registerSW }) => {
      update = registerSW({
        immediate: true,
        onNeedRefresh() {
          needRefresh = true;
        },
        onRegisteredSW(_url, reg) {
          // Ab und zu nach einer neuen Version schauen (z. B. wenn die App lange offen ist).
          if (reg) setInterval(() => void reg.update().catch(() => {}), 60 * 60 * 1000);
        },
      });
    });
  });

  async function reload() {
    busy = true;
    // Neu laden, sobald der neue Service Worker die Seite übernimmt (egal auf welchem Weg
    // das Update gefunden wurde). Falls nichts passiert: nach 3 s trotzdem neu laden.
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', go, { once: true });
    setTimeout(go, 3000);
    await update?.(true);
  }
</script>

{#if needRefresh}
  <div class="update" role="alert">
    <span>Neue Version verfügbar</span>
    <button type="button" class="primary" onclick={reload} disabled={busy}>Neu laden</button>
    <button type="button" onclick={() => (needRefresh = false)} aria-label="Später">Später</button>
  </div>
{/if}

<style>
  .update {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    top: 0.75rem;
    z-index: 10;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--surface);
    box-shadow: 0 4px 16px rgb(0 0 0 / 0.2);
    max-width: calc(100vw - 2rem);
  }
  .update span {
    font-weight: 600;
  }
</style>
