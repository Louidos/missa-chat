<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { avatar } from '../lib/avatar.svelte';
  import { chat } from '../lib/chat.svelte';
  import { greetingFor } from '../lib/greetings';
  import MessageBubble from './MessageBubble.svelte';

  interface Props {
    onedit: () => void;
  }
  let { onedit }: Props = $props();

  let el: HTMLDivElement | undefined = $state();
  const greeting = greetingFor(new Date());
  let atBottom = $state(true);
  let prevCount = 0;
  /** scrollTop nach dem letzten automatischen Mitscrollen (oder als man selbst unten war). */
  let followTop = -1;
  let prevConv: string | undefined;

  function measure() {
    if (!el) return;
    atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (atBottom) followTop = el.scrollTop;
  }

  /**
   * Hat man seit dem letzten Mitscrollen selbst nach oben gescrollt? Wird direkt an
   * scrollTop gemessen, nicht erst im (späteren) scroll-Event – sonst reisst ein Wort,
   * das vor dem Event eintrifft, einen wieder nach unten.
   */
  function scrolledUp(): boolean {
    return !!el && followTop >= 0 && el.scrollTop < followTop - 2;
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
    const conv = chat.conversation.id;
    if (conv !== prevConv) {
      // Anderes Gespräch: neu unten anfangen.
      prevConv = conv;
      followTop = -1;
    }
    const force = count > prevCount && chat.messages.some((m, i) => i >= prevCount && m.role === 'user');
    prevCount = count;
    if (untrack(() => chat.focusMessageId)) return;
    if (force || (untrack(() => atBottom) && !scrolledUp())) {
      void tick().then(() => {
        if (!force && scrolledUp()) return measure();
        scrollToBottom();
        if (el) followTop = el.scrollTop;
        atBottom = true;
      });
    } else {
      measure();
    }
  });

  // Zur Nachricht aus der Suche springen.
  $effect(() => {
    const id = chat.focusMessageId;
    if (!id) return;
    void tick().then(() => {
      const target = document.getElementById(`msg-${id}`);
      target?.scrollIntoView({ block: 'center' });
      measure();
      chat.focusMessageId = null;
    });
  });
</script>

<div class="scroller" bind:this={el} onscroll={measure} role="log" aria-label="Gespräch mit Missa" aria-live="off">
  {#if chat.messages.length === 0}
    <div class="empty">
      <img class="avatar-big" src={avatar.url} alt="" width="96" height="96" />
      <p class="greeting">{greeting}</p>
      <p class="muted">Schreib Missa etwas.</p>
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
          ondelete={() => chat.deleteQueued(message.id)}
          highlight={chat.highlight}
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
  .avatar-big {
    width: 6rem;
    height: 6rem;
    border-radius: 50%;
    object-fit: cover;
    box-shadow: var(--shadow-soft);
  }
  .greeting {
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--text);
    margin: 0.75rem 0 0;
  }
  .empty .muted {
    margin: 0.25rem 0 0;
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
