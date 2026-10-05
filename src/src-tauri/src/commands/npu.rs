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

    #[cfg(windows)]
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let output = Command::new("powershell")
        .args([
            "-NonInteractive",
            "-NoProfile",
            "-WindowStyle",
            "Hidden",
            "-Command",
            script,
        ])
        .creation_flags(CREATE_NO_WINDOW)
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

#[cfg(target_os = "linux")]
pub fn get_npu_stats() -> Result<NpuStats, String> {
    use std::fs;
    use std::sync::{Mutex, OnceLock};
    use std::time::Instant;

    #[derive(Clone, Copy)]
    struct Sample {
        usage_ns: u64,
        timestamp: Instant,
    }

    static PREVIOUS_SAMPLE: OnceLock<Mutex<Option<Sample>>> = OnceLock::new();

    let mut total_usage_ns = 0_u64;
    let mut total_memory_bytes = 0_u64;

    // amdxdna exposes cumulative per-process NPU time and memory through DRM
    // fdinfo. A process can have duplicate descriptors for the same device, so
    // use its largest counters before adding it to the system-wide total.
    let proc_entries = fs::read_dir("/proc").map_err(|e| format!("Failed to read /proc: {e}"))?;
    for proc_entry in proc_entries.flatten() {
        if !proc_entry
            .file_name()
            .to_string_lossy()
            .bytes()
            .all(|byte| byte.is_ascii_digit())
        {
            continue;
        }

        let fdinfo_path = proc_entry.path().join("fdinfo");
        let Ok(fdinfo_entries) = fs::read_dir(fdinfo_path) else {
            continue;
        };

        let mut process_usage_ns = 0_u64;
        let mut process_memory_bytes = 0_u64;
        for fdinfo_entry in fdinfo_entries.flatten() {
            let Ok(contents) = fs::read_to_string(fdinfo_entry.path()) else {
                continue;
            };
            if let Some((usage_ns, memory_bytes)) = parse_amdxdna_fdinfo(&contents) {
                process_usage_ns = process_usage_ns.max(usage_ns);
                process_memory_bytes = process_memory_bytes.max(memory_bytes);
            }
        }

        total_usage_ns = total_usage_ns.saturating_add(process_usage_ns);
        total_memory_bytes = total_memory_bytes.saturating_add(process_memory_bytes);
    }

    let now = Instant::now();
    let sample_state = PREVIOUS_SAMPLE.get_or_init(|| Mutex::new(None));
    let mut previous = sample_state
        .lock()
        .map_err(|_| "NPU sample state is unavailable".to_string())?;
    let usage = previous
        .as_ref()
        .and_then(|old| {
            let elapsed_ns = now.duration_since(old.timestamp).as_nanos();
            let delta_ns = total_usage_ns.checked_sub(old.usage_ns)? as f64;
            (elapsed_ns > 0).then_some((delta_ns / elapsed_ns as f64 * 100.0).clamp(0.0, 100.0))
        })
        .unwrap_or(0.0);
    *previous = Some(Sample {
        usage_ns: total_usage_ns,
        timestamp: now,
    });

    Ok(NpuStats {
        usage,
        memory_used: total_memory_bytes as f64 / 1024_f64.powi(3),
        memory_total: 0.0,
    })
}

#[cfg(target_os = "linux")]
fn parse_amdxdna_fdinfo(contents: &str) -> Option<(u64, u64)> {
    let mut is_amdxdna = false;
    let mut usage_ns = 0_u64;
    let mut memory_bytes = 0_u64;

    for line in contents.lines() {
        let Some((key, value)) = line.split_once(':') else {
            continue;
        };
        let value = value.trim();
        match key.trim() {
            "drm-driver" => is_amdxdna = value == "amdxdna_accel_driver",
            "drm-engine-npu-amdxdna" => {
                usage_ns = value
                    .split_whitespace()
                    .next()
                    .and_then(|number| number.parse().ok())
                    .unwrap_or(0);
            }
            "drm-total-memory" => {
                let mut parts = value.split_whitespace();
                let amount = parts
                    .next()
                    .and_then(|number| number.parse::<u64>().ok())
                    .unwrap_or(0);
                let multiplier = match parts.next() {
                    Some("GiB") => 1024_u64.pow(3),
                    Some("MiB") => 1024_u64.pow(2),
                    Some("KiB") => 1024,
                    _ => 1,
                };
                memory_bytes = amount.saturating_mul(multiplier);
            }
            _ => {}
        }
    }

    is_amdxdna.then_some((usage_ns, memory_bytes))
}

#[cfg(all(not(windows), not(target_os = "linux")))]
pub fn get_npu_stats() -> Result<NpuStats, String> {
    Ok(NpuStats {
        usage: 0.0,
        memory_used: 0.0,
        memory_total: 0.0,
    })
}

#[tauri::command]
pub async fn get_npu_info() -> Result<NpuStats, String> {
    tauri::async_runtime::spawn_blocking(get_npu_stats)
        .await
        .map_err(|e| format!("NPU monitoring task failed: {e}"))?
}

#[cfg(all(test, target_os = "linux"))]
mod tests {
    use super::parse_amdxdna_fdinfo;

    #[test]
    fn parses_amdxdna_counters() {
        let fdinfo = "drm-driver:\tamdxdna_accel_driver\n\
                      drm-engine-npu-amdxdna:\t1500000000 ns\n\
                      drm-total-memory:\t4096 KiB\n";

        assert_eq!(
            parse_amdxdna_fdinfo(fdinfo),
            Some((1_500_000_000, 4_194_304))
        );
    }

    #[test]
    fn ignores_other_drm_drivers() {
        let fdinfo = "drm-driver:\tamdgpu\n\
                      drm-engine-npu-amdxdna:\t1500000000 ns\n";

        assert_eq!(parse_amdxdna_fdinfo(fdinfo), None);
    }

    #[test]
    fn parses_memory_unit_changes() {
        let fdinfo = "drm-driver:\tamdxdna_accel_driver\n\
                      drm-total-memory:\t64 MiB\n";

        assert_eq!(parse_amdxdna_fdinfo(fdinfo), Some((0, 67_108_864)));
    }
}
