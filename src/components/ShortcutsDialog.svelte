<script lang="ts">
  interface Props {
    open: boolean;
  }
  let { open = $bindable(false) }: Props = $props();
  let dialog: HTMLDialogElement | undefined = $state();

  const shortcuts: Array<[string, string]> = [
    ['Enter', 'Nachricht senden'],
    ['Shift + Enter', 'Neue Zeile'],
    ['Esc', 'Antwort stoppen · Bearbeiten abbrechen · Fenster schliessen'],
    ['/', 'Schnellbefehle (↑ ↓ wählen, Enter/Tab übernehmen)'],
    ['Ctrl + K  (Mac: ⌘ K)', 'In allen Gesprächen suchen'],
    ['Ctrl + V', 'Screenshot oder Bild einfügen'],
    ['?', 'Diese Übersicht'],
  ];

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });
</script>

<dialog bind:this={dialog} onclose={() => (open = false)} aria-labelledby="shortcuts-title">
  <h2 id="shortcuts-title">Tastenkürzel</h2>
  <table>
    <tbody>
      {#each shortcuts as [key, what] (key)}
        <tr>
          <th scope="row"><kbd>{key}</kbd></th>
          <td>{what}</td>
        </tr>
      {/each}
    </tbody>
  </table>
  <div class="actions">
    <button type="button" class="primary" onclick={() => (open = false)}>Schliessen</button>
  </div>
</dialog>

<style>
  dialog {
    width: min(32rem, calc(100vw - 2rem));
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
  table {
    border-collapse: collapse;
    width: 100%;
  }
  th,
  td {
    text-align: left;
    padding: 0.35rem 0.25rem;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }
  th {
    white-space: nowrap;
    font-weight: 400;
  }
  kbd {
    font-family: inherit;
    font-weight: 700;
    padding: 0.1rem 0.4rem;
    border: 1px solid var(--border);
    border-radius: 0.4rem;
    background: var(--surface-2);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 1rem;
  }
</style>
