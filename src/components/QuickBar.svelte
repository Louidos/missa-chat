<script lang="ts">
  import { chat } from '../lib/chat.svelte';
  import { commandStore } from '../lib/commandStore.svelte';
  import { isYesNoQuestion, needsArgs, type Command } from '../lib/commands';

  interface Props {
    draft: string;
    onsend: (text: string) => void;
    onfill: (text: string) => void;
  }
  let { draft, onsend, onfill }: Props = $props();

  const last = $derived(chat.messages.at(-1));
  const yesNo = $derived(
    !draft.trim() &&
      !chat.streaming &&
      last?.role === 'assistant' &&
      last.status === 'done' &&
      isYesNoQuestion(last.content),
  );

  function use(c: Command) {
    if (c.action || !needsArgs(c)) onsend(`/${c.name}`);
    else onfill(`/${c.name} `);
  }
</script>

<div class="quick" role="group" aria-label={yesNo ? 'Schnell antworten' : 'Schnellbefehle'}>
  {#if yesNo}
    <button type="button" class="chip yes" onclick={() => onsend('Ja')}>Ja</button>
    <button type="button" class="chip" onclick={() => onsend('Nein')}>Nein</button>
  {:else}
    {#each commandStore.top as c (c.name)}
      <button type="button" class="chip" onclick={() => use(c)} disabled={chat.streaming} title={c.description}>
        /{c.name}
      </button>
    {/each}
  {/if}
</div>

<style>
  .quick {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    padding-top: 0.4rem;
  }
  .chip {
    min-height: 2.25rem;
    padding: 0.2rem 0.85rem;
    border-radius: 999px;
    font-size: 0.9rem;
    background: var(--surface);
  }
  .chip.yes {
    background: var(--accent);
    color: var(--accent-text);
    border-color: transparent;
    font-weight: 600;
  }
</style>
