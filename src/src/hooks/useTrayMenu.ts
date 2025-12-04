import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import type { ServerStatus, ServerOptions, FlmModel } from "../types";
import { DEFAULT_PRESETS_CONFIG } from "../types";
import { getAllPresets, getPresetDisplayName } from "../lib/presets";

interface TrayPreset {
    id: string;
    name: string;
}

interface UseTrayMenuProps {
    serverStatus: ServerStatus;
    selectedModel: string;
    installedModels: FlmModel[];
    serverOptions: ServerOptions;
}

export function useTrayMenu({
    serverStatus,
    selectedModel,
    installedModels,
    serverOptions,
}: UseTrayMenuProps): void {
    const { t } = useTranslation();

    useEffect(() => {
        // Build presets list with translated names
        const presets: TrayPreset[] = getAllPresets(DEFAULT_PRESETS_CONFIG).map(preset => ({
            id: preset.id,
            name: getPresetDisplayName(preset, t),
        }));

        invoke("update_tray_menu", {
            params: {
                isRunning: serverStatus === "running",
                selectedModel: selectedModel,
                presets: presets,
                installedModels: installedModels.map((m) => m.name),
                asrEnabled: serverOptions.asr,
                embedEnabled: serverOptions.embed,
                texts: {
                    start: t("tray.start"),
                    stop: t("tray.stop"),
                    quit: t("tray.quit"),
                    settings: t("tray.settings"),
                    running: t("tray.server_running"),
                    stopped: t("tray.server_stopped"),
                    selectModel: t("tray.select_model"),
                    viewLogs: t("tray.view_logs"),
                    features: t("tray.features"),
                    asr: t("tray.asr"),
                    embed: t("tray.embed"),
                    presetsGroup: t("tray.presets_group"),
                    modelsGroup: t("tray.models_group"),
                },
            },
        });
    }, [serverStatus, selectedModel, installedModels, serverOptions, t]);
}
