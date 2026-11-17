<script lang="ts">
  interface Props {
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    onconfirm: () => void | Promise<void>;
  }
  let { open = $bindable(false), title, message, confirmLabel, danger = false, onconfirm }: Props =
    $props();
  const uid = $props.id();
  let dialog: HTMLDialogElement | undefined = $state();
  let busy = $state(false);

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });

  async function confirm() {
    busy = true;
    try {
      await onconfirm();
    } finally {
      busy = false;
      open = false;
    }
  }
</script>

<dialog bind:this={dialog} onclose={() => (open = false)} aria-labelledby="confirm-title-{uid}">
  <h2 id="confirm-title-{uid}">{title}</h2>
  <p>{message}</p>
  <div class="actions">
    <button type="button" onclick={() => (open = false)} disabled={busy}>Abbrechen</button>
    <button type="button" class={danger ? 'danger' : 'primary'} onclick={confirm} disabled={busy}>
      {confirmLabel}
    </button>
  </div>
</dialog>

<style>
  dialog {
    max-width: min(28rem, calc(100vw - 2rem));
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
    font-size: 1.15rem;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
</style>
