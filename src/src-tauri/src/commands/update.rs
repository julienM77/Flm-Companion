#[cfg(target_os = "linux")]
use flate2::read::GzDecoder;
#[cfg(target_os = "linux")]
use std::fs;
#[cfg(target_os = "linux")]
use std::io;
#[cfg(target_os = "linux")]
use std::os::unix::fs::PermissionsExt;
#[cfg(target_os = "linux")]
use std::path::{Path, PathBuf};
#[cfg(target_os = "linux")]
use std::process::Command;
#[cfg(target_os = "linux")]
use std::time::{SystemTime, UNIX_EPOCH};
#[cfg(target_os = "linux")]
use tar::Archive;

#[cfg(target_os = "linux")]
fn home_dir() -> Result<PathBuf, String> {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| "HOME is not available".to_string())
}

#[cfg(target_os = "linux")]
fn verify_temp_archive(path: &Path) -> Result<PathBuf, String> {
    if !path
        .file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.ends_with("_linux.tar.gz"))
    {
        return Err("The selected release asset is not a FastFlowLM Linux archive".to_string());
    }

    let archive = path
        .canonicalize()
        .map_err(|error| format!("Could not access the downloaded archive: {error}"))?;
    let temp = std::env::temp_dir()
        .canonicalize()
        .map_err(|error| format!("Could not access the temporary directory: {error}"))?;
    if !archive.starts_with(temp) {
        return Err("The downloaded archive is outside the temporary directory".to_string());
    }

    Ok(archive)
}

#[cfg(target_os = "linux")]
fn remove_dir_if_present(path: &Path) -> Result<(), String> {
    match fs::remove_dir_all(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Could not remove {}: {error}", path.display())),
    }
}

#[cfg(target_os = "linux")]
fn install_linux_archive(archive_path: &Path, expected_version: &str) -> Result<(), String> {
    let archive_path = verify_temp_archive(archive_path)?;
    let expected_version = expected_version.trim().trim_start_matches('v');
    if expected_version.is_empty()
        || !expected_version
            .chars()
            .all(|character| character.is_ascii_digit() || character == '.')
    {
        return Err("The release version is invalid".to_string());
    }

    let home = home_dir()?;
    let share_dir = home.join(".local/share");
    let bin_dir = home.join(".local/bin");
    let target = share_dir.join("fastflowlm");
    let previous = share_dir.join("fastflowlm.previous");
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_nanos();
    let staging = share_dir.join(format!(
        ".fastflowlm-install-{}-{nonce}",
        std::process::id()
    ));

    fs::create_dir_all(&staging)
        .map_err(|error| format!("Could not create the installation directory: {error}"))?;

    let extraction_result = (|| -> Result<(), String> {
        let file = fs::File::open(&archive_path)
            .map_err(|error| format!("Could not open the downloaded archive: {error}"))?;
        Archive::new(GzDecoder::new(file))
            .unpack(&staging)
            .map_err(|error| format!("Could not extract the FastFlowLM archive: {error}"))?;

        for required in ["flm", "flm-real", "lib", "model_list.json"] {
            if !staging.join(required).exists() {
                return Err(format!("The FastFlowLM archive is missing {required}"));
            }
        }
        Ok(())
    })();

    if let Err(error) = extraction_result {
        let _ = remove_dir_if_present(&staging);
        return Err(error);
    }

    remove_dir_if_present(&previous)?;
    let had_existing_install = target.exists();
    if had_existing_install {
        fs::rename(&target, &previous).map_err(|error| {
            format!("Could not back up the current FastFlowLM install: {error}")
        })?;
    }

    if let Err(error) = fs::rename(&staging, &target) {
        if had_existing_install {
            let _ = fs::rename(&previous, &target);
        }
        let _ = remove_dir_if_present(&staging);
        return Err(format!("Could not activate the FastFlowLM update: {error}"));
    }

    let verification = Command::new(target.join("flm"))
        .arg("--version")
        .output()
        .map_err(|error| format!("Could not run the updated FastFlowLM: {error}"))
        .and_then(|output| {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if stdout.contains(expected_version) {
                Ok(())
            } else {
                Err(format!(
                    "The updated FastFlowLM reported an unexpected version: {}",
                    stdout.trim()
                ))
            }
        });

    if let Err(error) = verification {
        let _ = remove_dir_if_present(&target);
        if had_existing_install {
            let _ = fs::rename(&previous, &target);
        }
        return Err(error);
    }

    fs::create_dir_all(&bin_dir)
        .map_err(|error| format!("Could not create {}: {error}", bin_dir.display()))?;
    let launcher = bin_dir.join("flm");
    let launcher_temp = bin_dir.join(".flm-companion-update");
    fs::write(
        &launcher_temp,
        b"#!/bin/sh\nexec \"$HOME/.local/share/fastflowlm/flm\" \"$@\"\n",
    )
    .map_err(|error| format!("Could not write the FLM launcher: {error}"))?;
    fs::set_permissions(&launcher_temp, fs::Permissions::from_mode(0o755))
        .map_err(|error| format!("Could not make the FLM launcher executable: {error}"))?;
    fs::rename(&launcher_temp, &launcher)
        .map_err(|error| format!("Could not activate the FLM launcher: {error}"))?;

    Ok(())
}

#[tauri::command]
pub async fn install_flm_linux(
    archive_path: String,
    expected_version: String,
) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        tauri::async_runtime::spawn_blocking(move || {
            install_linux_archive(Path::new(&archive_path), &expected_version)
        })
        .await
        .map_err(|error| format!("FastFlowLM installation task failed: {error}"))?
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = (archive_path, expected_version);
        Err("The portable FastFlowLM installer is only available on Linux".to_string())
    }
}
