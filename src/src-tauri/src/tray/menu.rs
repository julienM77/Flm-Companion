use tauri::menu::{CheckMenuItem, IconMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::AppHandle;

use crate::tray::icons::ThemeIcons;
use crate::types::TrayMenuParams;

struct UnifiedModel {
    name: String,
    is_installed: bool,
    is_startable: bool,
}

fn build_models_menu(
    app: &AppHandle,
    params: &TrayMenuParams,
    icons: &ThemeIcons,
) -> tauri::Result<Submenu<tauri::Wry>> {
    let texts = &params.texts;

    // Create a unified list of all models
    let mut unified_models = Vec::new();

    // Add installed models
    for model_name in &params.installed_models {
        unified_models.push(UnifiedModel {
            name: model_name.clone(),
            is_installed: true,
            is_startable: params.startable_models.contains(model_name),
        });
    }

    // Add available models (not installed)
    // Exclude those already in installed_models to avoid duplicates
    for model_name in &params.available_models {
        if !params.installed_models.contains(model_name) {
            unified_models.push(UnifiedModel {
                name: model_name.clone(),
                is_installed: false,
                is_startable: false,
            });
        }
    }

    // Sort alphabetically by name
    unified_models.sort_by(|a, b| a.name.cmp(&b.name));

    // Main Models menu
    let models_menu = Submenu::new(app, &texts.models_menu, true)?;
    let _ = models_menu.set_icon(Some(icons.cpu.clone()));

    // Create a submenu for each model
    for model in unified_models {
        let model_submenu = Submenu::new(app, &model.name, true)?;

        if model.is_installed {
            // Installed model: hard drive icon
            let _ = model_submenu.set_icon(Some(icons.hard_drive.clone()));

            if model.is_startable {
                // Action: Start Server
                let start_item = IconMenuItem::with_id(
                    app,
                    format!("start_model_{}", model.name),
                    &texts.start_with_model,
                    true,
                    Some(icons.play.clone()),
                    None::<&str>,
                )?;
                let _ = model_submenu.append(&start_item);
            }

            // Action: Delete
            let delete_item = IconMenuItem::with_id(
                app,
                format!("delete_model_{}", model.name),
                &texts.delete_model,
                true,
                Some(icons.trash.clone()),
                None::<&str>,
            )?;
            let _ = model_submenu.append(&delete_item);
        } else {
            // Available model: download icon
            let _ = model_submenu.set_icon(Some(icons.download.clone()));

            // Action: Download
            let download_item = IconMenuItem::with_id(
                app,
                format!("download_model_{}", model.name),
                &texts.download_model,
                true,
                Some(icons.download.clone()),
                None::<&str>,
            )?;
            let _ = model_submenu.append(&download_item);
        }

        let _ = models_menu.append(&model_submenu);
    }

    Ok(models_menu)
}

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

    // Presets submenu
    let presets_submenu = Submenu::new(app, &texts.presets_group, true)?;
    let _ = presets_submenu.set_icon(Some(icons.cog.clone()));

    for preset in &params.presets {
        let is_selected = preset.id == params.selected_model;
        let preset_item = CheckMenuItem::with_id(
            app,
            format!("model_{}", preset.id),
            &preset.name,
            true,
            is_selected,
            None::<&str>,
        )?;
        let _ = presets_submenu.append(&preset_item);
    }

    // Models submenu
    let models_submenu = Submenu::new(app, &texts.models_group, true)?;
    let _ = models_submenu.set_icon(Some(icons.cpu.clone()));

    if params.startable_models.is_empty() {
        // No models available, add disabled item
        let no_models_item = MenuItem::with_id(
            app,
            "no_models",
            &texts.no_models_available,
            false,
            None::<&str>,
        )?;
        let _ = models_submenu.append(&no_models_item);
    } else {
        // Add model items
        for model_name in &params.startable_models {
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
    }

    // Display current selection (preset name or model name)
    let current_model_text = if params.selected_model.is_empty() {
        String::from("—")
    } else if params.selected_model.starts_with("preset:") {
        // Find preset name
        params
            .presets
            .iter()
            .find(|p| p.id == params.selected_model)
            .map(|p| p.name.clone())
            .unwrap_or_else(|| params.selected_model.clone())
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
    let selection_sep = PredefinedMenuItem::separator(app)?;

    let server_submenu = Submenu::with_items(
        app,
        server_text,
        true,
        &[
            &current_model_i,
            &selection_sep,
            &presets_submenu,
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

    // FLM version display
    let flm_version_text = if params.flm_version.is_empty() {
        String::from("FLM: —")
    } else {
        format!("FLM {}", params.flm_version)
    };
    let flm_info_i = MenuItem::with_id(app, "flm_info", &flm_version_text, false, None::<&str>)?;

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

    // Build Models menu
    let models_menu = build_models_menu(app, params, icons)?;

    // Disable Models and Server menus if FLM is not available
    if !params.is_flm_available {
        let _ = models_menu.set_enabled(false);
        let _ = server_submenu.set_enabled(false);
    }

    let menu = Menu::new(app)?;
    menu.append(&app_info_i)?;
    menu.append(&flm_info_i)?;
    menu.append(&separator_top)?;
    menu.append(&models_menu)?;
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
