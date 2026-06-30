pub mod ai;
pub mod commands;
pub mod db;
pub mod health;
pub mod models;
pub mod scanner;
pub mod security;
pub mod trust_policy;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
