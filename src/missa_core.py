"""Einstellungen speichern und mit Missa über die Claude API chatten (ohne GUI)."""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Callable

import anthropic

APP_NAME = "MissaChat"
DEFAULT_API_URL = "https://api.anthropic.com"
DEFAULT_MODEL = "claude-opus-5-5"
DEFAULT_PERSONA = (
    "Du bist Missa, eine freundliche, hilfsbereite und humorvolle Chat-Partnerin. "
    "Du antwortest auf Deutsch, ausser der Nutzer schreibt in einer anderen Sprache. "
    "Halte deine Antworten natürlich und gesprächig."
)
KEYRING_SERVICE = "MissaChat"
KEYRING_USER = "api_key"


def config_dir() -> Path:
    base = os.environ.get("APPDATA") or str(Path.home() / ".config")
    path = Path(base) / APP_NAME
    path.mkdir(parents=True, exist_ok=True)
    return path


@dataclass
class Settings:
    api_url: str = DEFAULT_API_URL
    model: str = DEFAULT_MODEL
    persona: str = DEFAULT_PERSONA
    api_key: str = field(default="", repr=False)

    # --- Laden / Speichern -------------------------------------------------
    @classmethod
    def load(cls) -> "Settings":
        s = cls()
        cfg = config_dir() / "config.json"
        if cfg.exists():
            try:
                data = json.loads(cfg.read_text(encoding="utf-8"))
                for k in ("api_url", "model", "persona", "api_key"):
                    if isinstance(data.get(k), str):
                        setattr(s, k, data[k])
            except (OSError, ValueError):
                pass
        if not s.api_key:
            s.api_key = _keyring_get() or ""
        return s

    def save(self) -> None:
        data = asdict(self)
        # Key bevorzugt im Windows-Anmeldeinformationsspeicher ablegen.
        if _keyring_set(self.api_key):
            data.pop("api_key")
        (config_dir() / "config.json").write_text(
            json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
        )

    @property
    def is_complete(self) -> bool:
        return bool(self.api_key.strip())


def _keyring_get() -> str | None:
    try:
        import keyring

        return keyring.get_password(KEYRING_SERVICE, KEYRING_USER)
    except Exception:
        return None


def _keyring_set(value: str) -> bool:
    try:
        import keyring

        keyring.set_password(KEYRING_SERVICE, KEYRING_USER, value)
        return True
    except Exception:
        return False


class MissaChat:
    """Hält den Chatverlauf und schickt Nachrichten an die API."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.history: list[dict] = []
        self._client: anthropic.Anthropic | None = None

    def reset(self) -> None:
        self.history.clear()

    def apply_settings(self, settings: Settings) -> None:
        self.settings = settings
        self._client = None

    @property
    def _uses_official_api(self) -> bool:
        url = (self.settings.api_url or DEFAULT_API_URL).rstrip("/")
        return url == DEFAULT_API_URL

    def _get_client(self) -> anthropic.Anthropic:
        if self._client is None:
            self._client = anthropic.Anthropic(
                api_key=self.settings.api_key.strip(),
                base_url=(self.settings.api_url or DEFAULT_API_URL).strip(),
                timeout=300.0,
            )
        return self._client

    def send(self, text: str, on_text: Callable[[str], None]) -> str:
        """Sendet eine Nachricht, streamt die Antwort an `on_text`, gibt den Text zurück.

        Wirft `ChatError` mit einer verständlichen deutschen Meldung bei Fehlern.
        """
        self.history.append({"role": "user", "content": text})
        kwargs = dict(
            model=self.settings.model.strip() or DEFAULT_MODEL,
            max_tokens=64000,
            system=self.settings.persona or DEFAULT_PERSONA,
            messages=self.history,
            output_config={"effort": "low"},  # Chat: schnell und günstig
        )
        try:
            client = self._get_client()
            if self._uses_official_api:
                # Falls ein Sicherheitsfilter ablehnt, automatisch auf ein
                # passendes Ersatzmodell ausweichen.
                stream_ctx = client.beta.messages.stream(
                    betas=["server-side-fallback-2026-07-01"],
                    fallbacks="default",
                    **kwargs,
                )
            else:
                stream_ctx = client.messages.stream(**kwargs)
            with stream_ctx as stream:
                for chunk in stream.text_stream:
                    on_text(chunk)
                final = stream.get_final_message()
        except anthropic.AuthenticationError:
            self.history.pop()
            raise ChatError("API-Key ist ungültig. Bitte in den Einstellungen prüfen.")
        except anthropic.PermissionDeniedError:
            self.history.pop()
            raise ChatError("Kein Zugriff mit diesem API-Key (Berechtigung fehlt).")
        except anthropic.NotFoundError:
            self.history.pop()
            raise ChatError("Modell oder API-Adresse nicht gefunden. Bitte Einstellungen prüfen.")
        except anthropic.RateLimitError:
            self.history.pop()
            raise ChatError("Zu viele Anfragen – bitte kurz warten und nochmal versuchen.")
        except anthropic.APIStatusError as e:
            self.history.pop()
            raise ChatError(f"API-Fehler {e.status_code}: {e.message}")
        except anthropic.APIConnectionError:
            self.history.pop()
            raise ChatError("Keine Verbindung zur API. Internet und API-Adresse prüfen.")

        if final.stop_reason == "refusal":
            self.history.pop()
            raise ChatError("Missa kann auf diese Nachricht leider nicht antworten.")

        # Komplette Antwort (inkl. Thinking-Blöcke) unverändert zurück in den Verlauf.
        self.history.append({"role": "assistant", "content": final.content})
        return "".join(b.text for b in final.content if b.type == "text")


class ChatError(Exception):
    pass
