use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct NpuStats {
    pub usage: f64,
    pub memory_used: f64,
    pub memory_total: f64,
}

#[cfg(windows)]
pub fn get_npu_stats() -> Result<NpuStats, String> {
    use std::process::Command;

    // Use PowerShell to query GPU Engine performance counters
    // AMD NPU appears as GPU Engine on Windows
    let script = r#"
        try {
            $counters = Get-Counter -Counter '\GPU Engine(*)\Utilization Percentage' -ErrorAction Stop
            $maxUtil = ($counters.CounterSamples | Measure-Object -Property CookedValue -Maximum).Maximum
            
            # Try to get memory info
            $memCounters = Get-Counter -Counter '\GPU Adapter Memory(*)\Dedicated Usage' -ErrorAction SilentlyContinue
            $memUsed = 0
            if ($memCounters) {
                $memUsed = ($memCounters.CounterSamples | Select-Object -First 1).CookedValue / 1GB
            }
            
            Write-Output "$maxUtil;$memUsed;0"
        } catch {
            Write-Output "0;0;0"
        }
    "#;

    let output = Command::new("powershell")
        .args(["-NoProfile", "-Command", script])
        .output()
        .map_err(|e| format!("Failed to execute PowerShell: {}", e))?;

    if !output.status.success() {
        return Err("PowerShell command failed".to_string());
    }

    let output_str = String::from_utf8_lossy(&output.stdout);
    let parts: Vec<&str> = output_str.trim().split(';').collect();

    if parts.len() >= 3 {
        let usage = parts[0].parse::<f64>().unwrap_or(0.0).clamp(0.0, 100.0);
        let memory_used = parts[1].parse::<f64>().unwrap_or(0.0).max(0.0);
        let memory_total = parts[2].parse::<f64>().unwrap_or(0.0).max(0.0);

        Ok(NpuStats {
            usage,
            memory_used,
            memory_total,
        })
    } else {
        Err("Invalid output format".to_string())
    }
}

#[cfg(not(windows))]
pub fn get_npu_stats() -> Result<NpuStats, String> {
    Err("NPU stats only available on Windows".to_string())
}

#[tauri::command]
pub async fn get_npu_info() -> Result<NpuStats, String> {
    get_npu_stats()
}
