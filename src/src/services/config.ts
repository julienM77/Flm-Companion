import { BaseDirectory, readTextFile, writeTextFile, exists, mkdir } from "@tauri-apps/plugin-fs";
import packageJson from "../../package.json";
import {
    AppConfig,
    ServerOptions,
    DEFAULT_APP_CONFIG,
    CONFIG_FILENAME,
    ServerPreset,
    PresetsConfig,
    DEFAULT_PRESETS_CONFIG,
} from "../types";

// Re-export types for compatibility
export type { AppConfig, ServerOptions };

export const ConfigService = {
    getAppVersion(): string {
        return packageJson.version;
    },

    async loadConfig(): Promise<AppConfig> {
        try {
            const dirExists = await exists("", { baseDir: BaseDirectory.AppConfig });
            if (!dirExists) {
                await mkdir("", { baseDir: BaseDirectory.AppConfig, recursive: true });
            }

            const configExists = await exists(CONFIG_FILENAME, { baseDir: BaseDirectory.AppConfig });
            if (!configExists) {
                await this.saveConfig(DEFAULT_APP_CONFIG);
                return DEFAULT_APP_CONFIG;
            }

            const content = await readTextFile(CONFIG_FILENAME, { baseDir: BaseDirectory.AppConfig });
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
        try {
            const dirExists = await exists("", { baseDir: BaseDirectory.AppConfig });
            if (!dirExists) {
                await mkdir("", { baseDir: BaseDirectory.AppConfig, recursive: true });
            }

            await writeTextFile(CONFIG_FILENAME, JSON.stringify(config, null, 2), {
                baseDir: BaseDirectory.AppConfig,
            });
        } catch (error) {
            console.error("Failed to save config:", error);
        }
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
