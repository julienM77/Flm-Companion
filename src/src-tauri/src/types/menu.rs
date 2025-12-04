use serde::Deserialize;

/// Preset item for tray menu
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayPreset {
    pub id: String,
    pub name: String,
}

/// Paramètres pour la mise à jour du menu tray
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayMenuParams {
    pub is_running: bool,
    pub selected_model: String,
    pub presets: Vec<TrayPreset>,
    pub installed_models: Vec<String>,
    pub asr_enabled: bool,
    pub embed_enabled: bool,
    pub flm_version: String,
    pub texts: TrayMenuTexts,
}

/// Textes localisés pour le menu tray
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
}
