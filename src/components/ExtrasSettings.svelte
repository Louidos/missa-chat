<script lang="ts">
  import { IS_DESKTOP } from '../lib/platform';
  import { prefs } from '../lib/prefs.svelte';
  import { speech } from '../lib/speech.svelte';
  import ShortcutsDialog from './ShortcutsDialog.svelte';

  let notifyError = $state('');
  let shortcutsOpen = $state(false);
  const notifySupported = typeof Notification !== 'undefined';

  async function toggleNotify(e: Event) {
    // Element vorher merken: nach einem await ist e.currentTarget null.
    const box = e.currentTarget as HTMLInputElement;
    const on = box.checked;
    notifyError = '';
    if (!on) {
      await prefs.update({ notify: false });
      return;
    }
    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    if (permission !== 'granted') {
      box.checked = false;
      notifyError = IS_DESKTOP
        ? 'Windows hat Benachrichtigungen nicht erlaubt. Das lässt sich unter Einstellungen → System → Benachrichtigungen ändern.'
        : 'Der Browser hat Benachrichtigungen nicht erlaubt. Das lässt sich in den Website-Einstellungen ändern.';
      await prefs.update({ notify: false });
      return;
    }
    await prefs.update({ notify: true });
  }
</script>

<section class="card">
  <h2>Vorlesen</h2>
  {#if speech.available}
    <p class="muted">Nur Stimmen, die direkt auf diesem Gerät laufen – der Text geht nicht ins Internet.</p>
    <div class="field">
      <label for="tts-voice">Stimme</label>
      <select
        id="tts-voice"
        value={prefs.value.ttsVoice ?? speech.voices[0]?.voiceURI}
        onchange={(e) => prefs.update({ ttsVoice: e.currentTarget.value })}
      >
        {#each speech.voices as v (v.voiceURI)}
          <option value={v.voiceURI}>{v.name} ({v.lang})</option>
        {/each}
      </select>
    </div>
    <label class="check">
      <input type="checkbox" checked={prefs.value.ttsAuto} onchange={(e) => prefs.update({ ttsAuto: e.currentTarget.checked })} />
      Antworten automatisch vorlesen
    </label>
    <button type="button" onclick={() => speech.speak('probe', 'Hallo Louis, so klinge ich.')}>Probe hören</button>
  {:else}
    <p class="hint" role="note">
      Keine lokale deutsche Stimme gefunden – Vorlesen ist ausgeblendet. Online-Stimmen werden absichtlich nicht
      benutzt, weil sie den Text an einen Cloud-Dienst schicken. Tipp: Im Betriebssystem eine deutsche Stimme
      installieren (Windows: Einstellungen → Zeit und Sprache → Sprache; Android: Text-in-Sprache).
    </p>
  {/if}
</section>

<section class="card">
  <h2>Benachrichtigungen</h2>
  {#if notifySupported}
    <label class="check">
      <input type="checkbox" checked={prefs.value.notify} onchange={toggleNotify} />
      Benachrichtigen, wenn eine Antwort fertig wird, während die App im Hintergrund ist
    </label>
    <label class="check">
      <input
        type="checkbox"
        checked={prefs.value.notifyPreview}
        disabled={!prefs.value.notify}
        onchange={(e) => prefs.update({ notifyPreview: e.currentTarget.checked })}
      />
      Anfang der Antwort in der Benachrichtigung zeigen (sichtbar auf dem Sperrbildschirm)
    </label>
    {#if notifyError}<p class="alert" role="alert">{notifyError}</p>{/if}
  {:else}
    <p class="hint">Dieser Browser unterstützt keine Benachrichtigungen.</p>
  {/if}
</section>

<section class="card">
  <h2>Für Neugierige</h2>
  <label class="check">
    <input type="checkbox" checked={prefs.value.nerdStats} onchange={(e) => prefs.update({ nerdStats: e.currentTarget.checked })} />
    Nerd-Statistik unter Missas Antworten (Antwortzeit, Tokens/s, Modell, Adresse)
  </label>
  <button type="button" onclick={() => (shortcutsOpen = true)}>Tastenkürzel anzeigen</button>
</section>

<ShortcutsDialog bind:open={shortcutsOpen} />

<style>
  .check {
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
    margin: 0.5rem 0 0.75rem;
  }
  .check input {
    width: 1.2rem;
    height: 1.2rem;
    margin: 0.15rem 0 0;
    flex: none;
  }
  .field {
    margin-bottom: 0.5rem;
  }
</style>
