use serde::{Deserialize, Serialize};
use sysinfo::System;

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemStats {
    pub memory_used_mb: f64,
    pub memory_total_mb: f64,
    pub memory_percentage: f64,
    pub cpu_usage: f64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareInfo {
    pub cpu: String,
    pub ram: String,
    pub ram_total_bytes: u64,
    pub shared_memory: String,
    pub shared_memory_bytes: u64,
    pub npu_name: String,
    pub npu_driver: String,
}

#[cfg(target_os = "linux")]
fn read_trimmed(path: &str) -> Option<String> {
    std::fs::read_to_string(path)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

#[tauri::command]
pub async fn get_hardware_info() -> Result<HardwareInfo, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let sys = System::new_all();
        let total = sys.total_memory();
        let total_gib = total as f64 / 1024.0 / 1024.0 / 1024.0;
        let shared = total / 2;
        let shared_gib = shared as f64 / 1024.0 / 1024.0 / 1024.0;
        let cpu = sys
            .cpus()
            .first()
            .map(|cpu| cpu.brand().trim().to_string())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| "Unknown".to_string());

        #[cfg(target_os = "linux")]
        let (npu_name, npu_driver) = {
            let name = read_trimmed("/sys/class/accel/accel0/device/vbnv")
                .unwrap_or_else(|| "AMD Ryzen AI NPU".to_string());
            let firmware = read_trimmed("/sys/class/accel/accel0/device/fw_version")
                .map(|version| format!("amdxdna (firmware {version})"))
                .unwrap_or_else(|| "amdxdna".to_string());

            if std::path::Path::new("/dev/accel/accel0").exists() {
                (name, firmware)
            } else {
                ("Not detected".to_string(), "Not detected".to_string())
            }
        };

        #[cfg(not(target_os = "linux"))]
        let (npu_name, npu_driver) = ("Unknown".to_string(), "Unknown".to_string());

        HardwareInfo {
            cpu,
            ram: format!("{total_gib:.1} GB"),
            ram_total_bytes: total,
            shared_memory: format!("{shared_gib:.1} GB (Max)"),
            shared_memory_bytes: shared,
            npu_name,
            npu_driver,
        }
    })
    .await
    .map_err(|e| format!("Task error: {e}"))
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
