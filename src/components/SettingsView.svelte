<script lang="ts">
  import { session } from '../lib/session.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import ConnectForm from './ConnectForm.svelte';

  interface Props {
    onclose: (notice?: string) => void;
  }
  let { onclose }: Props = $props();
  let confirmLogout = $state(false);
</script>

<header class="topbar">
  <button type="button" onclick={() => onclose()}>← Zurück</button>
  <h1>Einstellungen</h1>
</header>

<main class="content">
  <section class="card">
    <h2>Verbindung</h2>
    <ConnectForm mode="edit" ondone={(r) => onclose(r.warning ?? `Gespeichert. Verbunden mit ${r.model}.`)} />
  </section>

  {#if session.connection && session.connection.models.length > 1}
    <section class="card">
      <h2>Modell</h2>
      <div class="field">
        <label for="model">Modell für neue Nachrichten</label>
        <select
          id="model"
          value={session.connection.model}
          onchange={(e) => session.selectModel(e.currentTarget.value)}
        >
          {#each session.connection.models as m (m)}
            <option value={m}>{m}</option>
          {/each}
        </select>
      </div>
    </section>
  {/if}

  <section class="card">
    <h2>Abmelden</h2>
    <p class="muted">Löscht Key, Einstellungen und den ganzen Verlauf auf diesem Gerät.</p>
    <button type="button" class="danger" onclick={() => (confirmLogout = true)}>Abmelden …</button>
  </section>
</main>

<ConfirmDialog
  bind:open={confirmLogout}
  title="Wirklich abmelden?"
  message="Key, Einstellungen und der ganze Verlauf auf diesem Gerät werden gelöscht. Das lässt sich nicht rückgängig machen."
  confirmLabel="Alles löschen"
  danger
  onconfirm={async () => {
    await session.logout();
    onclose();
  }}
/>
