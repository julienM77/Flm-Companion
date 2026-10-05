use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

const PROVIDER_ID: &str = "flm-companion";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpencodeRequest {
    pub base_url: String,
    pub models: Vec<String>,
    pub write: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpencodeIntegrationResult {
    pub installed: bool,
    pub configured: bool,
    pub wrote_config: bool,
    pub config_path: String,
    pub snippet: String,
    pub error: Option<String>,
}

fn find_executable(name: &str) -> Option<PathBuf> {
    let executable_names: Vec<String> = if cfg!(windows) {
        vec![
            format!("{name}.exe"),
            format!("{name}.cmd"),
            name.to_string(),
        ]
    } else {
        vec![name.to_string()]
    };

    if let Some(path) = env::var_os("PATH") {
        for directory in env::split_paths(&path) {
            for executable_name in &executable_names {
                let candidate = directory.join(executable_name);
                if candidate.is_file() {
                    return Some(candidate);
                }
            }
        }
    }

    let mut common_directories = vec![
        PathBuf::from("/usr/local/bin"),
        PathBuf::from("/usr/bin"),
        PathBuf::from("/home/linuxbrew/.linuxbrew/bin"),
    ];
    if let Some(home) = home_dir() {
        common_directories.push(home.join(".local/bin"));
        common_directories.push(home.join(".opencode/bin"));
    }

    common_directories.into_iter().find_map(|directory| {
        executable_names.iter().find_map(|executable_name| {
            let candidate = directory.join(executable_name);
            candidate.is_file().then_some(candidate)
        })
    })
}

fn home_dir() -> Option<PathBuf> {
    env::var_os("HOME")
        .or_else(|| env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

fn config_directory() -> PathBuf {
    if let Some(xdg_config) = env::var_os("XDG_CONFIG_HOME") {
        return PathBuf::from(xdg_config).join("opencode");
    }

    if let Some(home) = home_dir() {
        return home.join(".config/opencode");
    }

    if let Some(app_data) = env::var_os("APPDATA") {
        return PathBuf::from(app_data).join("opencode");
    }

    PathBuf::from(".config/opencode")
}

fn config_path() -> PathBuf {
    let directory = config_directory();
    let jsonc = directory.join("opencode.jsonc");
    let json = directory.join("opencode.json");

    if jsonc.is_file() {
        jsonc
    } else {
        json
    }
}

fn uses_v2_schema(executable: Option<&Path>, root: Option<&Value>) -> bool {
    if root
        .and_then(Value::as_object)
        .is_some_and(|object| object.contains_key("providers"))
    {
        return true;
    }

    executable
        .and_then(|path| Command::new(path).arg("--version").output().ok())
        .filter(|output| output.status.success())
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .and_then(|version| version.trim().split('.').next()?.parse::<u64>().ok())
        .is_some_and(|major| major >= 2)
}

fn provider_config(base_url: &str, models: &[String], v2: bool) -> Value {
    let models = models
        .iter()
        .map(|model| {
            let details = if v2 {
                json!({ "name": model, "modelID": model })
            } else {
                json!({ "name": model })
            };
            (model.clone(), details)
        })
        .collect::<Map<String, Value>>();

    if v2 {
        json!({
            "name": "FastFlowLM (local)",
            "package": "@opencode/ai/providers/openai-compatible",
            "settings": { "baseURL": base_url },
            "models": models
        })
    } else {
        json!({
            "name": "FastFlowLM (local)",
            "npm": "@ai-sdk/openai-compatible",
            "options": { "baseURL": base_url },
            "models": models
        })
    }
}

fn create_backup(path: &Path) -> Result<(), String> {
    if !path.is_file() {
        return Ok(());
    }

    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("opencode.json");

    for index in 0..100 {
        let suffix = if index == 0 {
            String::new()
        } else {
            format!(".{index}")
        };
        let backup = path.with_file_name(format!("{file_name}.flm-companion.bak{suffix}"));
        if !backup.exists() {
            fs::copy(path, backup).map_err(|error| error.to_string())?;
            return Ok(());
        }
    }

    Err("Could not create a unique backup file".to_string())
}

#[tauri::command]
pub fn configure_opencode(request: OpencodeRequest) -> OpencodeIntegrationResult {
    let executable = find_executable("opencode");
    let installed = executable.is_some();
    let path = config_path();
    let existing_text = fs::read_to_string(&path).ok();
    let parsed = existing_text
        .as_deref()
        .map(serde_json::from_str::<Value>)
        .transpose();

    let mut models: Vec<String> = request
        .models
        .into_iter()
        .map(|model| model.trim().to_string())
        .filter(|model| !model.is_empty() && !model.starts_with("preset:"))
        .collect();
    models.sort();
    models.dedup();

    let parsed_root = parsed.as_ref().ok().and_then(|value| value.as_ref());
    let v2 = uses_v2_schema(executable.as_deref(), parsed_root);
    let provider = provider_config(request.base_url.trim_end_matches('/'), &models, v2);
    let provider_key = if v2 { "providers" } else { "provider" };
    let mut snippet_providers = Map::new();
    snippet_providers.insert(PROVIDER_ID.to_string(), provider.clone());
    let mut snippet_root = Map::new();
    snippet_root.insert(provider_key.to_string(), Value::Object(snippet_providers));
    let snippet = serde_json::to_string_pretty(&Value::Object(snippet_root)).unwrap_or_default();

    let configured = parsed_root
        .and_then(|root| root.get(provider_key))
        .and_then(Value::as_object)
        .is_some_and(|providers| providers.contains_key(PROVIDER_ID));
    let parse_error = parsed.as_ref().err().map(|error| {
        format!("The existing config could not be parsed safely and was not changed: {error}")
    });

    if !installed || !request.write {
        return OpencodeIntegrationResult {
            installed,
            configured,
            wrote_config: false,
            config_path: path.display().to_string(),
            snippet,
            error: parse_error,
        };
    }

    let mut root = match parsed {
        Ok(Some(value)) if value.is_object() => value,
        Ok(Some(_)) => {
            return OpencodeIntegrationResult {
                installed,
                configured,
                wrote_config: false,
                config_path: path.display().to_string(),
                snippet,
                error: Some("The OpenCode config root is not a JSON object".to_string()),
            }
        }
        Ok(None) => json!({ "$schema": "https://opencode.ai/config.json" }),
        Err(error) => {
            return OpencodeIntegrationResult {
                installed,
                configured,
                wrote_config: false,
                config_path: path.display().to_string(),
                snippet,
                error: Some(format!(
                    "The existing config could not be parsed safely and was not changed: {error}"
                )),
            }
        }
    };

    let Some(root_object) = root.as_object_mut() else {
        unreachable!("root was validated as an object")
    };
    let providers = root_object
        .entry(provider_key)
        .or_insert_with(|| Value::Object(Map::new()));
    let Some(providers_object) = providers.as_object_mut() else {
        return OpencodeIntegrationResult {
            installed,
            configured,
            wrote_config: false,
            config_path: path.display().to_string(),
            snippet,
            error: Some(format!("OpenCode `{provider_key}` is not a JSON object")),
        };
    };
    providers_object.insert(PROVIDER_ID.to_string(), provider);

    let write_result = (|| -> Result<(), String> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        create_backup(&path)?;
        let content = serde_json::to_string_pretty(&root).map_err(|error| error.to_string())?;
        fs::write(&path, format!("{content}\n")).map_err(|error| error.to_string())
    })();

    OpencodeIntegrationResult {
        installed,
        configured: write_result.is_ok(),
        wrote_config: write_result.is_ok(),
        config_path: path.display().to_string(),
        snippet,
        error: write_result.err(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_v1_provider_with_models() {
        let provider = provider_config(
            "http://127.0.0.1:52625/v1",
            &["model-a".to_string(), "model-b".to_string()],
            false,
        );

        assert_eq!(provider["npm"], "@ai-sdk/openai-compatible");
        assert_eq!(provider["options"]["baseURL"], "http://127.0.0.1:52625/v1");
        assert!(provider["models"]["model-a"].is_object());
        assert!(provider["models"]["model-b"].is_object());
    }

    #[test]
    fn builds_v2_provider_with_model_ids() {
        let provider = provider_config("http://127.0.0.1:52625/v1", &["model-a".to_string()], true);

        assert_eq!(
            provider["package"],
            "@opencode/ai/providers/openai-compatible"
        );
        assert_eq!(provider["models"]["model-a"]["modelID"], "model-a");
    }
}
