<script lang="ts">
  import { commandStore } from '../lib/commandStore.svelte';
  import { validateCommand, type Command } from '../lib/commands';

  let name = $state('');
  let text = $state('');
  let description = $state('');
  let editingName = $state<string | null>(null);
  let error = $state('');
  let saved = $state('');

  function edit(c: Command) {
    editingName = c.name;
    name = c.name;
    text = c.text ?? '';
    description = c.description;
    error = '';
    saved = '';
  }

  function resetForm() {
    editingName = null;
    name = '';
    text = '';
    description = '';
    error = '';
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    const list = commandStore.list;
    const original = editingName ? list.find((c) => c.name === editingName) : undefined;
    const cmd: Command = {
      name: name.trim().replace(/^\//, '').toLowerCase(),
      description: description.trim() || text.trim(),
      ...(original?.action ? { action: original.action } : { text: text.trim() }),
      ...(text.includes('{text}') ? { placeholder: original?.placeholder ?? '<Text>' } : {}),
    };
    const err = validateCommand(cmd, list, editingName ?? undefined);
    if (err) {
      error = err;
      return;
    }
    const next = editingName ? list.map((c) => (c.name === editingName ? cmd : c)) : [...list, cmd];
    await commandStore.save(next);
    saved = editingName ? `/${cmd.name} gespeichert.` : `/${cmd.name} angelegt.`;
    resetForm();
  }

  async function remove(c: Command) {
    await commandStore.save(commandStore.list.filter((x) => x.name !== c.name));
    if (editingName === c.name) resetForm();
  }
</script>

<section class="card">
  <h2>Schnellbefehle</h2>
  <p class="muted">
    Tippe <code>/</code> im Eingabefeld. Jeder Befehl wird als normale Nachricht an Missa gesendet;
    <code>{'{text}'}</code> wird durch das ersetzt, was nach dem Befehl steht.
  </p>
  <ul class="cmds">
    {#each commandStore.list as c (c.name)}
      <li>
        <div class="info">
          <strong>/{c.name}</strong>
          <span class="muted">{c.action ? 'Neues Gespräch beginnen' : c.text}</span>
        </div>
        <button type="button" class="mini" onclick={() => edit(c)} aria-label="/{c.name} bearbeiten">Bearbeiten</button>
        <button type="button" class="mini" onclick={() => remove(c)} aria-label="/{c.name} löschen">Löschen</button>
      </li>
    {/each}
  </ul>

  <form onsubmit={submit} class="form">
    <h3>{editingName ? `/${editingName} bearbeiten` : 'Eigenen Befehl anlegen'}</h3>
    <div class="field">
      <label for="cmd-name">Name (ohne /)</label>
      <input id="cmd-name" type="text" bind:value={name} placeholder="z. B. wetter" autocapitalize="off" />
    </div>
    {#if !(editingName && commandStore.list.find((c) => c.name === editingName)?.action)}
      <div class="field">
        <label for="cmd-text">Text, der gesendet wird</label>
        <input id="cmd-text" type="text" bind:value={text} placeholder="z. B. Wie wird das Wetter morgen?" />
      </div>
    {/if}
    <div class="field">
      <label for="cmd-desc">Beschreibung (optional)</label>
      <input id="cmd-desc" type="text" bind:value={description} />
    </div>
    {#if error}<p class="alert" role="alert">{error}</p>{/if}
    {#if saved}<p role="status">{saved}</p>{/if}
    <div class="row">
      <button type="submit" class="primary">{editingName ? 'Speichern' : 'Befehl anlegen'}</button>
      {#if editingName}<button type="button" onclick={resetForm}>Abbrechen</button>{/if}
      {#if !commandStore.isDefault}
        <button type="button" onclick={() => commandStore.resetDefaults()}>Standard wiederherstellen</button>
      {/if}
    </div>
  </form>
</section>

<style>
  .cmds {
    list-style: none;
    padding: 0;
    margin: 0 0 1rem;
    display: grid;
    gap: 0.25rem;
  }
  .cmds li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0;
    border-bottom: 1px solid var(--border);
  }
  .info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .info .muted {
    overflow-wrap: anywhere;
    font-size: 0.9rem;
  }
  .mini {
    min-height: 2.25rem;
    padding: 0 0.5rem;
    background: none;
    border: none;
    text-decoration: underline;
    color: var(--muted);
  }
  .form {
    display: grid;
    gap: 0.75rem;
  }
  h3 {
    margin: 0;
    font-size: 1rem;
  }
  .row {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
</style>
