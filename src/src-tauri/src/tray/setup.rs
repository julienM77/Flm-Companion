// use tauri::image::Image;
use tauri::tray::TrayIconBuilder;
use tauri::{Manager, Theme};

use crate::tray::events::handle_menu_event;
use crate::tray::icons::ThemeIcons;
use crate::tray::menu::build_initial_menu;

pub fn init_tray(app: &tauri::App) -> tauri::Result<()> {
    let is_dark = app
        .get_webview_window("main")
        .map(|w| matches!(w.theme(), Ok(Theme::Dark)))
        .unwrap_or(false);

    let icons = ThemeIcons::load(is_dark);
    let menu = build_initial_menu(app, &icons)?;

    TrayIconBuilder::with_id("main")
        .icon(icons.tray.clone())
        .menu(&menu)
        .on_menu_event(|app, event| {
            handle_menu_event(app, event.id.as_ref());
        })
        .build(app)?;

    Ok(())
}
