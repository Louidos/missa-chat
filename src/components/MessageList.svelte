<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { chat } from '../lib/chat.svelte';
  import MessageBubble from './MessageBubble.svelte';

  interface Props {
    onedit: () => void;
  }
  let { onedit }: Props = $props();

  let el: HTMLDivElement | undefined = $state();
  let atBottom = $state(true);
  let prevCount = 0;

  function measure() {
    if (!el) return;
    atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }

  function scrollToBottom(smooth = false) {
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth && !reduce ? 'smooth' : 'auto' });
  }

  // Automatisch mitscrollen – aber nur, wenn man schon unten ist. Eigene neue
  // Nachricht scrollt immer nach unten.
  $effect(() => {
    const count = chat.messages.length;
    const last = chat.messages.at(-1);
    void last?.content;
    void last?.status;
    const force = count > prevCount && chat.messages.some((m, i) => i >= prevCount && m.role === 'user');
    prevCount = count;
    if (force || untrack(() => atBottom)) {
      void tick().then(() => {
        scrollToBottom();
        atBottom = true;
      });
    }
  });
</script>

<div class="scroller" bind:this={el} onscroll={measure} role="log" aria-label="Gespräch mit Missa" aria-live="off">
  {#if chat.messages.length === 0}
    <div class="empty">
      <img src="/avatar.svg" alt="" width="72" height="72" />
      <p>Schreib Missa etwas.</p>
    </div>
  {:else}
    <ol class="list">
      {#each chat.messages as message, i (message.id)}
        <MessageBubble
          {message}
          isLast={i === chat.messages.length - 1}
          isLastUser={i === chat.lastUserIndex}
          busy={chat.streaming}
          onregenerate={() => chat.regenerate()}
          {onedit}
        />
      {/each}
    </ol>
  {/if}
</div>
{#if !atBottom}
  <button type="button" class="to-bottom" onclick={() => scrollToBottom(true)} aria-label="Nach unten scrollen">
    ↓ Nach unten
  </button>
{/if}

<style>
  .scroller {
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0.5rem 0;
    min-height: 0;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .empty {
    height: 100%;
    display: grid;
    place-content: center;
    justify-items: center;
    color: var(--muted);
    text-align: center;
  }
  .to-bottom {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    bottom: 6.5rem;
    border-radius: 999px;
    box-shadow: 0 2px 8px rgb(0 0 0 / 0.2);
    background: var(--surface);
    z-index: 2;
  }
</style>
