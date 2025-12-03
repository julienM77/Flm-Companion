import { useState, useEffect, useCallback } from "react";
import { FlmService } from "../services/flm";
import type { FlmModel, HardwareInfo } from "../types";

interface UseModelsManagerProps {
    flmPath: string;
    isConfigLoaded: boolean;
    initialSelectedModel?: string;
}

interface UseModelsManagerReturn {
    installedModels: FlmModel[];
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
    const [selectedModel, setSelectedModel] = useState<string>(initialSelectedModel);
    const [hardwareInfo, setHardwareInfo] = useState<HardwareInfo | null>(null);

    const loadInstalledModels = useCallback((force = false) => {
        FlmService.listModels("installed", force).then((models) => {
            setInstalledModels(models);
            setSelectedModel((prev) => {
                if (prev && models.some((m) => m.name === prev)) return prev;
                return models.length > 0 ? models[0].name : "";
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
        selectedModel,
        setSelectedModel,
        hardwareInfo,
        loadInstalledModels,
        loadHardwareInfo,
    };
}
