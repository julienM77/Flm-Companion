use tauri::image::Image;
use tauri::menu::{CheckMenuItem, IconMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, Theme};

fn get_theme_icons(
    is_dark: bool,
) -> (
    Image<'static>,
    Image<'static>,
    Image<'static>,
    Image<'static>,
    Image<'static>,
    Image<'static>,
    Image<'static>,
    Image<'static>,
) {
    if is_dark {
        (
            Image::from_bytes(include_bytes!("../icons/dark/play.png"))
                .expect("failed to load dark/play.png"),
            Image::from_bytes(include_bytes!("../icons/dark/square.png"))
                .expect("failed to load dark/square.png"),
            Image::from_bytes(include_bytes!("../icons/dark/power.png"))
                .expect("failed to load dark/power.png"),
            Image::from_bytes(include_bytes!("../icons/dark/red.png"))
                .expect("failed to load dark/red.png"),
            Image::from_bytes(include_bytes!("../icons/dark/green.png"))
                .expect("failed to load dark/green.png"),
            Image::from_bytes(include_bytes!("../icons/dark/cog.png"))
                .expect("failed to load dark/cog.png"),
            Image::from_bytes(include_bytes!("../icons/dark/cpu.png"))
                .expect("failed to load dark/cpu.png"),
            Image::from_bytes(include_bytes!("../icons/dark/file-clock.png"))
                .expect("failed to load dark/file-clock.png"),
        )
    } else {
        (
            Image::from_bytes(include_bytes!("../icons/light/play.png"))
                .expect("failed to load light/play.png"),
            Image::from_bytes(include_bytes!("../icons/light/square.png"))
                .expect("failed to load light/square.png"),
            Image::from_bytes(include_bytes!("../icons/light/power.png"))
                .expect("failed to load light/power.png"),
            Image::from_bytes(include_bytes!("../icons/light/red.png"))
                .expect("failed to load light/red.png"),
            Image::from_bytes(include_bytes!("../icons/light/green.png"))
                .expect("failed to load light/green.png"),
            Image::from_bytes(include_bytes!("../icons/light/cog.png"))
                .expect("failed to load light/cog.png"),
            Image::from_bytes(include_bytes!("../icons/light/cpu.png"))
                .expect("failed to load light/cpu.png"),
            Image::from_bytes(include_bytes!("../icons/light/file-clock.png"))
                .expect("failed to load light/file-clock.png"),
        )
    }
}

