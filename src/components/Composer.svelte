<script lang="ts">
  interface Props {
    value: string;
    streaming: boolean;
    editing: boolean;
    disabled?: boolean;
    onsubmit: () => void;
    onstop: () => void;
    oncanceledit: () => void;
  }
  let {
    value = $bindable(''),
    streaming,
    editing,
    disabled = false,
    onsubmit,
    onstop,
    oncanceledit,
  }: Props = $props();

  let ta: HTMLTextAreaElement | undefined = $state();

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
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      if (!streaming && value.trim()) onsubmit();
    }
  }

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!streaming && value.trim()) onsubmit();
  }
</script>

<form class="composer" onsubmit={submit}>
  {#if editing}
    <div class="editbar">
      <span>Letzte Nachricht bearbeiten</span>
      <button type="button" class="link" onclick={oncanceledit}>Abbrechen (Esc)</button>
    </div>
  {/if}
  <div class="row">
    <label class="sr-only" for="composer-input">Nachricht an Missa</label>
    <textarea
      id="composer-input"
      bind:this={ta}
      bind:value
      {onkeydown}
      rows="1"
      placeholder="Nachricht an Missa …"
      aria-describedby="composer-hint"
      {disabled}
    ></textarea>
    {#if streaming}
      <button type="button" class="stop" onclick={onstop} aria-keyshortcuts="Escape">Stopp</button>
    {:else}
      <button type="submit" class="primary" disabled={disabled || !value.trim()}>
        {editing ? 'Neu senden' : 'Senden'}
      </button>
    {/if}
  </div>
  <p id="composer-hint" class="hint">Enter sendet · Shift+Enter neue Zeile · Esc stoppt</p>
</form>

<style>
  .composer {
    padding: 0.5rem 0 0.75rem;
    background: var(--bg);
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
