import { DEFAULT_COMMANDS, topCommands, type Command } from './commands';
import { prefs } from './prefs.svelte';

/** Aktuelle Schnellbefehle (eigene oder Standard) und ihre Nutzung. */
class CommandStore {
  get list(): Command[] {
    return prefs.value.commands ?? DEFAULT_COMMANDS;
  }

  get top(): Command[] {
    return topCommands(this.list, prefs.value.commandUsage);
  }

  get isDefault(): boolean {
    return prefs.value.commands === null;
  }

  async recordUse(name: string): Promise<void> {
    const usage = { ...prefs.value.commandUsage };
    usage[name] = (usage[name] ?? 0) + 1;
    await prefs.update({ commandUsage: usage });
  }

  async save(list: Command[]): Promise<void> {
    await prefs.update({ commands: list });
  }

  async resetDefaults(): Promise<void> {
    await prefs.update({ commands: null });
  }
}

export const commandStore = new CommandStore();
