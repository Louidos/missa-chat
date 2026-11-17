//! Hülle der Windows-App: ein einziges Fenster, das die gebaute Web-App (dist-desktop/)
//! anzeigt. Die Logik bleibt komplett in der Web-App; hier wird nur das Fenster gebaut.

use tauri::webview::NewWindowResponse;
use tauri::window::Color;
use tauri::{AppHandle, Manager, Theme, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tauri_plugin_window_state::{StateFlags, WindowExt};

const MAIN: &str = "main";

/// Hintergrund wie in src/app.css (--bg), damit das Fenster beim Start nicht weiss aufblitzt.
const BG_LIGHT: Color = Color(0xfa, 0xf7, 0xf4, 0xff);
const BG_DARK: Color = Color(0x1c, 0x18, 0x16, 0xff);

/// Grösse und Position merken, aber das Anzeigen selbst steuern (erst nach dem Färben).
fn state_flags() -> StateFlags {
    StateFlags::all() - StateFlags::VISIBLE
}

/// Gehört die Adresse zur App selbst? Alles andere öffnet der Standardbrowser.
fn is_app_url(url: &Url) -> bool {
    match url.host_str() {
        // Gebaute App (siehe HERKUNFT unten).
        Some("tauri.localhost") => true,
        // Nur beim Entwickeln (npm run tauri:dev): Vite-Server.
        Some("localhost") if cfg!(debug_assertions) => url.port() == Some(5173),
        _ => url.scheme() == "tauri",
    }
}

/// Links aus Missas Antworten im Standardbrowser öffnen – nur http(s) und mailto.
fn open_external(url: &Url) {
    if matches!(url.scheme(), "http" | "https" | "mailto") {
        let _ = tauri_plugin_opener::open_url(url.as_str(), None::<&str>);
    }
}

fn focus(window: &WebviewWindow) {
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
}

fn create_main_window(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    let window = WebviewWindowBuilder::new(app, MAIN, WebviewUrl::App("index.html".into()))
        .title("Missa")
        .inner_size(1000.0, 760.0)
        .min_inner_size(400.0, 500.0)
        .center()
        // Erst zeigen, wenn Farbe, Grösse und Position stimmen (kein Springen, kein Weiss).
        .visible(false)
        .background_color(BG_LIGHT)
        // HERKUNFT – NIE MEHR ÄNDERN!
        // false = die App läuft unter http://tauri.localhost (Tauri-Standard unter Windows).
        // *.localhost gilt in WebView2 als sicherer Kontext: crypto.subtle (PIN) und
        // IndexedDB funktionieren, und die API unter http://localhost bleibt erreichbar.
        // Wird das geändert, liegen Verlauf, Key und Einstellungen unter einer anderen
        // Herkunft – für die Nutzer wären sie weg. Ausserdem steht die Herkunft in der
        // CORS-Freigabe auf rp01 (docs/caddy-cors.md, docs/windows-app.md).
        .use_https_scheme(false)
        // Tauris eigenes Drag & Drop aus, sonst kommen Dateien nicht in der Seite an.
        .disable_drag_drop_handler()
        .on_navigation(|url| {
            if is_app_url(url) {
                return true;
            }
            open_external(url);
            false
        })
        .on_new_window(|url, _features| {
            // target="_blank" (Links in Antworten): nie ein zweites App-Fenster.
            open_external(&url);
            NewWindowResponse::Deny
        })
        .build()?;

    // Dunkler Systemmodus: dunkler Hintergrund, bevor das Fenster sichtbar wird.
    if matches!(window.theme(), Ok(Theme::Dark)) {
        let _ = window.set_background_color(Some(BG_DARK));
    }
    let _ = window.restore_state(state_flags());
    window.show()?;
    let _ = window.set_focus();
    Ok(window)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Muss als erstes Plugin stehen: ein zweiter Start holt nur das Fenster nach vorne.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window(MAIN) {
                focus(&window);
            }
        }))
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(state_flags())
                // Wiederherstellen macht create_main_window selbst, bevor es das Fenster zeigt.
                .skip_initial_state(MAIN)
                .build(),
        )
        // Ersetzt window.Notification in der Seite durch Windows-Benachrichtigungen.
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            create_main_window(app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Missa konnte nicht gestartet werden");
}
