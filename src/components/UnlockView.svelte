<script lang="ts">
  import { session } from '../lib/session.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import PasswordField from './PasswordField.svelte';

  let pin = $state('');
  let error = $state('');
  let busy = $state(false);
  let confirmLogout = $state(false);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (busy || !pin) return;
    busy = true;
    error = '';
    try {
      const r = await session.unlock(pin);
      if (!r.ok) error = r.message;
    } finally {
      pin = '';
      busy = false;
    }
  }
</script>

<section class="card">
  <h1>Missa ist gesperrt</h1>
  <p class="muted">Bitte PIN eingeben, um den Key zu entschlüsseln.</p>
  <form onsubmit={submit}>
    <PasswordField id="unlock-pin" label="PIN" bind:value={pin} autocomplete="current-password" invalid={!!error} />
    {#if error}<p class="alert" role="alert">{error}</p>{/if}
    <button type="submit" class="primary wide" disabled={busy || !pin}>
      {busy ? 'Entsperre …' : 'Entsperren'}
    </button>
  </form>
  <button type="button" class="link" onclick={() => (confirmLogout = true)}>PIN vergessen? Abmelden …</button>
</section>

<ConfirmDialog
  bind:open={confirmLogout}
  title="Abmelden?"
  message="Key, Einstellungen und der ganze Verlauf auf diesem Gerät werden gelöscht. Danach musst du dich neu verbinden."
  confirmLabel="Alles löschen"
  danger
  onconfirm={() => session.logout()}
/>

<style>
  form {
    display: grid;
    gap: 1rem;
    margin-bottom: 1rem;
  }
</style>
