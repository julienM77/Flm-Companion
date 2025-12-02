use tauri::{AppHandle, Emitter, Manager};

pub fn handle_menu_event(app: &AppHandle, event_id: &str) {
    match event_id {
        "quit" => handle_quit(app),
        "settings" => handle_show_window(app),
        "view_logs" => handle_view_logs(app),
        "start_server" => {
            let _ = app.emit("request-start-server", ());
        }
        "stop_server" => {
            let _ = app.emit("request-stop-server", ());
        }
        "toggle_asr" => {
            let _ = app.emit("toggle-asr", ());
        }
        "toggle_embed" => {
            let _ = app.emit("toggle-embed", ());
        }
        id if id.starts_with("model_") => {
            if let Some(model_name) = id.strip_prefix("model_") {
                let _ = app.emit("select-model", model_name);
            }
        }
        _ => {}
    }
}

fn handle_quit(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.destroy();
    }
    app.exit(0);
}

fn handle_show_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn handle_view_logs(app: &AppHandle) {
    handle_show_window(app);
    let _ = app.emit("view-logs", ());
}
