mod commands;
mod tray;
mod types;

use tauri::Manager;

#[cfg(target_os = "linux")]
fn include_user_local_bin_in_path() {
    let Some(home) = std::env::var_os("HOME") else {
        return;
    };

    let local_bin = std::path::PathBuf::from(home).join(".local/bin");
    let mut paths: Vec<_> = std::env::var_os("PATH")
        .as_deref()
        .map(std::env::split_paths)
        .into_iter()
        .flatten()
        .collect();

    if !paths.iter().any(|path| path == &local_bin) {
        paths.insert(0, local_bin);
        if let Ok(path) = std::env::join_paths(paths) {
            std::env::set_var("PATH", path);
        }
    }
}

#[cfg(target_os = "linux")]
fn configure_webkit_runtime() {
    // WebKitGTK can create a window without painting its webview on some
    // Wayland/AMD combinations. Allow an explicit user override, otherwise
    // use the reliable software-compositing path.
    if std::env::var_os("WEBKIT_DISABLE_COMPOSITING_MODE").is_none() {
        std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    {
        include_user_local_bin_in_path();
        configure_webkit_runtime();
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            tray::init_tray(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::update_tray_menu,
            commands::quit_app,
            commands::configure_opencode,
            commands::install_flm_linux,
            commands::get_npu_info,
            commands::get_system_stats,
            commands::get_hardware_info,
            commands::load_app_config,
            commands::save_app_config
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
