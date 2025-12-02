use tauri::menu::{CheckMenuItem, IconMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::AppHandle;

use crate::tray::icons::ThemeIcons;
use crate::types::TrayMenuParams;

pub fn build_tray_menu(
    app: &AppHandle,
    params: &TrayMenuParams,
    icons: &ThemeIcons,
) -> tauri::Result<Menu<tauri::Wry>> {
    let texts = &params.texts;

    let status_icon = icons.status_icon(params.is_running);

    let server_text = if params.is_running {
        &texts.running
    } else {
        &texts.stopped
    };

    let start_i = IconMenuItem::with_id(
        app,
        "start_server",
        &texts.start,
        true,
        Some(icons.play.clone()),
        None::<&str>,
    )?;
    let stop_i = IconMenuItem::with_id(
        app,
        "stop_server",
        &texts.stop,
        true,
        Some(icons.stop.clone()),
        None::<&str>,
    )?;

    let _ = start_i.set_enabled(!params.is_running);
    let _ = stop_i.set_enabled(params.is_running);

    let models_submenu = Submenu::new(app, &texts.select_model, true)?;
    let _ = models_submenu.set_icon(Some(icons.cpu.clone()));

    for model_name in &params.installed_models {
        let is_selected = model_name == &params.selected_model;
        let model_item = CheckMenuItem::with_id(
            app,
            format!("model_{}", model_name),
            model_name,
            true,
            is_selected,
            None::<&str>,
        )?;
        let _ = models_submenu.append(&model_item);
    }

    let current_model_text = if params.selected_model.is_empty() {
        String::from("—")
    } else {
        params.selected_model.clone()
    };
    let current_model_i = MenuItem::with_id(
        app,
        "current_model",
        &current_model_text,
        false,
        None::<&str>,
    )?;

    let view_logs_i = IconMenuItem::with_id(
        app,
        "view_logs",
        &texts.view_logs,
        true,
        Some(icons.file_clock.clone()),
        None::<&str>,
    )?;

    let asr_item = CheckMenuItem::with_id(
        app,
        "toggle_asr",
        &texts.asr,
        true,
        params.asr_enabled,
        None::<&str>,
    )?;
    let embed_item = CheckMenuItem::with_id(
        app,
        "toggle_embed",
        &texts.embed,
        true,
        params.embed_enabled,
        None::<&str>,
    )?;
    let features_submenu =
        Submenu::with_items(app, &texts.features, true, &[&asr_item, &embed_item])?;
    let _ = features_submenu.set_icon(Some(icons.cog.clone()));

    let server_sep1 = PredefinedMenuItem::separator(app)?;
    let server_sep2 = PredefinedMenuItem::separator(app)?;

    let server_submenu = Submenu::with_items(
        app,
        server_text,
        true,
        &[
            &current_model_i,
            &models_submenu,
            &features_submenu,
            &server_sep1,
            &start_i,
            &stop_i,
            &server_sep2,
            &view_logs_i,
        ],
    )?;
    let _ = server_submenu.set_icon(Some(status_icon));

    let package_info = app.package_info();
    let title = format!("{} v{}", package_info.name, package_info.version);
    let app_info_i = MenuItem::with_id(app, "app_info", &title, false, None::<&str>)?;
    let separator_top = PredefinedMenuItem::separator(app)?;

    let settings_i = IconMenuItem::with_id(
        app,
        "settings",
        &texts.settings,
        true,
        Some(icons.cog.clone()),
        None::<&str>,
    )?;

    let quit_i = IconMenuItem::with_id(
        app,
        "quit",
        &texts.quit,
        true,
        Some(icons.power.clone()),
        None::<&str>,
    )?;
    let separator = PredefinedMenuItem::separator(app)?;

    let menu = Menu::new(app)?;
    menu.append(&app_info_i)?;
    menu.append(&separator_top)?;
    menu.append(&server_submenu)?;
    menu.append(&settings_i)?;
    menu.append(&separator)?;
    menu.append(&quit_i)?;

    Ok(menu)
}

pub fn build_initial_menu(app: &tauri::App, icons: &ThemeIcons) -> tauri::Result<Menu<tauri::Wry>> {
    let package_info = app.package_info();
    let title = format!("{} v{}", package_info.name, package_info.version);
    let app_info_i = MenuItem::with_id(app, "app_info", &title, false, None::<&str>)?;
    let separator_top = PredefinedMenuItem::separator(app)?;

    let settings_i = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;

    let quit_i = IconMenuItem::with_id(
        app,
        "quit",
        "Quit",
        true,
        Some(icons.power.clone()),
        None::<&str>,
    )?;
    let separator = PredefinedMenuItem::separator(app)?;

    let start_i = IconMenuItem::with_id(
        app,
        "start_server",
        "Start",
        true,
        Some(icons.play.clone()),
        None::<&str>,
    )?;
    let stop_i = IconMenuItem::with_id(
        app,
        "stop_server",
        "Stop",
        true,
        Some(icons.stop.clone()),
        None::<&str>,
    )?;
    let _ = stop_i.set_enabled(false);

    let server_submenu = Submenu::with_items(app, "Server (Stopped)", true, &[&start_i, &stop_i])?;
    let _ = server_submenu.set_icon(Some(icons.red.clone()));

    let menu = Menu::new(app)?;
    menu.append(&app_info_i)?;
    menu.append(&separator_top)?;
    menu.append(&settings_i)?;
    menu.append(&server_submenu)?;
    menu.append(&separator)?;
    menu.append(&quit_i)?;

    Ok(menu)
}