#[tauri::command]
fn update_tray_menu(
    app: AppHandle,
    is_running: bool,
    selected_model: String,
    installed_models: Vec<String>,
    asr_enabled: bool,
    embed_enabled: bool,
    text_start: String,
    text_stop: String,
    text_quit: String,
    text_settings: String,
    text_running: String,
    text_stopped: String,
    text_select_model: String,
    text_view_logs: String,
    text_features: String,
    text_asr: String,
    text_embed: String,
) {
    let server_text = if is_running {
        text_running
    } else {
        text_stopped
    };

    let is_dark = app
        .get_webview_window("main")
        .map(|w| matches!(w.theme(), Ok(Theme::Dark)))
        .unwrap_or(false);
    let (
        play_icon,
        stop_icon,
        power_icon,
        red_icon,
        green_icon,
        cog_icon,
        cpu_icon,
        file_clock_icon,
    ) = get_theme_icons(is_dark);

    let status_icon = if is_running { green_icon } else { red_icon };

    let start_i = IconMenuItem::with_id(
        &app,
        "start_server",
        &text_start,
        true,
        Some(play_icon),
        None::<&str>,
    )
    .unwrap();
    let stop_i = IconMenuItem::with_id(
        &app,
        "stop_server",
        &text_stop,
        true,
        Some(stop_icon),
        None::<&str>,
    )
    .unwrap();

    let _ = start_i.set_enabled(!is_running);
    let _ = stop_i.set_enabled(is_running);

    // Create model selection submenu
    let models_submenu = Submenu::new(&app, &text_select_model, true).unwrap();
    let _ = models_submenu.set_icon(Some(cpu_icon));
    for model_name in &installed_models {
        let is_selected = model_name == &selected_model;
        let model_item = CheckMenuItem::with_id(
            &app,
            format!("model_{}", model_name),
            model_name,
            true,
            is_selected,
            None::<&str>,
        )
        .unwrap();
        let _ = models_submenu.append(&model_item);
    }

    // Current model display (non-clickable)
    let current_model_text = if selected_model.is_empty() {
        String::from("—")
    } else {
        selected_model.clone()
    };
    let current_model_i = MenuItem::with_id(
        &app,
        "current_model",
        &current_model_text,
        false,
        None::<&str>,
    )
    .unwrap();

    let view_logs_i = IconMenuItem::with_id(
        &app,
        "view_logs",
        &text_view_logs,
        true,
        Some(file_clock_icon),
        None::<&str>,
    )
    .unwrap();

    // Features submenu with ASR and Embeddings
    let asr_item = CheckMenuItem::with_id(
        &app,
        "toggle_asr",
        &text_asr,
        true,
        asr_enabled,
        None::<&str>,
    )
    .unwrap();
    let embed_item = CheckMenuItem::with_id(
        &app,
        "toggle_embed",
        &text_embed,
        true,
        embed_enabled,
        None::<&str>,
    )
    .unwrap();
    let features_submenu =
        Submenu::with_items(&app, &text_features, true, &[&asr_item, &embed_item]).unwrap();
    let _ = features_submenu.set_icon(Some(cog_icon.clone()));

    // Separators for server submenu
    let server_sep1 = PredefinedMenuItem::separator(&app).unwrap();
    let server_sep2 = PredefinedMenuItem::separator(&app).unwrap();

    // Server submenu with all server-related items
    let server_submenu = Submenu::with_items(
        &app,
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
    )
    .unwrap();
    let _ = server_submenu.set_icon(Some(status_icon));

    let package_info = app.package_info();
    let title = format!("{} v{}", package_info.name, package_info.version);
    let app_info_i = MenuItem::with_id(&app, "app_info", &title, false, None::<&str>).unwrap();
    let separator_top = PredefinedMenuItem::separator(&app).unwrap();

    let settings_i = IconMenuItem::with_id(
        &app,
        "settings",
        &text_settings,
        true,
        Some(cog_icon),
        None::<&str>,
    )
    .unwrap();

    let quit_i = IconMenuItem::with_id(
        &app,
        "quit",
        &text_quit,
        true,
        Some(power_icon),
        None::<&str>,
    )
    .unwrap();
    let separator = PredefinedMenuItem::separator(&app).unwrap();

    let menu = Menu::new(&app).unwrap();
    menu.append(&app_info_i).unwrap();
    menu.append(&separator_top).unwrap();
    menu.append(&server_submenu).unwrap();
    menu.append(&settings_i).unwrap();
    menu.append(&separator).unwrap();
    menu.append(&quit_i).unwrap();

    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_menu(Some(menu));
    }
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            // When a second instance is launched, show and focus the existing window
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
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let is_dark = app
                .get_webview_window("main")
                .map(|w| matches!(w.theme(), Ok(Theme::Dark)))
                .unwrap_or(false);
            let (
                play_icon,
                stop_icon,
                power_icon,
                red_icon,
                _green_icon,
                _cog_icon,
                _cpu_icon,
                _file_clock_icon,
            ) = get_theme_icons(is_dark);

            let package_info = app.package_info();
            let title = format!("{} v{}", package_info.name, package_info.version);
            let app_info_i = MenuItem::with_id(app, "app_info", &title, false, None::<&str>)?;
            let separator_top = PredefinedMenuItem::separator(app)?;

            let settings_i = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;

            let quit_i =
                IconMenuItem::with_id(app, "quit", "Quit", true, Some(power_icon), None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;

            let start_i = IconMenuItem::with_id(
                app,
                "start_server",
                "Start",
                true,
                Some(play_icon),
                None::<&str>,
            )?;
            let stop_i = IconMenuItem::with_id(
                app,
                "stop_server",
                "Stop",
                true,
                Some(stop_icon),
                None::<&str>,
            )?;
            let _ = stop_i.set_enabled(false);

            let server_submenu =
                Submenu::with_items(app, "Server (Stopped)", true, &[&start_i, &stop_i])?;
            let _ = server_submenu.set_icon(Some(red_icon));

            let menu = Menu::new(app)?;
            menu.append(&app_info_i)?;
            menu.append(&separator_top)?;
            menu.append(&settings_i)?;
            menu.append(&server_submenu)?;
            menu.append(&separator)?;
            menu.append(&quit_i)?;

            let icon = Image::from_bytes(include_bytes!("../icons/icon.png"))
                .expect("failed to load icon");

            TrayIconBuilder::with_id("main")
                .icon(icon)
                .menu(&menu)
                .on_menu_event(|app, event| {
                    let event_id = event.id.as_ref();
                    match event_id {
                        "quit" => {
                            // Close the window properly before exiting to avoid Chrome_WidgetWin error
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.destroy();
                            }
                            app.exit(0);
                        }
                        "settings" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.unminimize();
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "view_logs" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.unminimize();
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                            let _ = app.emit("view-logs", ());
                        }
                        "start_server" => {
                            let _ = app.emit("request-start-server", ());
                        }
                        "stop_server" => {
                            let _ = app.emit("request-stop-server", ());
                        }
                        id if id.starts_with("model_") => {
                            let model_name = id.strip_prefix("model_").unwrap_or("");
                            let _ = app.emit("select-model", model_name);
                        }
                        "toggle_asr" => {
                            let _ = app.emit("toggle-asr", ());
                        }
                        "toggle_embed" => {
                            let _ = app.emit("toggle-embed", ());
                        }
                        _ => {}
                    }
                })
                .build(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet, update_tray_menu])
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                window.hide().unwrap();
                api.prevent_close();
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
