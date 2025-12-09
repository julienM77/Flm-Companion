import { useState, useEffect, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";
import { FlmService } from "../services/flm";
import { NotificationService } from "../services/notification";
import { isPresetId } from "../lib/presets";
import type { FlmModel, HardwareInfo } from "../types";

interface UseModelsManagerProps {
    flmPath: string;
    isConfigLoaded: boolean;
    initialSelectedModel?: string;
}

interface UseModelsManagerReturn {
    installedModels: FlmModel[];
    runnableModels: FlmModel[];
    availableModels: FlmModel[];
    selectedModel: string;
    setSelectedModel: (model: string) => void;
    hardwareInfo: HardwareInfo | null;
    loadInstalledModels: (force?: boolean) => void;
    loadAvailableModels: (force?: boolean) => void;
    loadHardwareInfo: (force?: boolean) => Promise<void>;
}

export function useModelsManager({
    flmPath,
    isConfigLoaded,
    initialSelectedModel = "",
}: UseModelsManagerProps): UseModelsManagerReturn {
    const { t } = useTranslation();
    const [installedModels, setInstalledModels] = useState<FlmModel[]>([]);
    const [runnableModels, setRunnableModels] = useState<FlmModel[]>([]);
    const [availableModels, setAvailableModels] = useState<FlmModel[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>(initialSelectedModel);
    const [hardwareInfo, setHardwareInfo] = useState<HardwareInfo | null>(null);

    // Refs for event listeners
    const installedModelsRef = useRef(installedModels);
    useEffect(() => {
        installedModelsRef.current = installedModels;
    }, [installedModels]);

    const loadInstalledModels = useCallback((force = false) => {
        FlmService.listModels("installed", force).then((models) => {
            setInstalledModels(models);

            const runnable = models.filter(m => !m.isEmbed && !m.isAudio);
            setRunnableModels(runnable);

            setSelectedModel((prev) => {
                if (prev && isPresetId(prev)) return prev;
                if (prev && runnable.some((m) => m.name === prev)) return prev;
                if (prev === "") return "";
                return runnable.length > 0 ? runnable[0].name : "";
            });
        });
    }, []);

    const loadAvailableModels = useCallback((force = false) => {
        FlmService.listModels("not-installed", force).then((models) => {
            setAvailableModels(models);
        });
    }, []);

    const loadHardwareInfo = useCallback(async (force = false) => {
        const info = await FlmService.getHardwareInfo(force);
        setHardwareInfo(info);
    }, []);

    const handleDeleteModel = useCallback(async (modelName: string) => {
        try {
            await FlmService.removeModel(modelName);
            NotificationService.send(
                t("app.notification_model_delete_complete_title"),
                t("app.notification_model_delete_complete_body", { model: modelName })
            );
            loadInstalledModels(true);
            loadAvailableModels(true);
        } catch {
            NotificationService.send(
                t("app.notification_model_delete_error_title"),
                t("app.notification_model_delete_error_body", { model: modelName })
            );
        }
    }, [t, loadInstalledModels, loadAvailableModels]);

    const handleDownloadModel = useCallback(async (modelName: string) => {
        try {
            NotificationService.send(
                t("app.notification_model_download_start_title"),
                t("app.notification_model_download_start_body", { model: modelName })
            );
            await FlmService.pullModel(modelName, () => { });
            NotificationService.send(
                t("app.notification_model_download_complete_title"),
                t("app.notification_model_download_complete_body", { model: modelName })
            );
            loadInstalledModels(true);
            loadAvailableModels(true);
        } catch {
            NotificationService.send(
                t("app.notification_model_download_error_title"),
                t("app.notification_model_download_error_body", { model: modelName })
            );
        }
    }, [t, loadInstalledModels, loadAvailableModels]);

    // Load initial data when config is ready
    useEffect(() => {
        if (!isConfigLoaded) return;

        loadInstalledModels();
        loadAvailableModels();
        loadHardwareInfo();
    }, [flmPath, isConfigLoaded, loadInstalledModels, loadAvailableModels, loadHardwareInfo]);

    // Set initial selected model from config
    useEffect(() => {
        if (initialSelectedModel && !selectedModel) {
            setSelectedModel(initialSelectedModel);
        }
    }, [initialSelectedModel, selectedModel]);

    // Event listeners for tray menu actions
    useEffect(() => {
        const unlistenDelete = listen<string>("request-delete-model", (event) => {
            handleDeleteModel(event.payload);
        });

        const unlistenDownload = listen<string>("request-download-model", (event) => {
            handleDownloadModel(event.payload);
        });

        return () => {
            unlistenDelete.then((f) => f());
            unlistenDownload.then((f) => f());
        };
    }, [handleDeleteModel, handleDownloadModel]);

    return {
        installedModels,
        runnableModels,
        availableModels,
        selectedModel,
        setSelectedModel,
        hardwareInfo,
        loadInstalledModels,
        loadAvailableModels,
        loadHardwareInfo,
    };
}
