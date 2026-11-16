<script lang="ts">
  import { untrack } from 'svelte';
  import { CORS_DOC, DEFAULT_API_URL } from '../lib/api';
  import { session, type ConnectResult } from '../lib/session.svelte';
  import PasswordField from './PasswordField.svelte';

  type Success = Extract<ConnectResult, { ok: true }>;
  interface Props {
    mode: 'setup' | 'edit';
    ondone?: (r: Success) => void;
  }
  let { mode, ondone }: Props = $props();

  const conn = session.connection;
  // Modus wird beim Öffnen festgelegt und ändert sich danach nicht.
  const editing = untrack(() => mode === 'edit') && conn !== null;
  let externalUrl = $state(editing && conn ? conn.externalUrl : DEFAULT_API_URL);
  let internalUrl = $state(editing && conn ? (conn.internalUrl ?? '') : '');
  let showInternal = $state(Boolean(editing && conn?.internalUrl));
  let apiKey = $state('');
  let usePin = $state(editing && session.hasPin);
  let pin = $state('');
  let pinRepeat = $state('');
  let busy = $state(false);
  let error = $state('');
  let errorField = $state<string | undefined>();

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (busy) return;
    busy = true;
    error = '';
    errorField = undefined;
    try {
      const r = await session.connect({ externalUrl, internalUrl, apiKey, usePin, pin, pinRepeat });
      if (r.ok) {
        apiKey = '';
        pin = '';
        pinRepeat = '';
        ondone?.(r);
      } else {
        error = r.message;
        errorField = r.field;
      }
    } finally {
      busy = false;
    }
  }
</script>

<form onsubmit={submit} novalidate aria-busy={busy}>
  <div class="field">
    <label for="api-url">API-Adresse</label>
    <input
      id="api-url"
      type="url"
      inputmode="url"
      bind:value={externalUrl}
      placeholder={DEFAULT_API_URL}
      autocomplete="url"
      autocapitalize="off"
      spellcheck="false"
      aria-invalid={errorField === 'externalUrl'}
      required
    />
  </div>

  {#if showInternal}
    <div class="field">
      <label for="api-url-internal">Adresse im Heimnetz <span class="muted">(optional)</span></label>
      <input
        id="api-url-internal"
        type="url"
        inputmode="url"
        bind:value={internalUrl}
        placeholder="https://ai01.heimnetz.lan"
        autocapitalize="off"
        spellcheck="false"
        aria-invalid={errorField === 'internalUrl'}
        aria-describedby="api-url-internal-hint"
      />
      <p class="hint" id="api-url-internal-hint">
        Zuhause nimmt die App automatisch diese Adresse, unterwegs die obere. Auch hier gilt: nur https.
      </p>
    </div>
  {:else}
    <button type="button" class="link" onclick={() => (showInternal = true)}>
      + Zweite Adresse für das Heimnetz
    </button>
  {/if}

  <PasswordField
    id="api-key"
    label="API-Key"
    bind:value={apiKey}
    invalid={errorField === 'apiKey'}
    placeholder={editing ? 'leer lassen = bisherigen Key behalten' : ''}
  />

  <div class="check">
    <input id="use-pin" type="checkbox" bind:checked={usePin} />
    <label for="use-pin">Mit PIN sperren</label>
  </div>
  {#if usePin}
    <div class="pin-group">
      <PasswordField
        id="pin"
        label="PIN"
        bind:value={pin}
        autocomplete="new-password"
        invalid={errorField === 'pin'}
        placeholder={editing && session.hasPin ? 'leer lassen = PIN behalten' : ''}
        hint="Der Key wird mit der PIN verschlüsselt gespeichert. Längere PINs sind sicherer (mind. 6 Zeichen empfohlen)."
      />
      <PasswordField
        id="pin-repeat"
        label="PIN wiederholen"
        bind:value={pinRepeat}
        autocomplete="new-password"
        invalid={errorField === 'pin'}
      />
    </div>
  {/if}

  {#if error}
    <div class="alert" role="alert">
      <p>{error}</p>
    </div>
  {/if}

  <button type="submit" class="primary wide" disabled={busy}>
    {#if busy}Prüfe Verbindung …{:else if editing}Speichern und prüfen{:else}Verbinden{/if}
  </button>
  {#if error.includes(CORS_DOC)}
    <p class="hint">Die CORS-Anleitung liegt im Repository unter <code>{CORS_DOC}</code>.</p>
  {/if}
</form>

<style>
  form {
    display: grid;
    gap: 1rem;
  }
  .check {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .check input {
    width: 1.25rem;
    height: 1.25rem;
    margin: 0;
  }
  .check label {
    font-weight: 600;
  }
  .pin-group {
    display: grid;
    gap: 1rem;
    padding-left: 0.75rem;
    border-left: 3px solid var(--accent-soft);
  }
</style>
