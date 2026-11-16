<script lang="ts">
  import { onMount } from 'svelte';
  import ConnectForm from './components/ConnectForm.svelte';
  import HomeView from './components/HomeView.svelte';
  import SettingsView from './components/SettingsView.svelte';
  import UnlockView from './components/UnlockView.svelte';
  import { session } from './lib/session.svelte';

  let view = $state<'home' | 'settings'>('home');
  let notice = $state('');
  let loadError = $state('');

  onMount(() => {
    session.init().catch(() => {
      loadError =
        'Die lokalen Daten konnten nicht geladen werden. Ist privates Surfen aktiv oder der Speicher voll?';
    });
  });
</script>

{#if loadError}
  <section class="card"><p class="alert" role="alert">{loadError}</p></section>
{:else if session.state === 'loading'}
  <p class="center muted" role="status">Lade …</p>
{:else if session.state === 'setup'}
  <section class="card">
    <h1>Mit Missa verbinden</h1>
    <p class="muted">Adresse und Key bleiben nur auf diesem Gerät gespeichert.</p>
    <ConnectForm
      mode="setup"
      ondone={(r) => {
        notice = r.warning ?? '';
        view = 'home';
      }}
    />
  </section>
{:else if session.state === 'locked'}
  <UnlockView />
{:else if view === 'settings'}
  <SettingsView
    onclose={(n) => {
      notice = n ?? '';
      view = 'home';
    }}
  />
{:else}
  <HomeView {notice} onsettings={() => ((notice = ''), (view = 'settings'))} />
{/if}
