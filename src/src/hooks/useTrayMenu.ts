import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import type { ServerStatus, ServerOptions, FlmModel, PresetsConfig, Theme } from "../types";
import { getPresetDisplayName } from "../lib/presets";

interface TrayPreset {
    id: string;
    name: string;
    isSystem: boolean;
}

interface UseTrayMenuProps {
    serverStatus: ServerStatus;
    selectedModel: string;
    installedModels: FlmModel[];
    availableModels: FlmModel[];
    runnableModels: FlmModel[];
    serverOptions: ServerOptions;
    flmVersion: string;
    isFlmAvailable: boolean;
    presetsConfig: PresetsConfig;
    theme: Theme;
}

export function useTrayMenu({
    serverStatus,
    selectedModel,
    installedModels,
    availableModels,
    runnableModels,
    serverOptions,
    flmVersion,
    isFlmAvailable,
    presetsConfig,
    theme,
}: UseTrayMenuProps): void {
    const { t } = useTranslation();
    const [systemIsDark, setSystemIsDark] = useState(() =>
        window.matchMedia("(prefers-color-scheme: dark)").matches
    );

    useEffect(() => {
        const media = window.matchMedia("(prefers-color-scheme: dark)");
        const updateTheme = (event: MediaQueryListEvent) => setSystemIsDark(event.matches);
        media.addEventListener("change", updateTheme);
        return () => media.removeEventListener("change", updateTheme);
    }, []);

    useEffect(() => {
        // Build presets list with translated names
        const systemPresets: TrayPreset[] = presetsConfig.system.map(preset => ({
            id: preset.id,
            name: getPresetDisplayName(preset, t),
            isSystem: true,
        }));
        
        const userPresets: TrayPreset[] = presetsConfig.user.map(preset => ({
            id: preset.id,
            name: getPresetDisplayName(preset, t),
            isSystem: false,
        }));
        
        const presets: TrayPreset[] = [...systemPresets, ...userPresets];

        invoke("update_tray_menu", {
            params: {
                isRunning: serverStatus === "running",
                isDarkTheme: theme === "dark" || (theme === "system" && systemIsDark),
                selectedModel: selectedModel,
                presets: presets,
                installedModels: installedModels.map((m) => m.name),
                availableModels: availableModels.map((m) => m.name),
                startableModels: runnableModels.map((m) => m.name),
                asrEnabled: serverOptions.asr,
                embedEnabled: serverOptions.embed,
                flmVersion: flmVersion,
                isFlmAvailable: isFlmAvailable,
                texts: {
                    start: t("tray.start"),
                    stop: t("tray.stop"),
                    quit: t("tray.quit"),
                    settings: t("tray.settings"),
                    running: t("tray.server_running"),
                    stopped: t("tray.server_stopped"),
                    viewLogs: t("tray.view_logs"),
                    features: t("tray.features"),
                    asr: t("tray.asr"),
                    embed: t("tray.embed"),
                    presetsGroup: t("tray.presets_group"),
                    modelsGroup: t("tray.models_group"),
                    modelsMenu: t("tray.models_menu"),
                    noModelsAvailable: t("tray.no_models_available"),
                    startWithModel: t("tray.start_with_model"),
                    deleteModel: t("tray.delete_model"),
                    downloadModel: t("tray.download_model"),
                },
            },
        });
    }, [serverStatus, selectedModel, installedModels, availableModels, runnableModels, serverOptions, flmVersion, isFlmAvailable, presetsConfig, theme, systemIsDark, t]);
}
