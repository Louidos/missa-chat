"""Missa Chat – einfache Windows-Desktop-App (tkinter)."""

from __future__ import annotations

import queue
import threading
import tkinter as tk
from tkinter import messagebox, scrolledtext, ttk

from missa_core import DEFAULT_API_URL, DEFAULT_MODEL, DEFAULT_PERSONA, ChatError, MissaChat, Settings

BG = "#1e1f29"
PANEL = "#282a36"
FG = "#f2f2f2"
ACCENT = "#ff79c6"
USER_COLOR = "#8be9fd"
ERROR_COLOR = "#ff5555"


class SettingsDialog(tk.Toplevel):
    def __init__(self, master: tk.Tk, settings: Settings, first_start: bool = False):
        super().__init__(master)
        self.title("Einstellungen – Missa Chat")
        self.configure(bg=BG, padx=16, pady=16)
        self.resizable(False, False)
        self.transient(master)
        self.result: Settings | None = None

        if first_start:
            tk.Label(self, text="Willkommen! Gib deinen API-Key ein, um mit Missa zu chatten.",
                     bg=BG, fg=ACCENT, font=("Segoe UI", 10, "bold")).grid(row=0, column=0, columnspan=2, sticky="w", pady=(0, 10))

        self.url = self._field("API-Adresse:", settings.api_url or DEFAULT_API_URL, 1)
        self.key = self._field("API-Key:", settings.api_key, 2, show="•")
        self.model = self._field("Modell:", settings.model or DEFAULT_MODEL, 3)

        self.show_key = tk.BooleanVar(value=False)
        tk.Checkbutton(self, text="Key anzeigen", variable=self.show_key, bg=BG, fg=FG,
                       selectcolor=PANEL, activebackground=BG, activeforeground=FG,
                       command=lambda: self.key.config(show="" if self.show_key.get() else "•")
                       ).grid(row=4, column=1, sticky="w")

        tk.Label(self, text="Missas Persönlichkeit:", bg=BG, fg=FG).grid(row=5, column=0, sticky="nw", pady=(8, 0))
        self.persona = tk.Text(self, width=50, height=6, wrap="word", bg=PANEL, fg=FG, insertbackground=FG, relief="flat")
        self.persona.insert("1.0", settings.persona or DEFAULT_PERSONA)
        self.persona.grid(row=5, column=1, pady=(8, 0))

        btns = tk.Frame(self, bg=BG)
        btns.grid(row=6, column=0, columnspan=2, sticky="e", pady=(14, 0))
        ttk.Button(btns, text="Abbrechen", command=self.destroy).pack(side="right", padx=(6, 0))
        ttk.Button(btns, text="Speichern", command=self._save).pack(side="right")

        self.bind("<Return>", lambda e: self._save() if e.widget is not self.persona else None)
        self.grab_set()
        self.key.focus_set()

    def _field(self, label: str, value: str, row: int, show: str = "") -> tk.Entry:
        tk.Label(self, text=label, bg=BG, fg=FG).grid(row=row, column=0, sticky="w", pady=4, padx=(0, 10))
        entry = tk.Entry(self, width=52, show=show, bg=PANEL, fg=FG, insertbackground=FG, relief="flat")
        entry.insert(0, value)
        entry.grid(row=row, column=1, pady=4, ipady=4)
        return entry

    def _save(self) -> None:
        key = self.key.get().strip()
        if not key:
            messagebox.showwarning("API-Key fehlt", "Bitte einen API-Key eingeben.", parent=self)
            return
        self.result = Settings(
            api_url=self.url.get().strip() or DEFAULT_API_URL,
            model=self.model.get().strip() or DEFAULT_MODEL,
            persona=self.persona.get("1.0", "end").strip() or DEFAULT_PERSONA,
            api_key=key,
        )
        self.result.save()
        self.destroy()


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Missa Chat")
        self.geometry("760x620")
        self.minsize(480, 400)
        self.configure(bg=BG)

        self.settings = Settings.load()
        self.chat = MissaChat(self.settings)
        self.events: queue.Queue = queue.Queue()
        self.busy = False

        self._build_ui()
        self.after(50, self._poll_events)
        if not self.settings.is_complete:
            self.after(200, lambda: self.open_settings(first_start=True))
        else:
            self._system_line("Hallo! Schreib Missa eine Nachricht. 💬")

    # --- UI ---------------------------------------------------------------
    def _build_ui(self) -> None:
        top = tk.Frame(self, bg=PANEL, padx=10, pady=6)
        top.pack(fill="x")
        tk.Label(top, text="✿ Missa", bg=PANEL, fg=ACCENT, font=("Segoe UI", 14, "bold")).pack(side="left")
        ttk.Button(top, text="⚙ Einstellungen", command=self.open_settings).pack(side="right")
        ttk.Button(top, text="Neuer Chat", command=self.new_chat).pack(side="right", padx=6)

        self.log = scrolledtext.ScrolledText(self, wrap="word", state="disabled", bg=BG, fg=FG,
                                             font=("Segoe UI", 11), relief="flat", padx=12, pady=10)
        self.log.pack(fill="both", expand=True)
        self.log.tag_config("user_name", foreground=USER_COLOR, font=("Segoe UI", 11, "bold"))
        self.log.tag_config("missa_name", foreground=ACCENT, font=("Segoe UI", 11, "bold"))
        self.log.tag_config("system", foreground="#9aa0b4", font=("Segoe UI", 10, "italic"))
        self.log.tag_config("error", foreground=ERROR_COLOR)

        bottom = tk.Frame(self, bg=PANEL, padx=10, pady=10)
        bottom.pack(fill="x")
        self.input = tk.Text(bottom, height=3, wrap="word", bg=BG, fg=FG, insertbackground=FG,
                             font=("Segoe UI", 11), relief="flat")
        self.input.pack(side="left", fill="x", expand=True, padx=(0, 8))
        self.input.bind("<Return>", self._on_enter)
        self.send_btn = ttk.Button(bottom, text="Senden ➤", command=self.send)
        self.send_btn.pack(side="right", fill="y")
        tk.Label(self, text="Enter = senden · Shift+Enter = neue Zeile", bg=BG, fg="#6c7086",
                 font=("Segoe UI", 8)).pack(anchor="e", padx=10)
        self.input.focus_set()

    def _append(self, text: str, tag: str | None = None) -> None:
        self.log.config(state="normal")
        self.log.insert("end", text, tag)
        self.log.see("end")
        self.log.config(state="disabled")

    def _system_line(self, text: str) -> None:
        self._append(text + "\n\n", "system")

    # --- Aktionen ---------------------------------------------------------
    def _on_enter(self, event):
        if event.state & 0x0001:  # Shift gedrückt -> normale neue Zeile
            return None
        self.send()
        return "break"

    def open_settings(self, first_start: bool = False) -> None:
        dlg = SettingsDialog(self, self.settings, first_start=first_start)
        self.wait_window(dlg)
        if dlg.result:
            self.settings = dlg.result
            self.chat.apply_settings(self.settings)
            self._system_line("Einstellungen gespeichert. ✔")

    def new_chat(self) -> None:
        if self.busy:
            return
        self.chat.reset()
        self.log.config(state="normal")
        self.log.delete("1.0", "end")
        self.log.config(state="disabled")
        self._system_line("Neuer Chat gestartet. 💬")

    def send(self) -> None:
        text = self.input.get("1.0", "end").strip()
        if not text or self.busy:
            return
        if not self.settings.is_complete:
            self.open_settings(first_start=True)
            return
        self.input.delete("1.0", "end")
        self._append("Du\n", "user_name")
        self._append(text + "\n\n")
        self._append("Missa\n", "missa_name")
        self._set_busy(True)
        threading.Thread(target=self._worker, args=(text,), daemon=True).start()

    def _worker(self, text: str) -> None:
        try:
            self.chat.send(text, lambda chunk: self.events.put(("text", chunk)))
            self.events.put(("done", None))
        except ChatError as e:
            self.events.put(("error", str(e)))
        except Exception as e:  # unerwartete Fehler trotzdem anzeigen
            self.events.put(("error", f"Unerwarteter Fehler: {e}"))

    def _poll_events(self) -> None:
        try:
            while True:
                kind, payload = self.events.get_nowait()
                if kind == "text":
                    self._append(payload)
                elif kind == "done":
                    self._append("\n\n")
                    self._set_busy(False)
                elif kind == "error":
                    self._append("⚠ " + payload + "\n\n", "error")
                    self._set_busy(False)
        except queue.Empty:
            pass
        self.after(30, self._poll_events)

    def _set_busy(self, busy: bool) -> None:
        self.busy = busy
        self.send_btn.config(state="disabled" if busy else "normal", text="…" if busy else "Senden ➤")


def main() -> None:
    App().mainloop()


if __name__ == "__main__":
    main()
