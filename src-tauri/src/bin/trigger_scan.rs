use sqlx::SqlitePool;

#[path = "../scanner/log_scanner.rs"]
mod log_scanner;

// Log scanner depends on skill info etc.
#[path = "../models/mod.rs"]
mod models;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut db_path = dirs::home_dir().unwrap();
    db_path.push("Library/Application Support/com.jackdu.nono-harness-manager/harness.db");
    println!("Connecting to database: {}", db_path.display());

    let db_url = format!("sqlite:{}?mode=rwc", db_path.to_string_lossy());
    let pool = SqlitePool::connect(&db_url).await?;

    println!("Database connected. Running migrations...");
    sqlx::migrate!("./migrations").run(&pool).await?;

    println!("Running log scanner...");
    log_scanner::scan_all_logs(&pool).await?;
    println!("Log scanner finished successfully.");

    // Query statistics
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM agent_resource_usage_events")
        .fetch_one(&pool)
        .await?;
    println!("Total events in DB: {}", count);

    let checkpoints_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM agent_log_scan_checkpoints")
            .fetch_one(&pool)
            .await?;
    println!("Total checkpoints in DB: {}", checkpoints_count);

    Ok(())
}
