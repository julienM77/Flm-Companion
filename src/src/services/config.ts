import { BaseDirectory, readTextFile, writeTextFile, exists, mkdir } from "@tauri-apps/plugin-fs";
import { ServerOptions } from "./flm";
import packageJson from "../../package.json";

export interface AppConfig {
    theme: "dark" | "light" | "system";
    flmPath: string;
    lastSelectedModel: string;
    serverOptions: ServerOptions;
}

const DEFAULT_CONFIG: AppConfig = {
    theme: "dark",
    flmPath: "",
    lastSelectedModel: "",
    serverOptions: {
        pmode: 'performance',
        port: 52625,
        ctxLen: 0,
        asr: false,
        embed: false,
        socket: 10,
        qLen: 10,
        cors: true,
        preemption: false
    }
};

const CONFIG_FILENAME = "config.json";

export const ConfigService = {
    getAppVersion(): string {
        return packageJson.version;
    },

    async loadConfig(): Promise<AppConfig> {
        try {
            // Check if config directory exists, if not create it
            const dirExists = await exists("", { baseDir: BaseDirectory.AppConfig });
            if (!dirExists) {
                await mkdir("", { baseDir: BaseDirectory.AppConfig, recursive: true });
            }

            const configExists = await exists(CONFIG_FILENAME, { baseDir: BaseDirectory.AppConfig });
            if (!configExists) {
                await this.saveConfig(DEFAULT_CONFIG);
                return DEFAULT_CONFIG;
            }

            const content = await readTextFile(CONFIG_FILENAME, { baseDir: BaseDirectory.AppConfig });
            const config = JSON.parse(content);

            // Merge with default to handle new fields or missing values
            return {
                ...DEFAULT_CONFIG,
                ...config,
                serverOptions: { ...DEFAULT_CONFIG.serverOptions, ...config.serverOptions }
            };
        } catch (error) {
            console.error("Failed to load config:", error);
            return DEFAULT_CONFIG;
        }
    },

    async saveConfig(config: AppConfig): Promise<void> {
        try {
            // Ensure directory exists
            const dirExists = await exists("", { baseDir: BaseDirectory.AppConfig });
            if (!dirExists) {
                await mkdir("", { baseDir: BaseDirectory.AppConfig, recursive: true });
            }

            await writeTextFile(CONFIG_FILENAME, JSON.stringify(config, null, 2), { baseDir: BaseDirectory.AppConfig });
        } catch (error) {
            console.error("Failed to save config:", error);
        }
    }
};
