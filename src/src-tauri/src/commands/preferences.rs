use std::fs;
use std::io::ErrorKind;
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Manager};

static CONFIG_WRITE_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

fn config_file(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let directory = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("Could not resolve app config directory: {error}"))?;
    Ok(directory.join("config.json"))
}

#[tauri::command]
pub fn load_app_config(app: AppHandle) -> Result<Option<String>, String> {
    let path = config_file(&app)?;
    match fs::read_to_string(&path) {
        Ok(contents) => Ok(Some(contents)),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("Could not read {}: {error}", path.display())),
    }
}

#[tauri::command]
pub fn save_app_config(app: AppHandle, contents: String) -> Result<(), String> {
    let path = config_file(&app)?;
    let _guard = CONFIG_WRITE_LOCK
        .get_or_init(|| Mutex::new(()))
        .lock()
        .map_err(|error| format!("Could not lock app config: {error}"))?;
    let directory = path
        .parent()
        .ok_or_else(|| "App config path has no parent directory".to_string())?;
    fs::create_dir_all(directory)
        .map_err(|error| format!("Could not create {}: {error}", directory.display()))?;
    fs::write(&path, contents)
        .map_err(|error| format!("Could not write {}: {error}", path.display()))
}
