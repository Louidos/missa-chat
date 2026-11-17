<script lang="ts">
  import { onMount } from 'svelte';
  import ConnectForm from './components/ConnectForm.svelte';
  import ChatView from './components/ChatView.svelte';
  import SettingsView from './components/SettingsView.svelte';
  import UnlockView from './components/UnlockView.svelte';
  import UpdateBanner from './components/UpdateBanner.svelte';
  import { avatar } from './lib/avatar.svelte';
  import { chat } from './lib/chat.svelte';
  import { showAnswerNotification } from './lib/notify';
  import { speech } from './lib/speech.svelte';
  import { prefs } from './lib/prefs.svelte';
  import { session } from './lib/session.svelte';

  let view = $state<'home' | 'settings'>('home');
  let notice = $state('');
  let loadError = $state('');

  onMount(() => {
    session.onLogout(() => {
      speech.stop();
      prefs.reset();
      avatar.reset();
    });
    void prefs.load().catch(() => {});
    speech.init();
    chat.onAnswer((m) => {
      if (prefs.value.ttsAuto && speech.available) speech.speak(m.id, m.content);
      void showAnswerNotification(prefs.value, m.content).catch(() => {});
    });
    void avatar.load().catch(() => {});
    session.init().catch(() => {
      loadError =
        'Die lokalen Daten konnten nicht geladen werden. Ist privates Surfen aktiv oder der Speicher voll?';
    });
  });
</script>

<UpdateBanner />

{#if loadError}
  <div class="narrow"><section class="card"><p class="alert" role="alert">{loadError}</p></section></div>
{:else if session.state === 'loading'}
  <p class="center muted" role="status">Lade …</p>
{:else if session.state === 'setup'}
  <div class="narrow">
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
  </div>
{:else if session.state === 'locked'}
  <div class="narrow"><UnlockView /></div>
{:else if view === 'settings'}
  <div class="narrow">
    <SettingsView
      onclose={(n) => {
        notice = n ?? '';
        view = 'home';
      }}
    />
  </div>
{:else}
  <ChatView {notice} onsettings={() => ((notice = ''), (view = 'settings'))} />
{/if}
