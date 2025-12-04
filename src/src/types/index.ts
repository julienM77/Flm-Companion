// Types centralisés pour l'application FLM Companion

export type Theme = "dark" | "light" | "system";

export type ServerStatus = "stopped" | "running" | "starting";

export type PerformanceMode = "powersaver" | "balanced" | "performance" | "turbo";

export interface ServerOptions {
    pmode?: PerformanceMode;
    ctxLen?: number;
    port?: number;
    host?: string;
    asr?: boolean;
    embed?: boolean;
    socket?: number;
    qLen?: number;
    cors?: boolean;
    preemption?: boolean;
}

export interface FlmModel {
    name: string;
    size: string;
    modified: string;
    // Extended metadata
    realSize?: number;
    description?: string;
    family?: string;
    isThink?: boolean;
    isVlm?: boolean;
    isEmbed?: boolean;
    isAudio?: boolean;
    contextLength?: number;
    quantization?: string;
    url?: string;
    parameterSize?: string;
}

export interface HardwareInfo {
    cpu: string;
    ram: string;
    ramTotalBytes: number;
    npuDriver: string;
    npuName: string;
    sharedMemory: string;
    sharedMemoryBytes: number;
}

export interface AppConfig {
    theme: Theme;
    startMinimized: boolean;
    flmPath: string;
    lastSelectedModel: string;
    serverOptions: ServerOptions;
}

export interface FlmStatus {
    version: string;
    isInstalled: boolean;
}

// ============================================
// Server Presets
// ============================================

export interface ServerPreset {
    id: string;                    // Unique identifier, e.g., "preset:audio-only"
    nameKey?: string;              // i18n key for system presets (e.g., "presets.audio_only")
    name?: string;                 // Custom name for user presets
    model: string;                 // Model to use ("" for no model)
    options: Partial<ServerOptions>; // Options to apply when preset is selected
}

export interface PresetsConfig {
    system: ServerPreset[];
    user: ServerPreset[];
}

// ============================================
// Default constants
// ============================================

export const DEFAULT_SERVER_PORT = 52625;

export const DEFAULT_SERVER_OPTIONS: ServerOptions = {
    pmode: "performance",
    port: DEFAULT_SERVER_PORT,
    host: "127.0.0.1",
    ctxLen: 0,
    asr: false,
    embed: false,
    socket: 10,
    qLen: 10,
    cors: true,
    preemption: false,
};

export const DEFAULT_SYSTEM_PRESETS: ServerPreset[] = [
    {
        id: "preset:audio-only",
        nameKey: "presets.audio_only",
        model: "",
        options: { asr: true, ctxLen: 0 },
    },
];

export const DEFAULT_PRESETS_CONFIG: PresetsConfig = {
    system: DEFAULT_SYSTEM_PRESETS,
    user: [],
};

export const DEFAULT_APP_CONFIG: AppConfig = {
    theme: "dark",
    startMinimized: false,
    flmPath: "flm",
    lastSelectedModel: "",
    serverOptions: DEFAULT_SERVER_OPTIONS,
};

export const CONFIG_FILENAME = "config.json";

export const MODEL_LIST_FILENAME = "model_list.json";
