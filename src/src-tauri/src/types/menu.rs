use serde::Deserialize;

/// Preset item for tray menu
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayPreset {
    pub id: String,
    pub name: String,
    pub is_system: bool,
}

/// Parameters for tray menu update
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayMenuParams {
    pub is_running: bool,
    pub selected_model: String,
    pub presets: Vec<TrayPreset>,
    pub installed_models: Vec<String>,
    pub available_models: Vec<String>,
    pub startable_models: Vec<String>,
    pub asr_enabled: bool,
    pub embed_enabled: bool,
    pub flm_version: String,
    pub is_flm_available: bool,
    pub texts: TrayMenuTexts,
}

/// Localized texts for tray menu
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayMenuTexts {
    pub start: String,
    pub stop: String,
    pub quit: String,
    pub settings: String,
    pub running: String,
    pub stopped: String,
    pub view_logs: String,
    pub features: String,
    pub asr: String,
    pub embed: String,
    pub presets_group: String,
    pub models_group: String,
    pub models_menu: String,
    pub no_models_available: String,
    pub start_with_model: String,
    pub delete_model: String,
    pub download_model: String,
}
