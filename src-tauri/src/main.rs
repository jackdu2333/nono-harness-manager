// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
mod models;
mod scanner;
mod security;
mod trust_policy;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                match db::init_db(&handle).await {
                    Ok(pool) => {
                        handle.manage(pool);
                        log::info!("Database initialized successfully");
                        Ok(())
                    }
                    Err(e) => {
                        log::error!("Failed to initialize database: {}", e);
                        Err(e)
                    }
                }
            })?;
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
            commands::skills::set_skill_category,
            commands::skills::set_skill_status,
            commands::skills::toggle_favorite,
            commands::skills::toggle_needs_review,
            commands::skills::toggle_needs_improvement,
            commands::skills::archive_skill,
            commands::skills::delete_skill_index,
            commands::skills::update_improvement_note,
            commands::skills::update_review_note,
            commands::skills::mark_duplicate,
            commands::skills::record_skill_usage,
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
            commands::harness_api::list_harness_resources,
            commands::harness_api::get_harness_resource_context,
            commands::harness_api::create_intelligence_proposal,
            commands::harness_api::list_intelligence_proposals,
            commands::harness_api::apply_intelligence_proposal,
            commands::harness_api::reject_intelligence_proposal,
            commands::harness_api::rollback_intelligence_proposal,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
