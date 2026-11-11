# Missa Chat 💬

Eine einfache Windows-App, mit der du mit **Missa** chatten kannst.
Installieren per `MissaChat-Setup.exe`, API-Key eingeben, losschreiben.

## Installation (Windows)

1. Den Installer herunterladen:
   - **Releases** (bei Versionen mit Tag `v…`) → `MissaChat-Setup.exe`, oder
   - **Actions** → letzter Lauf von „Windows-Installer bauen" → Artefakt `MissaChat-Windows`
2. `MissaChat-Setup.exe` starten und durchklicken (keine Admin-Rechte nötig).
3. Missa Chat starten → beim ersten Start öffnen sich die Einstellungen.

> Windows SmartScreen meldet evtl. „Unbekannter Herausgeber" (die EXE ist nicht signiert):
> **Weitere Informationen → Trotzdem ausführen**.

## Einstellungen

| Feld | Bedeutung |
|---|---|
| API-Adresse | Standard `https://api.anthropic.com` (Claude API). Eigene Anthropic-kompatible Adresse möglich. |
| API-Key | Dein Key (z. B. `sk-ant-…` von console.anthropic.com) |
| Modell | Standard `claude-opus-5-5` |
| Missas Persönlichkeit | Systemprompt – so verhält sich Missa |

Der API-Key wird in der **Windows-Anmeldeinformationsverwaltung** gespeichert,
die übrigen Einstellungen in `%APPDATA%\MissaChat\config.json`.

## Bedienung

- **Enter** senden, **Shift+Enter** neue Zeile
- **Neuer Chat** löscht den Verlauf
- Antworten werden live gestreamt

## Selbst bauen

```bat
pip install -r requirements.txt pyinstaller
pyinstaller --onefile --windowed --name MissaChat --paths src --hidden-import keyring.backends.Windows src/missa_chat.py
"C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer\MissaChat.iss
```

Ohne Bauen direkt starten: `python src/missa_chat.py`

Neue Version veröffentlichen: Tag pushen, z. B. `git tag v1.0.0 && git push origin v1.0.0`.
