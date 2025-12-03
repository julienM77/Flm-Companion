use tauri::{AppHandle, Manager, Theme};

use crate::tray::icons::ThemeIcons;
use crate::tray::menu::build_tray_menu;
use crate::types::TrayMenuParams;

#[tauri::command]
pub fn update_tray_menu(app: AppHandle, params: TrayMenuParams) {
    let is_dark = app
        .get_webview_window("main")
        .map(|w| matches!(w.theme(), Ok(Theme::Dark)))
        .unwrap_or(false);

    let icons = ThemeIcons::load(is_dark);

    if let Ok(menu) = build_tray_menu(&app, &params, &icons) {
        if let Some(tray) = app.tray_by_id("main") {
            let _ = tray.set_menu(Some(menu));
        }
    }
}
