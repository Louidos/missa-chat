<script lang="ts">
  import { commandStore } from '../lib/commandStore.svelte';
  import { expand, needsArgs, suggestions, type Command } from '../lib/commands';
  import { formatSize } from '../lib/attachments';
  import { TEXT_EXTENSIONS } from '../config/limits';
  import type { Attachment } from '../lib/storage/conversations';

  interface Props {
    value: string;
    streaming: boolean;
    editing: boolean;
    disabled?: boolean;
    onsubmit: () => void;
    onstop: () => void;
    oncanceledit: () => void;
    attachments?: Attachment[];
    busyFiles?: boolean;
    onfiles?: (files: File[]) => void;
    onremove?: (index: number) => void;
  }
  let {
    value = $bindable(''),
    streaming,
    editing,
    disabled = false,
    onsubmit,
    onstop,
    oncanceledit,
    attachments = [],
    busyFiles = false,
    onfiles,
    onremove,
  }: Props = $props();

  const accept = `image/*,${TEXT_EXTENSIONS.map((e) => `.${e}`).join(',')}`;
  const canSend = $derived(!!value.trim() || attachments.length > 0);

  function onpaste(e: ClipboardEvent) {
    const files = [...(e.clipboardData?.files ?? [])];
    if (files.length === 0) return;
    e.preventDefault();
    onfiles?.(files);
  }

  function onpick(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    if (files.length) onfiles?.(files);
  }

  let ta: HTMLTextAreaElement | undefined = $state();

  // Vorschlagsliste für Slash-Befehle
  let active = $state(0);
  let dismissed = $state(false);
  const sugg = $derived(suggestions(value, commandStore.list));
  const listOpen = $derived(sugg.length > 0 && !dismissed);
  $effect(() => {
    void sugg.length;
    active = 0;
  });
  $effect(() => {
    if (!value.startsWith('/')) dismissed = false;
  });

  function pick(c: Command) {
    if (c.action) {
      value = `/${c.name}`;
    } else if (needsArgs(c)) {
      value = `/${c.name} `;
    } else {
      value = expand(c) ?? '';
      void commandStore.recordUse(c.name);
    }
    dismissed = true;
    ta?.focus();
  }

  // Eingabefeld wächst mit (bis max. 40 % der Fensterhöhe).
  $effect(() => {
    void value;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight + 2, window.innerHeight * 0.4)}px`;
  });

  export function focus() {
    ta?.focus();
  }

  function onkeydown(e: KeyboardEvent) {
    if (listOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const d = e.key === 'ArrowDown' ? 1 : -1;
        active = (active + d + sugg.length) % sugg.length;
        return;
      }
      if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
        e.preventDefault();
        pick(sugg[active]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        dismissed = true;
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      if (!streaming && (canSend || busyFiles)) onsubmit();
    }
  }

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!streaming && (canSend || busyFiles)) onsubmit();
  }
</script>

<form class="composer" onsubmit={submit}>
  {#if editing}
    <div class="editbar">
      <span>Letzte Nachricht bearbeiten</span>
      <button type="button" class="link" onclick={oncanceledit}>Abbrechen (Esc)</button>
    </div>
  {/if}
  {#if listOpen}
    <ul class="suggestions" id="command-list" role="listbox" aria-label="Schnellbefehle">
      {#each sugg as c, i (c.name)}
        <li
          id="cmd-{c.name}"
          role="option"
          aria-selected={i === active}
          class:active={i === active}
          onmousedown={(e) => e.preventDefault()}
          onclick={() => pick(c)}
          onkeydown={() => {}}
        >
          <span class="cmd">/{c.name}{#if c.placeholder}&nbsp;<span class="ph">{c.placeholder}</span>{/if}</span>
          <span class="desc">{c.description}</span>
        </li>
      {/each}
    </ul>
  {/if}
  {#if attachments.length > 0 || busyFiles}
    <ul class="previews" aria-label="Anhänge">
      {#each attachments as a, i (i)}
        <li class="preview">
          {#if a.kind === 'image'}
            <img src={a.dataUrl} alt="Vorschau: {a.name}" />
          {:else}
            <span class="file" aria-hidden="true">📄</span>
          {/if}
          <span class="fname">{a.name}{#if a.kind === 'text'} · {formatSize(a.size)}{/if}</span>
          <button type="button" class="remove" onclick={() => onremove?.(i)} aria-label="Anhang {a.name} entfernen">×</button>
        </li>
      {/each}
      {#if busyFiles}<li class="preview muted" role="status">Lade Anhang …</li>{/if}
    </ul>
  {/if}
  <div class="row">
    <label class="attach" title="Bild oder Datei anhängen">
      <input type="file" multiple {accept} class="sr-only" onchange={onpick} aria-label="Bild oder Datei anhängen" />
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5l-8.6 8.6a5.5 5.5 0 01-7.8-7.8l8.6-8.6a3.7 3.7 0 015.2 5.2l-8.6 8.6a1.8 1.8 0 01-2.6-2.6l7.9-7.9" /></svg>
    </label>
    <label class="sr-only" for="composer-input">Nachricht an Missa</label>
    <textarea
      id="composer-input"
      bind:this={ta}
      bind:value
      {onkeydown}
      {onpaste}
      rows="1"
      placeholder="Nachricht an Missa … ( / für Befehle)"
      aria-describedby="composer-hint"
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={listOpen}
      aria-controls="command-list"
      aria-activedescendant={listOpen ? `cmd-${sugg[active]?.name}` : undefined}
      {disabled}
    ></textarea>
    {#if streaming}
      <button type="button" class="stop" onclick={onstop} aria-keyshortcuts="Escape">Stopp</button>
    {:else}
      <button type="submit" class="primary" disabled={disabled || !(canSend || busyFiles)}>
        {editing ? 'Neu senden' : 'Senden'}
      </button>
    {/if}
  </div>
  <p id="composer-hint" class="hint">Enter sendet · Shift+Enter neue Zeile · / Befehle · Esc stoppt</p>
</form>

<style>
  .composer {
    position: relative;
    padding: 0.5rem 0 0.75rem;
    background: var(--bg);
  }
  .previews {
    list-style: none;
    margin: 0 0 0.4rem;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .preview {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.25rem 0.25rem 0.25rem 0.3rem;
    border: 1px solid var(--border);
    border-radius: 0.9rem;
    background: var(--surface);
    max-width: 100%;
  }
  .preview img {
    width: 2.75rem;
    height: 2.75rem;
    object-fit: cover;
    border-radius: 0.6rem;
  }
  .file {
    font-size: 1.4rem;
  }
  .fname {
    font-size: 0.85rem;
    max-width: 12rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .remove {
    min-height: 2rem;
    width: 2rem;
    padding: 0;
    border-radius: 50%;
    font-size: 1.1rem;
  }
  .attach {
    flex: none;
    width: 2.75rem;
    height: 2.75rem;
    display: grid;
    place-items: center;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: var(--surface-2);
    cursor: pointer;
  }
  .attach:focus-within {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  .attach svg {
    width: 1.3rem;
    height: 1.3rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .suggestions {
    position: absolute;
    bottom: 100%;
    left: 0;
    right: 0;
    z-index: 5;
    list-style: none;
    margin: 0 0 0.25rem;
    padding: 0.3rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-soft);
    max-height: 16rem;
    overflow-y: auto;
  }
  .suggestions li {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.2rem 1rem;
    padding: 0.45rem 0.7rem;
    border-radius: 0.7rem;
    cursor: pointer;
  }
  .suggestions li.active {
    background: var(--surface-2);
  }
  .cmd {
    font-weight: 700;
  }
  .ph,
  .desc {
    color: var(--muted);
    font-weight: 400;
  }
  .row {
    display: flex;
    gap: 0.5rem;
    align-items: flex-end;
  }
  textarea {
    flex: 1;
    min-width: 0;
    min-height: 2.75rem;
    resize: none;
    padding: 0.6rem 0.8rem;
    border: 1px solid var(--border);
    border-radius: 1.2rem;
    background: var(--surface);
    color: var(--text);
    font: inherit;
    line-height: 1.4;
  }
  .stop {
    background: var(--danger);
    color: var(--surface);
    border-color: transparent;
    font-weight: 600;
  }
  .row button {
    border-radius: 1.2rem;
  }
  .editbar {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    flex-wrap: wrap;
    font-size: 0.875rem;
    padding: 0.3rem 0.6rem;
    margin-bottom: 0.4rem;
    border-left: 3px solid var(--accent);
    background: var(--surface-2);
    border-radius: 0.4rem;
  }
  .hint {
    text-align: center;
    font-size: 0.75rem;
  }
  @media (max-width: 480px) {
    .hint {
      display: none;
    }
  }
</style>
