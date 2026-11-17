<script lang="ts">
  interface Props {
    open: boolean;
    title: string;
    label: string;
    value: string;
    confirmLabel: string;
    onconfirm: (value: string) => void | Promise<void>;
  }
  let { open = $bindable(false), title, label, value, confirmLabel, onconfirm }: Props = $props();
  let dialog: HTMLDialogElement | undefined = $state();
  let text = $state('');

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      text = value;
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  });

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    await onconfirm(text.trim());
    open = false;
  }
</script>

<dialog bind:this={dialog} onclose={() => (open = false)} aria-labelledby="prompt-title">
  <form onsubmit={submit}>
    <h2 id="prompt-title">{title}</h2>
    <div class="field">
      <label for="prompt-input">{label}</label>
      <input id="prompt-input" type="text" bind:value={text} maxlength="120" />
    </div>
    <div class="actions">
      <button type="button" onclick={() => (open = false)}>Abbrechen</button>
      <button type="submit" class="primary" disabled={!text.trim()}>{confirmLabel}</button>
    </div>
  </form>
</dialog>

<style>
  dialog {
    width: min(28rem, calc(100vw - 2rem));
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    padding: 1.25rem;
  }
  dialog::backdrop {
    background: rgb(0 0 0 / 0.45);
  }
  h2 {
    margin-top: 0;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 1rem;
  }
</style>
