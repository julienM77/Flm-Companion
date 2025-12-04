import { useState, useEffect, useCallback } from "react";
import { FlmService } from "../services/flm";
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
    selectedModel: string;
    setSelectedModel: (model: string) => void;
    hardwareInfo: HardwareInfo | null;
    loadInstalledModels: (force?: boolean) => void;
    loadHardwareInfo: (force?: boolean) => Promise<void>;
}

export function useModelsManager({
    flmPath,
    isConfigLoaded,
    initialSelectedModel = "",
}: UseModelsManagerProps): UseModelsManagerReturn {
    const [installedModels, setInstalledModels] = useState<FlmModel[]>([]);
    const [runnableModels, setRunnableModels] = useState<FlmModel[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>(initialSelectedModel);
    const [hardwareInfo, setHardwareInfo] = useState<HardwareInfo | null>(null);

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

    const loadHardwareInfo = useCallback(async (force = false) => {
        const info = await FlmService.getHardwareInfo(force);
        setHardwareInfo(info);
    }, []);

    // Load initial data when config is ready
    useEffect(() => {
        if (!isConfigLoaded) return;

        loadInstalledModels();
        loadHardwareInfo();
    }, [flmPath, isConfigLoaded, loadInstalledModels, loadHardwareInfo]);

    // Set initial selected model from config
    useEffect(() => {
        if (initialSelectedModel && !selectedModel) {
            setSelectedModel(initialSelectedModel);
        }
    }, [initialSelectedModel, selectedModel]);

    return {
        installedModels,
        runnableModels,
        selectedModel,
        setSelectedModel,
        hardwareInfo,
        loadInstalledModels,
        loadHardwareInfo,
    };
}
