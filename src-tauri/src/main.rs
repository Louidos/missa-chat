// Unter Windows kein zusätzliches Konsolenfenster öffnen (nur im Release-Build).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    missa_chat_lib::run();
}
