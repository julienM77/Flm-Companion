import { invoke } from "@tauri-apps/api/core";
import packageJson from "../../package.json";
import {
    AppConfig,
    ServerOptions,
    DEFAULT_APP_CONFIG,
    ServerPreset,
    PresetsConfig,
    DEFAULT_PRESETS_CONFIG,
} from "../types";

let configWriteQueue: Promise<void> = Promise.resolve();

function enqueueConfigWrite(write: () => Promise<void>): Promise<void> {
    const nextWrite = configWriteQueue.then(write);
    configWriteQueue = nextWrite.catch(() => undefined);
    return nextWrite;
}

// Re-export types for compatibility
export type { AppConfig, ServerOptions };

export const ConfigService = {
    getAppVersion(): string {
        return packageJson.version;
    },

    async loadConfig(): Promise<AppConfig> {
        try {
            const content = await invoke<string | null>("load_app_config");
            if (!content) {
                return DEFAULT_APP_CONFIG;
            }
            const config = JSON.parse(content);

            return {
                ...DEFAULT_APP_CONFIG,
                ...config,
                serverOptions: { ...DEFAULT_APP_CONFIG.serverOptions, ...config.serverOptions },
                presetsConfig: config.presetsConfig ? {
                    system: [...DEFAULT_PRESETS_CONFIG.system], // Always use default system presets
                    user: config.presetsConfig.user || []
                } : DEFAULT_PRESETS_CONFIG,
            };
        } catch (error) {
            console.error("Failed to load config:", error);
            return DEFAULT_APP_CONFIG;
        }
    },

    async saveConfig(config: AppConfig): Promise<void> {
        return enqueueConfigWrite(async () => {
            try {
                await invoke("save_app_config", {
                    contents: JSON.stringify(config, null, 2),
                });
            } catch (error) {
                console.error("Failed to save config:", error);
                throw error;
            }
        });
    },

    async updateConfig(patch: Partial<AppConfig>): Promise<void> {
        return enqueueConfigWrite(async () => {
            const config = await this.loadConfig();
            try {
                await invoke("save_app_config", {
                    contents: JSON.stringify({ ...config, ...patch }, null, 2),
                });
            } catch (error) {
                console.error("Failed to update config:", error);
                throw error;
            }
        });
    },

    async getPresetsConfig(): Promise<PresetsConfig> {
        const config = await this.loadConfig();
        return config.presetsConfig ?? DEFAULT_PRESETS_CONFIG;
    },

    async saveUserPreset(preset: ServerPreset): Promise<void> {
        try {
            const config = await this.loadConfig();
            const presetsConfig = config.presetsConfig ?? DEFAULT_PRESETS_CONFIG;
            
            // Check if preset with this ID already exists
            const existingIndex = presetsConfig.user.findIndex(p => p.id === preset.id);
            
            if (existingIndex >= 0) {
                // Update existing preset
                presetsConfig.user[existingIndex] = preset;
            } else {
                // Add new preset
                presetsConfig.user.push(preset);
            }
            
            config.presetsConfig = presetsConfig;
            await this.saveConfig(config);
        } catch (error) {
            console.error("Failed to save user preset:", error);
            throw error;
        }
    },

    async deleteUserPreset(presetId: string): Promise<void> {
        try {
            const config = await this.loadConfig();
            const presetsConfig = config.presetsConfig ?? DEFAULT_PRESETS_CONFIG;
            
            presetsConfig.user = presetsConfig.user.filter(p => p.id !== presetId);
            
            config.presetsConfig = presetsConfig;
            await this.saveConfig(config);
        } catch (error) {
            console.error("Failed to delete user preset:", error);
            throw error;
        }
    },
};
