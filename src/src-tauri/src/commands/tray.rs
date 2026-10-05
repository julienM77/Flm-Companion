use tauri::{AppHandle, Manager};

use crate::tray::icons::ThemeIcons;
use crate::tray::menu::build_tray_menu;
use crate::types::TrayMenuParams;

#[tauri::command]
pub fn update_tray_menu(app: AppHandle, params: TrayMenuParams) {
    let icons = ThemeIcons::load(params.is_dark_theme);

    if let Ok(menu) = build_tray_menu(&app, &params, &icons) {
        if let Some(tray) = app.tray_by_id("main") {
            let _ = tray.set_icon(Some(icons.tray.clone()));
            let _ = tray.set_menu(Some(menu));
        }
    }
}

#[tauri::command]
pub fn quit_app(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.destroy();
    }
    app.exit(0);
}
