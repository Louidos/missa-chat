<script lang="ts">
  import { onMount } from 'svelte';
  import ConnectForm from './components/ConnectForm.svelte';
  import ChatView from './components/ChatView.svelte';
  import SettingsView from './components/SettingsView.svelte';
  import UnlockView from './components/UnlockView.svelte';
  import UpdateBanner from './components/UpdateBanner.svelte';
  import { avatar } from './lib/avatar.svelte';
  import { prefs } from './lib/prefs.svelte';
  import { session } from './lib/session.svelte';

  let view = $state<'home' | 'settings'>('home');
  let notice = $state('');
  let loadError = $state('');

  onMount(() => {
    session.onLogout(() => {
      prefs.reset();
      avatar.reset();
    });
    void prefs.load().catch(() => {});
    void avatar.load().catch(() => {});
    session.init().catch(() => {
      loadError =
        'Die lokalen Daten konnten nicht geladen werden. Ist privates Surfen aktiv oder der Speicher voll?';
    });
  });
</script>

<UpdateBanner />

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
  <ChatView {notice} onsettings={() => ((notice = ''), (view = 'settings'))} />
{/if}
