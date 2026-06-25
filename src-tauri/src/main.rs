// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
mod models;
mod scanner;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match db::init_db(&handle).await {
                    Ok(pool) => {
                        handle.manage(pool);
                        log::info!("Database initialized successfully");
                    }
                    Err(e) => {
                        log::error!("Failed to initialize database: {}", e);
                    }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::system::get_app_info,
            commands::skills::list_skill_sources,
            commands::skills::add_skill_source,
            commands::skills::delete_skill_source,
            commands::skills::scan_skill_source,
            commands::skills::list_skills,
            commands::skills::generate_skill_description,
            commands::skills::update_skill_description,
            commands::agents::list_agents,
            commands::agents::add_agent,
            commands::agents::delete_agent,
            commands::agents::scan_agents_in_dir,
            commands::agents::scan_system_agents,
            commands::agents::launch_agent,
            commands::agents::open_config_dir,
            commands::mcp::list_mcp_servers,
            commands::mcp::add_mcp_server,
            commands::mcp::delete_mcp_server,
            commands::mcp::scan_mcp_dir,
            commands::mcp::discover_system_mcp,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
