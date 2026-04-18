use serde::{Deserialize, Serialize};
use sysinfo::System;

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemStats {
    pub memory_used_mb: f64,
    pub memory_total_mb: f64,
    pub memory_percentage: f64,
    pub cpu_usage: f64,
}

#[tauri::command]
pub async fn get_system_stats() -> Result<SystemStats, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut sys = System::new();
        sys.refresh_memory();
        sys.refresh_cpu_usage();

        std::thread::sleep(std::time::Duration::from_millis(200));
        sys.refresh_cpu_usage();

        let total = sys.total_memory();
        let used = sys.used_memory();
        let total_mb = total as f64 / 1024.0 / 1024.0;
        let used_mb = used as f64 / 1024.0 / 1024.0;
        let percentage = if total > 0 {
            (used as f64 / total as f64) * 100.0
        } else {
            0.0
        };

        SystemStats {
            memory_used_mb: (used_mb * 100.0).round() / 100.0,
            memory_total_mb: (total_mb * 100.0).round() / 100.0,
            memory_percentage: (percentage * 100.0).round() / 100.0,
            cpu_usage: (sys.global_cpu_usage() as f64 * 100.0).round() / 100.0,
        }
    })
    .await
    .map_err(|e| format!("Task error: {}", e))
}
