<script lang="ts">
  interface Props {
    id: string;
    label: string;
    value: string;
    placeholder?: string;
    hint?: string;
    invalid?: boolean;
    autocomplete?: 'off' | 'new-password' | 'current-password';
  }
  let {
    id,
    label,
    value = $bindable(''),
    placeholder = '',
    hint = '',
    invalid = false,
    autocomplete = 'off',
  }: Props = $props();
  let visible = $state(false);
</script>

<div class="field">
  <label for={id}>{label}</label>
  <div class="pw">
    <input
      {id}
      type={visible ? 'text' : 'password'}
      bind:value
      {placeholder}
      {autocomplete}
      autocapitalize="off"
      spellcheck="false"
      aria-invalid={invalid}
      aria-describedby={hint ? `${id}-hint` : undefined}
    />
    <button
      type="button"
      class="eye"
      aria-label={visible ? `${label} verbergen` : `${label} anzeigen`}
      aria-pressed={visible}
      aria-controls={id}
      onclick={() => (visible = !visible)}
    >
      {#if visible}
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A9.8 9.8 0 0112 5c5 0 9 4.5 10 7-.4 1-1.3 2.4-2.6 3.7M6.1 6.1C4.1 7.5 2.6 9.6 2 12c1 2.5 5 7 10 7 1.7 0 3.3-.5 4.6-1.2" /></svg>
      {:else}
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
      {/if}
    </button>
  </div>
  {#if hint}<p class="hint" id="{id}-hint">{hint}</p>{/if}
</div>

<style>
  .pw {
    display: flex;
    gap: 0.25rem;
  }
  .pw input {
    flex: 1;
    min-width: 0;
  }
  .eye {
    flex: none;
    width: 2.75rem;
    padding: 0;
    display: grid;
    place-items: center;
  }
  svg {
    width: 1.3rem;
    height: 1.3rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
  }
</style>
