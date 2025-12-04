import type { ServerPreset, PresetsConfig } from "../types";
import { DEFAULT_PRESETS_CONFIG } from "../types";

/**
 * Check if an id represents a preset (starts with "preset:")
 */
export function isPresetId(id: string): boolean {
    return id.startsWith("preset:");
}

/**
 * Get all presets (system + user) from config
 * Falls back to default presets if config is undefined
 */
export function getAllPresets(presetsConfig?: PresetsConfig): ServerPreset[] {
    const config = presetsConfig ?? DEFAULT_PRESETS_CONFIG;
    return [...config.system, ...config.user];
}

/**
 * Find a preset by its id
 */
export function findPresetById(id: string, presetsConfig?: PresetsConfig): ServerPreset | undefined {
    const allPresets = getAllPresets(presetsConfig);
    return allPresets.find((p) => p.id === id);
}

/**
 * Get the display name for a preset
 * For system presets, uses the translation function with nameKey
 * For user presets, uses the name directly
 */
export function getPresetDisplayName(
    preset: ServerPreset,
    t: (key: string) => string
): string {
    if (preset.nameKey) {
        return t(preset.nameKey);
    }
    return preset.name || preset.id;
}
