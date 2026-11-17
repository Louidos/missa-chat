<script lang="ts">
  import { avatar } from '../lib/avatar.svelte';
  import { prefs, type ThemeChoice } from '../lib/prefs.svelte';

  const themes: Array<{ value: ThemeChoice; label: string }> = [
    { value: 'auto', label: 'Automatisch (wie das System)' },
    { value: 'light', label: 'Hell' },
    { value: 'dark', label: 'Dunkel' },
  ];

  let avatarError = $state('');
  let busy = $state(false);

  async function onFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    avatarError = '';
    busy = true;
    try {
      await avatar.set(file);
    } catch {
      avatarError = 'Das Bild konnte nicht gelesen werden. Bitte ein anderes probieren (PNG, JPG, WebP).';
    } finally {
      busy = false;
    }
  }
</script>

<section class="card">
  <h2>Darstellung</h2>
  <fieldset>
    <legend>Farbmodus</legend>
    {#each themes as t (t.value)}
      <label class="radio">
        <input
          type="radio"
          name="theme"
          value={t.value}
          checked={prefs.value.theme === t.value}
          onchange={() => prefs.update({ theme: t.value })}
        />
        {t.label}
      </label>
    {/each}
  </fieldset>

  <div class="avatar-row">
    <img class="preview" src={avatar.url} alt="Aktueller Avatar von Missa" width="72" height="72" />
    <div class="avatar-actions">
      <span class="label">Avatar von Missa</span>
      <label class="button-like">
        <input type="file" accept="image/*" class="sr-only" onchange={onFile} disabled={busy} />
        {busy ? 'Lade …' : 'Eigenes Bild wählen'}
      </label>
      {#if avatar.custom}
        <button type="button" onclick={() => avatar.clear()}>Standard-Avatar</button>
      {/if}
      <p class="hint">Bleibt nur auf diesem Gerät und wird auf 256 px verkleinert.</p>
      {#if avatarError}<p class="alert" role="alert">{avatarError}</p>{/if}
    </div>
  </div>
</section>

<style>
  fieldset {
    border: none;
    padding: 0;
    margin: 0 0 1rem;
    display: grid;
    gap: 0.4rem;
  }
  legend {
    font-weight: 600;
    margin-bottom: 0.4rem;
  }
  .radio {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 2.25rem;
  }
  .radio input {
    width: 1.2rem;
    height: 1.2rem;
    margin: 0;
  }
  .avatar-row {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .preview {
    width: 4.5rem;
    height: 4.5rem;
    border-radius: 50%;
    object-fit: cover;
    box-shadow: var(--shadow-soft);
  }
  .avatar-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    flex: 1;
    min-width: 12rem;
  }
  .label {
    font-weight: 600;
    width: 100%;
  }
  .button-like {
    display: inline-flex;
    align-items: center;
    min-height: 2.75rem;
    padding: 0.4rem 1rem;
    border-radius: 0.9rem;
    border: 1px solid var(--border);
    background: var(--surface-2);
    cursor: pointer;
  }
  .button-like:focus-within {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  .hint,
  .alert {
    width: 100%;
  }
</style>
