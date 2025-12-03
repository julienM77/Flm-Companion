import { BaseDirectory, readTextFile, writeTextFile, exists, mkdir } from "@tauri-apps/plugin-fs";
import packageJson from "../../package.json";
import {
    AppConfig,
    ServerOptions,
    DEFAULT_APP_CONFIG,
    CONFIG_FILENAME,
} from "../types";

// Ré-export des types pour la compatibilité
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
};
